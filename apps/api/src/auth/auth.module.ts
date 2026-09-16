import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CaptchaService } from './captcha.service';
import { JwtStrategy } from '../common/jwt.strategy';
import { requireSecret } from '../common/secrets';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireSecret('JWT_SECRET', config.get<string>('JWT_SECRET'), {
          allowDevFallback: 'dev-secret',
          context: 'AuthModule',
        }),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, CaptchaService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
