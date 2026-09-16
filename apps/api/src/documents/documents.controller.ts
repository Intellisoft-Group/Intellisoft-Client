import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request, Response } from 'express';
import { DocumentsService } from './documents.service';
import { streamDiskFile } from '../common/stream-file';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Public, Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { UPLOAD_LIMITS, attachmentFileFilter } from '../common/upload-options';

@Controller('documents')
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('organizationId') organizationId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.documents.list(user, organizationId, projectId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/documents',
        filename: (_req, file, cb) => cb(null, `${Date.now()}${extname(file.originalname || '.bin')}`),
      }),
      limits: { fileSize: UPLOAD_LIMITS.document },
      fileFilter: attachmentFileFilter,
    }),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A file is required');
    return this.documents.create(user, {
      organizationId: body.organizationId,
      projectId: body.projectId,
      title: body.title || file?.originalname || 'Untitled',
      type: body.type,
      filePath: `uploads/documents/${file.filename}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  @Public()
  @Get(':id/file')
  async file(
    @Param('id') id: string,
    @Query('access_token') accessToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const raw = accessToken || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user = await this.documents.userFromToken(raw);
    const file = await this.documents.openFile(id, user);
    streamDiskFile(res, file.disk, file.fileName, file.mimeType);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documents.remove(id);
  }
}
