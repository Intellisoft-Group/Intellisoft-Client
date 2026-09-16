import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';

@Controller('projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('organizationId') organizationId?: string,
    @Query('mine') mine?: string,
  ) {
    return this.projects.list(user, organizationId, mine);
  }

  @Get(':id/files')
  files(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.files(id, user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.get(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.SUPPORT)
  @Post()
  create(@Body() body: any) {
    return this.projects.create(body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.SUPPORT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.projects.update(id, body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.SUPPORT)
  @Post(':id/milestones')
  milestone(@Param('id') id: string, @Body() body: any) {
    return this.projects.addMilestone(id, body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.SUPPORT)
  @Patch(':id/milestones/:milestoneId')
  toggle(@Param('milestoneId') milestoneId: string, @Body() body: any) {
    return this.projects.toggleMilestone(milestoneId, !!body.completed);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.SUPPORT)
  @Post(':id/updates')
  updateNote(@Param('id') id: string, @Body() body: any) {
    return this.projects.addUpdate(id, body.body);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE, Role.SALES)
  @Put(':id/payment-schedule')
  setPaymentSchedule(@Param('id') id: string, @Body() body: any) {
    return this.projects.setPaymentSchedule(id, body);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE, Role.SALES)
  @Post(':id/payment-stages/:stageId/invoice')
  issueStageInvoice(@Param('id') id: string, @Param('stageId') stageId: string, @Body() body: any) {
    return this.projects.issueStageInvoice(id, stageId, body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.projects.addMember(id, body.userId);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post(':id/members/:userId/remove')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.projects.removeMember(id, userId);
  }
}
