import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { HomeService } from './home.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';

@Controller('home')
export class HomeController {
  constructor(private home: HomeService) {}

  @Roles(Role.CLIENT)
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.home.clientHome(user);
  }
}
