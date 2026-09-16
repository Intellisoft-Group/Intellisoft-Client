import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CmsService } from './cms.service';
import { Public, Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@Controller('cms')
export class CmsController {
  constructor(private cms: CmsService) {}

  @Public()
  @Get('bootstrap')
  bootstrap() {
    return this.cms.bootstrap();
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES)
  @Get('banners')
  banners() {
    return this.cms.banners();
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES)
  @Post('banners')
  createBanner(@Body() body: any) {
    return this.cms.createBanner(body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES)
  @Patch('banners/:id')
  updateBanner(@Param('id') id: string, @Body() body: any) {
    return this.cms.updateBanner(id, body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('banners/:id')
  deleteBanner(@Param('id') id: string) {
    return this.cms.deleteBanner(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.SUPPORT)
  @Get('announcements')
  announcements() {
    return this.cms.announcements();
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.SUPPORT)
  @Post('announcements')
  createAnnouncement(@Body() body: any) {
    return this.cms.createAnnouncement(body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.SUPPORT)
  @Patch('announcements/:id')
  updateAnnouncement(@Param('id') id: string, @Body() body: any) {
    return this.cms.updateAnnouncement(id, body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('announcements/:id')
  deleteAnnouncement(@Param('id') id: string) {
    return this.cms.deleteAnnouncement(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES)
  @Get('faqs')
  faqsAdmin() {
    return this.cms.faqs();
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES)
  @Post('faqs')
  createFaq(@Body() body: any) {
    return this.cms.createFaq(body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES)
  @Patch('faqs/:id')
  updateFaq(@Param('id') id: string, @Body() body: any) {
    return this.cms.updateFaq(id, body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES)
  @Delete('faqs/:id')
  deleteFaq(@Param('id') id: string) {
    return this.cms.deleteFaq(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('pages')
  pages() {
    return this.cms.pages();
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('pages')
  upsertPage(@Body() body: any) {
    return this.cms.upsertPage(body);
  }

  @Post('service-requests')
  requestService(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.cms.createServiceRequest(user, body);
  }

  @Get('service-requests')
  listRequests(@CurrentUser() user: AuthUser) {
    return this.cms.listServiceRequests(user);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES)
  @Patch('service-requests/:id')
  updateRequest(@Param('id') id: string, @Body() body: any) {
    return this.cms.updateServiceRequest(id, body.status);
  }
}
