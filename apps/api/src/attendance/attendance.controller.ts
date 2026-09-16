import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';

@Controller('attendance')
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.attendance.today(user.id);
  }

  @Get('desk')
  desk(@CurrentUser() user: AuthUser) {
    return this.attendance.work(user);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.attendance.mine(user.id, from, to);
  }

  @Post('punch')
  punch(@CurrentUser() user: AuthUser, @Body() body: { type: 'IN' | 'OUT'; note?: string }) {
    return this.attendance.punch(user, body.type, body.note);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('team')
  team() {
    return this.attendance.team();
  }

  @Get('leave')
  leaves(@CurrentUser() user: AuthUser) {
    return this.attendance.leaves(user);
  }

  @Post('leave')
  requestLeave(@CurrentUser() user: AuthUser, @Body() body: { fromDate: string; toDate: string; reason: string }) {
    return this.attendance.requestLeave(user.id, body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch('leave/:id')
  setLeave(@Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED' }) {
    return this.attendance.setLeave(id, body.status);
  }
}
