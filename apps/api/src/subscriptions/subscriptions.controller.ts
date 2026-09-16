import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subs: SubscriptionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('organizationId') organizationId?: string) {
    return this.subs.list(user, organizationId);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE, Role.SALES)
  @Get('renewals')
  renewals(@Query('days') days?: string) {
    return this.subs.upcomingRenewals(days ? Number(days) : 30);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.subs.get(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE, Role.SALES)
  @Post()
  create(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.subs.create(body, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE, Role.SALES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.subs.update(id, body);
  }
}
