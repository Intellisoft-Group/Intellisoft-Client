import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType, Prisma } from '@prisma/client';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { mimeFromName, resolveUploadPath } from '../common/utils';
import { requireSecret } from '../common/secrets';

const DOCUMENT_TYPE_SET = new Set<string>(Object.values(DocumentType));

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async list(user: AuthUser, organizationId?: string, projectId?: string) {
    const where: Prisma.DocumentWhereInput = {};
    if (user.role === 'CLIENT') where.organizationId = user.organizationId || '__none__';
    else if (organizationId) where.organizationId = organizationId;
    if (projectId) where.projectId = projectId;
    const rows = await this.prisma.document.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true, role: true, jobTitle: true, avatarPath: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((d) => this.withUrls(d));
  }

  async create(
    user: AuthUser,
    data: {
      organizationId?: string;
      projectId?: string;
      title: string;
      type?: string;
      filePath: string;
      fileName?: string;
      mimeType?: string;
    },
  ) {
    let organizationId = data.organizationId;
    let projectId = data.projectId || null;
    if (user.role === 'CLIENT') {
      if (!data.projectId) throw new ForbiddenException('Clients can only upload files to a project.');
      const project = await this.prisma.project.findUnique({ where: { id: data.projectId } });
      if (!project || project.organizationId !== user.organizationId) throw new NotFoundException();
      organizationId = project.organizationId;
      projectId = project.id;
    } else if (!organizationId) {
      throw new ForbiddenException('organizationId is required');
    }

    const typeRaw = String(data.type || 'OTHER').trim().toUpperCase();
    if (!DOCUMENT_TYPE_SET.has(typeRaw)) {
      throw new BadRequestException('Invalid document type');
    }

    const row = await this.prisma.document.create({
      data: {
        organizationId: organizationId!,
        projectId,
        uploadedById: user.id,
        title: data.title,
        type: typeRaw as DocumentType,
        source: user.role === 'CLIENT' ? 'CLIENT' : 'STAFF',
        filePath: data.filePath.replace(/\\/g, '/'),
        fileName: data.fileName,
        mimeType: data.mimeType,
      },
    });
    return this.withUrls(row);
  }

  async userFromToken(token?: string): Promise<AuthUser> {
    if (!token) throw new UnauthorizedException('Sign in to open this file');
    try {
      const secret = requireSecret('JWT_SECRET', this.config.get('JWT_SECRET'), {
        allowDevFallback: 'dev-secret',
        context: 'DocumentsService',
      });
      const payload = jwt.verify(token, secret) as { sub: string };
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user?.isActive) throw new UnauthorizedException();
      return { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId };
    } catch {
      throw new UnauthorizedException('Sign in to open this file');
    }
  }

  async openFile(id: string, user: AuthUser) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('File not found');
    if (user.role === 'CLIENT' && doc.organizationId !== user.organizationId) {
      throw new NotFoundException('File not found');
    }
    const disk = resolveUploadPath(doc.filePath);
    if (!disk) throw new NotFoundException('File is missing on the server');
    const fileName = doc.fileName || path.basename(doc.filePath);
    return {
      disk,
      fileName,
      mimeType: mimeFromName(fileName, doc.mimeType || undefined),
    };
  }

  private withUrls<T extends { id: string; filePath: string }>(d: T) {
    const api = (this.config.get('API_PUBLIC_URL') || 'http://localhost:3000').replace(/\/$/, '');
    const fileUrl = `${api}/documents/${d.id}/file`;
    return {
      ...d,
      url: fileUrl,
      // Authenticated route only (no public /uploads for documents).
      staticUrl: fileUrl,
    };
  }

  async remove(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();
    await this.prisma.document.delete({ where: { id } });
    return { ok: true };
  }
}
