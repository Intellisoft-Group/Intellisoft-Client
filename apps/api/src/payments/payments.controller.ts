import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('organizationId') organizationId?: string) {
    return this.payments.list(user, organizationId);
  }

  @Post('invoices/:invoiceId/pay')
  startPay(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { amount?: number },
  ) {
    return this.payments.startPay(invoiceId, user, body?.amount);
  }

  @Roles(Role.SUPER_ADMIN, Role.FINANCE)
  @Post('invoices/:invoiceId/offline')
  offline(@Param('invoiceId') invoiceId: string, @Body() body: any) {
    return this.payments.markOffline(invoiceId, body);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.cancel(id, user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.get(id, user);
  }
}
