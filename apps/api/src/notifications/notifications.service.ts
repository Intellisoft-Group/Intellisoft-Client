import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly log = new Logger(NotificationsService.name);
  private firebaseApp: App | null | undefined;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const app = this.getFirebaseApp();
    if (app) {
      this.log.log('FCM ready (Firebase Admin HTTP v1)');
    } else {
      this.log.warn(
        'FCM not configured — set FCM_SERVICE_ACCOUNT_PATH (or JSON/BASE64). Push notifications will not leave the server.',
      );
    }
  }

  async list(user: AuthUser) {
    try {
      if (user.role === 'CLIENT') {
        return await this.prisma.notification.findMany({
          where: {
            OR: [
              { userId: user.id },
              { organizationId: user.organizationId || '__none__', userId: null },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
      }
      return await this.prisma.notification.findMany({
        where: {
          OR: [
            { user: { role: 'CLIENT' } },
            { userId: null, type: 'ANNOUNCEMENT' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    } catch (e: any) {
      this.log.error(`Notification list failed: ${e?.message || e}`);
      return [];
    }
  }

  async markRead(id: string, user: AuthUser) {
    try {
      const row = await this.prisma.notification.findFirst({
        where:
          user.role === 'CLIENT'
            ? {
                id,
                OR: [
                  { userId: user.id },
                  { organizationId: user.organizationId || '__none__', userId: null },
                ],
              }
            : { id },
      });
      if (!row) return { ok: false };
      return await this.prisma.notification.update({
        where: { id },
        data: { read: true },
      });
    } catch (e: any) {
      this.log.error(`Notification markRead failed: ${e?.message || e}`);
      return { ok: false };
    }
  }

  async markAllRead(user: AuthUser) {
    try {
      if (user.role !== 'CLIENT') return { ok: true, count: 0 };
      const result = await this.prisma.notification.updateMany({
        where: {
          read: false,
          OR: [
            { userId: user.id },
            { organizationId: user.organizationId || '__none__', userId: null },
          ],
        },
        data: { read: true },
      });
      return { ok: true, count: result.count };
    } catch (e: any) {
      this.log.error(`Notification markAllRead failed: ${e?.message || e}`);
      return { ok: false, count: 0 };
    }
  }

  /**
   * Save inbox rows for clients + send Firebase Cloud Messaging push.
   * Device must have registered an FCM token via POST /auth/push-token.
   */
  async notifyOrganizationClients(opts: {
    organizationId?: string | null;
    title: string;
    body: string;
    type: string;
    allOrganizations?: boolean;
    /** Optional source id (chat message, invoice, …) for later cleanup. */
    refId?: string | null;
  }) {
    try {
      const where: any = {
        role: 'CLIENT',
        isActive: true,
        organizationId: { not: null },
      };
      if (!opts.allOrganizations) {
        if (!opts.organizationId) return { recipients: 0, pushed: 0 };
        where.organizationId = opts.organizationId;
      }

      const clients = await this.prisma.user.findMany({
        where,
        select: { id: true, organizationId: true, expoPushToken: true },
      });
      if (!clients.length) return { recipients: 0, pushed: 0 };

      const baseRows = clients.map((c) => ({
        title: opts.title,
        body: opts.body,
        type: opts.type as any,
        userId: c.id,
        organizationId: c.organizationId,
        ...(opts.refId ? { refId: opts.refId } : {}),
      }));

      try {
        await this.prisma.notification.createMany({ data: baseRows });
      } catch (e: any) {
        // Retry without refId if the column is missing on an older DB.
        this.log.warn(`Notification createMany failed (${e?.message || e}); retrying without refId`);
        await this.prisma.notification.createMany({
          data: clients.map((c) => ({
            title: opts.title,
            body: opts.body,
            type: opts.type as any,
            userId: c.id,
            organizationId: c.organizationId,
          })),
        });
      }

      const tokenOwners = new Map<string, string[]>();
      for (const c of clients) {
        const t = c.expoPushToken?.trim();
        if (!t || t.length < 20) continue;
        if (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')) continue;
        const owners = tokenOwners.get(t) || [];
        owners.push(c.id);
        tokenOwners.set(t, owners);
      }
      const tokens = [...tokenOwners.keys()];

      if (!tokens.length) {
        this.log.warn(
          `FCM skip: ${clients.length} client(s) matched but 0 have a device push token`,
        );
        return { recipients: clients.length, pushed: 0 };
      }

      this.log.log(`FCM sending to ${tokens.length} device(s) for type=${opts.type}`);
      const pushed = await this.sendFcmPush(tokens, opts.title, opts.body, opts.type, tokenOwners);
      this.log.log(`FCM done: pushed=${pushed}/${tokens.length}`);
      return { recipients: clients.length, pushed };
    } catch (e: any) {
      this.log.error(`notifyOrganizationClients failed: ${e?.message || e}`);
      return { recipients: 0, pushed: 0 };
    }
  }

  async broadcast(body: {
    title: string;
    body: string;
    organizationId?: string;
    type?: string;
    pinAsAnnouncement?: boolean;
  }) {
    const type = (body.type as any) || 'ANNOUNCEMENT';

    if (body.pinAsAnnouncement !== false && type === 'ANNOUNCEMENT') {
      await this.prisma.announcement.create({
        data: {
          title: body.title,
          body: body.body,
          isPinned: true,
          isActive: true,
        },
      });
    }

    return this.notifyOrganizationClients({
      organizationId: body.organizationId || null,
      allOrganizations: !body.organizationId,
      title: body.title,
      body: body.body,
      type,
    });
  }

  async notifyLoggedInClients(
    organizationId: string,
    title: string,
    body: string,
    type: string = 'CHAT_MESSAGE',
    refId?: string | null,
  ) {
    return this.notifyOrganizationClients({ organizationId, title, body, type, refId });
  }

  /**
   * Remove bell-list rows created for a chat message (admin delete).
   * Prefer refId; fall back to org + body + time window for older rows.
   */
  async deleteForChatMessage(opts: {
    messageId: string;
    organizationId: string;
    body: string;
    createdAt: Date;
  }) {
    try {
      const byRef = await this.prisma.notification.deleteMany({
        where: { type: 'CHAT_MESSAGE', refId: opts.messageId } as any,
      });
      if (byRef.count > 0) return { deleted: byRef.count };
    } catch (e: any) {
      this.log.warn(`deleteForChatMessage by refId failed: ${e?.message || e}`);
    }

    try {
      const preview = (opts.body || '').slice(0, 180);
      const from = new Date(opts.createdAt.getTime() - 15_000);
      const to = new Date(opts.createdAt.getTime() + 120_000);
      const where: Prisma.NotificationWhereInput = {
        type: 'CHAT_MESSAGE',
        organizationId: opts.organizationId,
        createdAt: { gte: from, lte: to },
      };
      if (preview) {
        where.OR = [
          { body: preview },
          { body: { startsWith: preview.slice(0, Math.min(40, preview.length)) } },
        ];
      }
      const byMatch = await this.prisma.notification.deleteMany({ where });
      return { deleted: byMatch.count };
    } catch (e: any) {
      this.log.warn(`deleteForChatMessage fallback failed: ${e?.message || e}`);
      return { deleted: 0 };
    }
  }

  /** Prefer FCM HTTP v1 (service account). Legacy FCM_SERVER_KEY still works if present. */
  async sendFcmPush(
    tokens: string[],
    title: string,
    body: string,
    type?: string,
    tokenOwners?: Map<string, string[]>,
  ) {
    if (!tokens.length) return 0;
    const app = this.getFirebaseApp();
    if (app) {
      try {
        const res = await getMessaging(app).sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: {
            title,
            body,
            type: type || 'ANNOUNCEMENT',
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'intellisoft_alerts',
              sound: 'default',
              // Exact white silhouette of brand mark (no tint filter).
              icon: 'ic_notification',
            },
          },
        });
        const staleUserIds = new Set<string>();
        if (res.failureCount) {
          res.responses.forEach((r, i) => {
            if (r.success) return;
            const code = r.error?.code || '';
            const msg = r.error?.message || String(r.error);
            this.log.warn(`FCM v1 failed for token[${i}]: ${code} ${msg}`);
            if (INVALID_TOKEN_CODES.has(code) && tokenOwners) {
              for (const uid of tokenOwners.get(tokens[i]) || []) staleUserIds.add(uid);
            }
          });
        }
        if (staleUserIds.size) {
          await this.prisma.user.updateMany({
            where: { id: { in: [...staleUserIds] } },
            data: { expoPushToken: null },
          });
          this.log.warn(`Cleared ${staleUserIds.size} stale FCM token(s)`);
        }
        return res.successCount;
      } catch (e: any) {
        this.log.warn(`FCM v1 error: ${e?.message || e}`);
        return 0;
      }
    }

    const key = this.config.get<string>('FCM_SERVER_KEY');
    if (!key) {
      this.log.warn(
        `FCM not configured — set FCM_SERVICE_ACCOUNT_PATH (or JSON/BASE64). ${tokens.length} device token(s) not pushed`,
      );
      return 0;
    }
    return this.sendFcmLegacy(tokens, title, body, type, key);
  }

  /** Firebase Admin (HTTP v1) — Project settings → Service accounts → Generate new private key. */
  private getFirebaseApp(): App | null {
    if (this.firebaseApp !== undefined) return this.firebaseApp;
    try {
      let raw =
        this.config.get<string>('FCM_SERVICE_ACCOUNT_JSON') ||
        process.env.FCM_SERVICE_ACCOUNT_JSON ||
        '';
      const b64 = this.config.get<string>('FCM_SERVICE_ACCOUNT_BASE64') || process.env.FCM_SERVICE_ACCOUNT_BASE64;
      const path = this.config.get<string>('FCM_SERVICE_ACCOUNT_PATH') || process.env.FCM_SERVICE_ACCOUNT_PATH;
      if (!raw && b64) {
        raw = Buffer.from(b64, 'base64').toString('utf8');
      }
      if (!raw && path && fs.existsSync(path)) {
        raw = fs.readFileSync(path, 'utf8');
      }
      // Default path used by docker-compose.prod.yml volume mount
      if (!raw && fs.existsSync('/app/secrets/firebase-adminsdk.json')) {
        raw = fs.readFileSync('/app/secrets/firebase-adminsdk.json', 'utf8');
      }
      if (!raw?.trim()) {
        this.firebaseApp = null;
        return null;
      }
      const cred = JSON.parse(raw);
      const name = 'intellisoft-fcm';
      this.firebaseApp = getApps().some((a) => a.name === name)
        ? getApp(name)
        : initializeApp({ credential: cert(cred) }, name);
      this.log.log(`Firebase Admin initialized (project=${cred.project_id || 'unknown'})`);
      return this.firebaseApp;
    } catch (e: any) {
      this.log.warn(`Firebase Admin init failed: ${e?.message || e}`);
      this.firebaseApp = null;
      return null;
    }
  }

  /** @deprecated Legacy FCM HTTP API — server key removed from new Firebase consoles. */
  private async sendFcmLegacy(
    tokens: string[],
    title: string,
    body: string,
    type: string | undefined,
    key: string,
  ) {
    let sent = 0;
    for (const token of tokens) {
      try {
        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            Authorization: `key=${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: token,
            priority: 'high',
            notification: {
              title,
              body,
              sound: 'default',
              android_channel_id: 'intellisoft_alerts',
            },
            data: {
              title,
              body,
              type: type || 'ANNOUNCEMENT',
            },
          }),
        });
        const text = await res.text();
        if (res.ok) {
          sent += 1;
        } else {
          this.log.warn(`FCM legacy push failed: ${res.status} ${text}`);
        }
      } catch (e: any) {
        this.log.warn(`FCM legacy push error: ${e?.message || e}`);
      }
    }
    return sent;
  }
}
