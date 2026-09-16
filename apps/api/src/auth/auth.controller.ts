import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

class LoginDto {
  @IsEmail()
  email: string;
  @IsString()
  @MinLength(6)
  password: string;
  @IsOptional()
  @IsString()
  captchaToken?: string;
  @IsOptional()
  @IsString()
  captchaAnswer?: string;
  /** When true, only CLIENT accounts may sign in (mobile client app). */
  @IsOptional()
  @IsBoolean()
  clientApp?: boolean;
}

class RefreshDto {
  @IsString()
  refreshToken: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword: string;
  @IsString()
  @MinLength(8)
  newPassword: string;
}

class ForgotDto {
  @IsEmail()
  email: string;
}

class ResetDto {
  @IsString()
  token: string;
  @IsString()
  @MinLength(8)
  password: string;
}

class PushDto {
  @IsString()
  token: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('captcha')
  captcha() {
    return this.auth.issueCaptcha();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password, {
      token: body.captchaToken,
      answer: body.captchaAnswer,
    }, body.clientApp === true);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  forgot(@Body() body: ForgotDto) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  reset(@Body() body: ResetDto) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  change(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('push-token')
  push(@CurrentUser() user: AuthUser, @Body() body: PushDto) {
    return this.auth.registerPushToken(user.id, body.token, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user.id);
  }
}
