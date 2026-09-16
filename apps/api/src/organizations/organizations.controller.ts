import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';

@Controller('organizations')
export class OrganizationsController {
  constructor(private orgs: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.orgs.list(user, q);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.FINANCE)
  @Post('ensure')
  ensure(@Body() body: { name: string; email: string; phone?: string }, @CurrentUser() user: AuthUser) {
    return this.orgs.ensureClient(body, user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orgs.get(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.FINANCE)
  @Post()
  create(@Body() body: any, @CurrentUser() user: AuthUser) {
    const data = { ...body } as any;
    if (body.salesPersonId) {
      data.salesPerson = { connect: { id: body.salesPersonId } };
      delete data.salesPersonId;
    }
    return this.orgs.create(data, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.FINANCE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    const data = { ...body } as any;
    if ('salesPersonId' in body) {
      data.salesPerson = body.salesPersonId
        ? { connect: { id: body.salesPersonId } }
        : { disconnect: true };
      delete data.salesPersonId;
    }
    return this.orgs.update(id, data);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.FINANCE)
  @Post(':id/invite')
  invite(@Param('id') id: string, @Body() body: any) {
    return this.orgs.inviteUser(id, body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.FINANCE)
  @Patch(':id/users/:userId')
  updateUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { name?: string; phone?: string | null },
  ) {
    return this.orgs.updateClientUser(id, userId, body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.FINANCE)
  @Post(':id/users/:userId/password')
  setPassword(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { password?: string; notify?: boolean },
  ) {
    return this.orgs.setClientPassword(id, userId, body);
  }
}
