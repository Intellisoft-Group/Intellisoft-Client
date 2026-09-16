import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthUser } from '../common/current-user.decorator';
import { CaptchaService } from './captcha.service';
import { requireSecret } from '../common/secrets';
import { publicFileUrl } from '../common/utils';

@Injectable()
export class AuthService {
  private refreshSecret() {
    return requireSecret('JWT_REFRESH_SECRET', this.config.get('JWT_REFRESH_SECRET'), {
      allowDevFallback: 'dev-refresh',
      context: 'AuthService',
    });
  }

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
    private captcha: CaptchaService,
  ) {}

  issueCaptcha() {
    return this.captcha.issue();
  }

  async login(
    email: string,
    password: string,
    captcha?: { token?: string; answer?: string },
    clientApp = false,
  ) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (clientApp) {
      if (user.role !== 'CLIENT') {
        throw new UnauthorizedException(
          'Staff accounts sign in on the Intellisoft CMS website, not the client app.',
        );
      }
    } else if (user.role !== 'CLIENT') {
      this.captcha.assert(captcha?.token, captcha?.answer);
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.refreshSecret(),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user?.refreshTokenHash) throw new UnauthorizedException();
      const match = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!match) throw new UnauthorizedException();
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(user: AuthUser) {
    const profile = await this.publicUser(user.id);
    if (!profile) throw new NotFoundException();
    return profile;
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(next, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { ok: true };
    const token = this.jwt.sign(
      { sub: user.id, typ: 'reset' },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '2h',
      },
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpires: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });
    const appUrl = (
      this.config.get('CLIENT_APP_URL') ||
      this.config.get('API_PUBLIC_URL') ||
      'http://localhost:3002'
    ).replace(/\/$/, '');
    const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mail.send(
      user.email,
      'Reset your Intellisoft password',
      this.mail.wrap(
        'Password reset',
        `<p>Reset your password within 2 hours:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Or paste this token in the client portal / app:</p><p><code>${token}</code></p><p>Ignore this email if you did not request a reset.</p>`,
      ),
    );
    const local = this.config.get('NODE_ENV') !== 'production';
    return { ok: true, resetToken: local ? token : undefined };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpires: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset token');
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpires: null, mustChangePassword: false },
    });
    return { ok: true };
  }

  async registerPushToken(userId: string, token: string, role?: string) {
    if (role && role !== 'CLIENT') {
      return { ok: false, skipped: true };
    }
    const clean = String(token || '').trim();
    if (clean.length < 20) {
      return { ok: false, reason: 'invalid_token' };
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { expoPushToken: clean },
    });
    return { ok: true };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { ok: true };
  }

  /** Full client/staff profile for login, refresh, and /auth/me — keeps avatar + org stable. */
  private async publicUser(userId: string) {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!row) return null;
    const {
      passwordHash,
      refreshTokenHash,
      resetToken,
      resetTokenExpires,
      expoPushToken,
      ...safe
    } = row;
    const apiUrl = this.config.get('API_PUBLIC_URL') || 'http://localhost:3000';
    return {
      ...safe,
      avatarUrl: publicFileUrl(apiUrl, safe.avatarPath),
    };
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    name: string;
    role: AuthUser['role'];
    organizationId: string | null;
    mustChangePassword: boolean;
  }) {
    const payload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: this.refreshSecret(),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '30d',
    });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });
    const profile = await this.publicUser(user.id);
    return {
      accessToken,
      refreshToken,
      user: profile || {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        mustChangePassword: user.mustChangePassword,
        avatarUrl: null,
        organization: null,
      },
    };
  }
}
