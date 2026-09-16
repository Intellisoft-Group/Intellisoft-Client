import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Request, Response } from 'express';
import { ChatService } from './chat.service';
import { DocumentsService } from '../documents/documents.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Public, Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { streamDiskFile } from '../common/stream-file';
import { UPLOAD_LIMITS, attachmentFileFilter } from '../common/upload-options';

@Controller('chat')
export class ChatController {
  constructor(
    private chat: ChatService,
    private documents: DocumentsService,
  ) {}

  @Get('threads')
  threads(@CurrentUser() user: AuthUser, @Query('ensureOrg') ensureOrg?: string) {
    return this.chat.listThreads(user, ensureOrg);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.chat.unreadTotal(user);
  }

  @Get('threads/:id/messages')
  messages(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
    @Query('since') since?: string,
    @Query('q') q?: string,
  ) {
    return this.chat.messages(id, user, take ? Number(take) : 120, since, q);
  }

  @Post('threads/:id/read')
  read(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.chat.markRead(id, user);
  }

  @Post('threads/:id/messages')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'chat');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname || '.bin')}`),
      }),
      limits: { fileSize: UPLOAD_LIMITS.chat },
      fileFilter: attachmentFileFilter,
    }),
  )
  post(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const raw = body ?? (req as any).body ?? {};
    const payload =
      typeof raw === 'string'
        ? { body: raw }
        : {
            ...raw,
            body: raw.body ?? raw.message ?? raw.text ?? '',
          };
    return this.chat.post(
      id,
      user,
      payload,
      file
        ? { path: `uploads/chat/${file.filename}`, originalname: file.originalname, mimetype: file.mimetype }
        : undefined,
    );
  }

  @Public()
  @Get('files/:id')
  async file(
    @Param('id') id: string,
    @Query('access_token') accessToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const raw = accessToken || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user = await this.documents.userFromToken(raw);
    const file = await this.chat.openFile(id, user);
    streamDiskFile(res, file.disk, file.fileName, file.mimeType);
  }

  @Post('messages/:id/vote')
  vote(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: { optionId: string }) {
    return this.chat.vote(id, user, body.optionId);
  }

  @Post('messages/:id/react')
  react(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: { emoji: string }) {
    return this.chat.react(id, user, body.emoji);
  }

  @Post('messages/:id/pin')
  pin(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.chat.pin(id, user);
  }

  @Patch('messages/:id')
  edit(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: { body: string }) {
    return this.chat.edit(id, user, body.body || '');
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('messages/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.chat.remove(id, user);
  }
}
