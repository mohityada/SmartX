import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma';
import { RegisterDto, AuthTokensDto } from './dto';
import { MailService } from './mail.service';

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  private readonly refreshExpiration: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.refreshExpiration =
      this.configService.get<string>('jwt.refreshExpiration') ?? '7d';
  }

  async register(dto: RegisterDto): Promise<AuthTokensDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
      },
    });

    // Send verification email (fire-and-forget)
    this.sendVerificationToken(user.id, user.email);

    return this.generateTokens(user.id, user.email);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) return null;

    return { id: user.id, email: user.email };
  }

  login(user: { id: string; email: string }): AuthTokensDto {
    return this.generateTokens(user.id, user.email);
  }

  async refreshToken(userId: string): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.generateTokens(user.id, user.email);
  }

  // ── Email Verification ────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<void> {
    const authToken = await this.prisma.authToken.findUnique({
      where: { token },
    });

    if (
      !authToken ||
      authToken.type !== 'email_verification' ||
      authToken.usedAt ||
      authToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: authToken.userId },
        data: { emailVerified: true },
      }),
      this.prisma.authToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.emailVerified) throw new BadRequestException('Email already verified');

    await this.sendVerificationToken(user.id, user.email);
  }

  // ── Forgot / Reset Password ───────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) return;

    const token = crypto.randomBytes(32).toString('base64url');
    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        token,
        type: 'password_reset',
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    await this.mailService.sendPasswordResetEmail(user.email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const authToken = await this.prisma.authToken.findUnique({
      where: { token },
    });

    if (
      !authToken ||
      authToken.type !== 'password_reset' ||
      authToken.usedAt ||
      authToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: authToken.userId },
        data: { passwordHash },
      }),
      this.prisma.authToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async sendVerificationToken(
    userId: string,
    email: string,
  ): Promise<void> {
    const token = crypto.randomBytes(32).toString('base64url');
    await this.prisma.authToken.create({
      data: {
        userId,
        token,
        type: 'email_verification',
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    });
    await this.mailService.sendVerificationEmail(email, token);
  }

  private generateTokens(userId: string, email: string): AuthTokensDto {
    const payload = { sub: userId, email };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: this.refreshExpiration as any,
      }),
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  private async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
      });
    });
  }
}
