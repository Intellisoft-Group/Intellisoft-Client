import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { UPLOAD_LIMITS, imageFileFilter } from '../common/upload-options';

const avatarUpload = FileInterceptor('file', {
  storage: diskStorage({
    destination: './uploads/avatars',
    filename: (_req, file, cb) => cb(null, `${Date.now()}${extname(file.originalname || '.jpg')}`),
  }),
  limits: { fileSize: UPLOAD_LIMITS.avatar },
  fileFilter: imageFileFilter,
});

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('titles')
  titles() {
    return this.users.titles();
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('titles')
  addTitle(@Body() body: { name: string }) {
    return this.users.addTitle(body.name);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('titles/:id')
  removeTitle(@Param('id') id: string) {
    return this.users.removeTitle(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SUPPORT, Role.FINANCE, Role.SALES)
  @Get('staff')
  staff() {
    return this.users.staff();
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('staff')
  invite(@Body() body: any) {
    return this.users.inviteStaff(body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch('staff/:id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.users.updateStaff(id, body, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('staff/:id/password')
  setStaffPassword(
    @Param('id') id: string,
    @Body() body: { password?: string; notify?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.setStaffPassword(id, body, user);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() body: { name?: string; phone?: string | null }) {
    return this.users.updateMe(user, body);
  }

  @Post('me/avatar')
  @UseInterceptors(avatarUpload)
  myAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A photo is required');
    return this.users.setAvatar(user, user.id, file);
  }

  @Post(':id/avatar')
  @UseInterceptors(avatarUpload)
  avatar(@Param('id') id: string, @CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A photo is required');
    return this.users.setAvatar(user, id, file);
  }
}
