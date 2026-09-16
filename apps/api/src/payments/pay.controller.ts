import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { PaymentsService } from './payments.service';
import { Public } from '../common/roles.decorator';

@Controller('pay')
export class PayController {
  constructor(private payments: PaymentsService) {}

  @Public()
  @Get(':token')
  async page(@Param('token') token: string, @Res() res: Response) {
    const html = await this.payments.publicPayHtml(token);
    return res.type('html').send(html);
  }
}
