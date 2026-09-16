import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { InvoicesService } from './invoices.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { UPLOAD_LIMITS } from '../common/upload-options';

@Controller('invoices')
export class InvoicesController {
  constructor(private invoices: InvoicesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('organizationId') organizationId?: string,
    @Query('type') type?: string,
  ) {
    return this.invoices.list(user, status, organizationId, type);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.get(id, user);
  }

  @Get(':id/pdf')
  async pdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.invoices.resolvePdfFile(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file.fileName}"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(fs.createReadStream(file.full));
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE)
  @Post(':id/pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'invoices');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const id = String(req.params.id || 'invoice');
          const ext = extname(file.originalname || '').toLowerCase() || '.pdf';
          cb(null, `${id}-${Date.now()}${ext === '.pdf' ? ext : '.pdf'}`);
        },
      }),
      limits: { fileSize: UPLOAD_LIMITS.invoicePdf },
      fileFilter: (_req, file, cb) => {
        const ok =
          (file.mimetype || '').toLowerCase() === 'application/pdf' ||
          (file.originalname || '').toLowerCase().endsWith('.pdf');
        cb(ok ? null : new BadRequestException('Only PDF files are accepted'), ok);
      },
    }),
  )
  uploadPdf(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.invoices.uploadPdf(id, file);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE, Role.SALES)
  @Post()
  create(@Body() body: any) {
    return this.invoices.create(body);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE, Role.SALES)
  @Post(':id/send')
  send(@Param('id') id: string) {
    return this.invoices.send(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE, Role.SALES)
  @Post(':id/share')
  share(@Param('id') id: string) {
    return this.invoices.share(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE)
  @Post(':id/void')
  voidInvoice(@Param('id') id: string) {
    return this.invoices.void(id);
  }
}
