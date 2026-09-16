import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';

@Controller('reports')
@Roles(Role.SUPER_ADMIN, Role.FINANCE)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('revenue')
  revenue() {
    return this.reports.revenue();
  }

  @Get('gst')
  gst() {
    return this.reports.gstSummary();
  }

  @Get('aging')
  aging() {
    return this.reports.aging();
  }

  @Get('services')
  services() {
    return this.reports.serviceMix();
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('sales')
  sales() {
    return this.reports.salesTracking();
  }
}
