import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { TicketsService } from './tickets.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { UPLOAD_LIMITS, attachmentFileFilter } from '../common/upload-options';
import { streamDiskFile } from '../common/stream-file';

@Controller('tickets')
export class TicketsController {
  constructor(private tickets: TicketsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string, @Query('mine') mine?: string) {
    return this.tickets.list(user, status, mine);
  }

  /** Must stay above :id so "files" is not treated as a ticket id. */
  @Get('files/:messageId')
  async file(
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const file = await this.tickets.openAttachment(messageId, user);
    streamDiskFile(res, file.disk, file.fileName, file.mimeType);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.get(id, user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.tickets.create(user, body);
  }

  @Post(':id/messages')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/tickets',
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: UPLOAD_LIMITS.ticket },
      fileFilter: attachmentFileFilter,
    }),
  )
  reply(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const attachment = file ? `uploads/tickets/${file.filename}` : undefined;
    return this.tickets.reply(id, user, body.body, attachment);
  }

  @Roles(Role.SUPER_ADMIN, Role.SUPPORT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.tickets.update(id, body);
  }
}
