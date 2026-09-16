import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { requireSecret } from '../common/secrets';

const TTL_MS = 2 * 60 * 1000;
const MAX_USED = 4000;

@Injectable()
export class CaptchaService {
  private used = new Map<string, number>();

  constructor(private config: ConfigService) {}

  issue() {
    this.gc();
    const left = randomInt(6, 20);
    const right = randomInt(2, 13);
    const minus = randomInt(0, 2) === 1 && left > right;
    const answer = minus ? left - right : left + right;
    const question = minus ? `${left} − ${right}` : `${left} + ${right}`;
    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + TTL_MS;
    const token = this.sign(nonce, exp, answer);
    return { question, token, expiresIn: Math.floor(TTL_MS / 1000) };
  }

  assert(token?: string, answer?: string) {
    if (!token || !answer?.trim()) {
      throw new BadRequestException('Complete the security check');
    }
    const parts = token.split('.');
    if (parts.length !== 3) throw new BadRequestException('Security check expired. Try a new code.');
    const [nonce, expRaw, sig] = parts;
    const exp = Number(expRaw);
    if (!nonce || !sig || !Number.isFinite(exp) || exp < Date.now()) {
      throw new BadRequestException('Security check expired. Try a new code.');
    }
    if (this.used.has(nonce)) {
      throw new BadRequestException('Security check already used. Try a new code.');
    }
    const parsed = Number(String(answer).replace(/[^\d-]/g, ''));
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('Enter the number shown in the security check');
    }
    const expected = this.sign(nonce, exp, parsed);
    if (!this.same(token, expected)) {
      this.used.set(nonce, exp);
      throw new BadRequestException('Security check is incorrect. Try a new code.');
    }
    this.used.set(nonce, exp);
  }

  private sign(nonce: string, exp: number, answer: number) {
    const secret = requireSecret(
      'CAPTCHA_SECRET',
      this.config.get<string>('CAPTCHA_SECRET') || this.config.get<string>('JWT_SECRET'),
      { allowDevFallback: 'dev-captcha', context: 'CaptchaService' },
    );
    const body = `${nonce}.${exp}.${answer}`;
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${nonce}.${exp}.${sig}`;
  }

  private same(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  private gc() {
    const now = Date.now();
    for (const [nonce, exp] of this.used) {
      if (exp < now) this.used.delete(nonce);
    }
    if (this.used.size > MAX_USED) {
      const extra = [...this.used.keys()].slice(0, this.used.size - MAX_USED);
      extra.forEach((n) => this.used.delete(n));
    }
  }
}
