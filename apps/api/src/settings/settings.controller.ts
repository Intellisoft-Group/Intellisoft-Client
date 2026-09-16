import { Body, Controller, Get, Header, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Public, Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Public()
  @Get('public')
  publicSettings() {
    return this.settings.getPublic();
  }

  /** Authenticated clients + staff — bank account for invoice settlement (always fresh from CMS). */
  @Get('payment')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  paymentDetails() {
    return this.settings.getPaymentDetails();
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE)
  @Get()
  get() {
    return this.settings.get();
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE)
  @Patch()
  update(@Body() body: any) {
    return this.settings.update(body);
  }
}
