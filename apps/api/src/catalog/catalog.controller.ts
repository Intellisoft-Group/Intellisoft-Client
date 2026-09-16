import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';

@Controller('catalog')
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('published') published?: string) {
    return this.catalog.list(user, published === 'true');
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.get(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.FINANCE)
  @Post()
  create(@Body() body: any) {
    return this.catalog.create(body);
  }

  @Roles(Role.SUPER_ADMIN, Role.SALES, Role.FINANCE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.catalog.update(id, body);
  }
}
