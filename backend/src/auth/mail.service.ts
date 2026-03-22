import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('mail.from') ?? 'SmartX <noreply@smartx.app>';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    this.transporter = createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: this.configService.get<number>('mail.port') === 465,
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.pass'),
      },
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Verify your SmartX email',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #111;">Verify your email</h2>
            <p>Click the button below to verify your email address and activate your SmartX account.</p>
            <a href="${verifyUrl}"
               style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Verify Email
            </a>
            <p style="color: #666; font-size: 14px;">
              Or copy and paste this link: <br/>
              <a href="${verifyUrl}">${verifyUrl}</a>
            </p>
            <p style="color: #999; font-size: 12px;">This link expires in 24 hours. If you didn't create a SmartX account, ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${email}: ${err}`);
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Reset your SmartX password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #111;">Reset your password</h2>
            <p>You requested a password reset for your SmartX account. Click the button below to set a new password.</p>
            <a href="${resetUrl}"
               style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #666; font-size: 14px;">
              Or copy and paste this link: <br/>
              <a href="${resetUrl}">${resetUrl}</a>
            </p>
            <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email — your password won't change.</p>
          </div>
        `,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}: ${err}`);
    }
  }
}
