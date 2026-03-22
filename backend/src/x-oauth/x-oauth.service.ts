import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma';
import { TokenCryptoService } from '../posting/token-crypto.service';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface OAuthState {
  userId: string;
  codeVerifier: string;
  createdAt: number;
}

@Injectable()
export class XOAuthService {
  private readonly logger = new Logger(XOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  // In-memory state store (works for single-instance; use Redis for multi-instance)
  private readonly stateStore = new Map<string, OAuthState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {
    this.clientId = this.configService.get<string>('twitter.clientId') ?? '';
    this.clientSecret =
      this.configService.get<string>('twitter.clientSecret') ?? '';
    this.callbackUrl =
      this.configService.get<string>('twitter.callbackUrl') ??
      'http://localhost:3000/api/x-oauth/callback';
  }

  /**
   * Generate the X OAuth2 authorization URL with PKCE.
   */
  getAuthorizationUrl(userId: string): string {
    if (!this.clientId) {
      throw new Error(
        'TWITTER_CLIENT_ID is not configured. Set it in your environment variables.',
      );
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Store state → userId + codeVerifier mapping
    this.stateStore.set(state, {
      userId,
      codeVerifier,
      createdAt: Date.now(),
    });

    // Clean up expired states
    this.cleanupExpiredStates();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Handle the OAuth callback: exchange code for tokens, store the X account.
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ userId: string; xAccountId: string; xUsername: string }> {
    // Validate state
    const oauthState = this.stateStore.get(state);
    if (!oauthState) {
      throw new UnauthorizedException(
        'Invalid or expired OAuth state. Please try connecting again.',
      );
    }

    // Check expiry
    if (Date.now() - oauthState.createdAt > OAUTH_STATE_TTL_MS) {
      this.stateStore.delete(state);
      throw new UnauthorizedException(
        'OAuth state has expired. Please try connecting again.',
      );
    }

    // Remove state (one-time use)
    this.stateStore.delete(state);

    const { userId, codeVerifier } = oauthState;

    // Exchange authorization code for tokens
    const tokenResponse = await this.exchangeCodeForTokens(code, codeVerifier);

    // Fetch user info from X API
    const xUser = await this.fetchXUserInfo(tokenResponse.access_token);

    // Encrypt tokens
    const accessTokenEnc = this.tokenCrypto.encrypt(tokenResponse.access_token);
    const refreshTokenEnc = this.tokenCrypto.encrypt(
      tokenResponse.refresh_token,
    );

    const tokenExpiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    // Upsert X account (update tokens if the same X user reconnects)
    const xAccount = await this.prisma.xAccount.upsert({
      where: { xUserId: xUser.id },
      update: {
        userId,
        xUsername: xUser.username,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
      },
      create: {
        userId,
        xUserId: xUser.id,
        xUsername: xUser.username,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
      },
    });

    this.logger.log(
      `Linked X account @${xUser.username} (${xUser.id}) to user ${userId}`,
    );

    return {
      userId,
      xAccountId: xAccount.id,
      xUsername: xUser.username,
    };
  }

  /**
   * List all X accounts for a user.
   */
  async listXAccounts(userId: string) {
    return this.prisma.xAccount.findMany({
      where: { userId },
      select: {
        id: true,
        xUserId: true,
        xUsername: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { bots: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Disconnect (delete) an X account.
   */
  async disconnectXAccount(xAccountId: string, userId: string): Promise<void> {
    const account = await this.prisma.xAccount.findUnique({
      where: { id: xAccountId },
    });

    if (!account) {
      throw new NotFoundException('X account not found');
    }
    if (account.userId !== userId) {
      throw new ForbiddenException();
    }

    // Unlink bots first (set xAccountId to null)
    await this.prisma.bot.updateMany({
      where: { xAccountId },
      data: { xAccountId: null },
    });

    await this.prisma.xAccount.delete({
      where: { id: xAccountId },
    });

    this.logger.log(
      `Disconnected X account @${account.xUsername} from user ${userId}`,
    );
  }

  /**
   * Link an X account to a bot.
   */
  async linkXAccountToBot(
    botId: string,
    xAccountId: string,
    userId: string,
  ): Promise<void> {
    // Verify bot ownership
    const bot = await this.prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) throw new NotFoundException('Bot not found');
    if (bot.userId !== userId) throw new ForbiddenException();

    // Verify X account ownership
    const xAccount = await this.prisma.xAccount.findUnique({
      where: { id: xAccountId },
    });
    if (!xAccount) throw new NotFoundException('X account not found');
    if (xAccount.userId !== userId) throw new ForbiddenException();

    await this.prisma.bot.update({
      where: { id: botId },
      data: { xAccountId },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  }> {
    const basicAuth = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: this.clientId,
        redirect_uri: this.callbackUrl,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `Token exchange failed: ${response.status} ${errorBody}`,
      );
      throw new UnauthorizedException(
        'Failed to exchange authorization code. Please try again.',
      );
    }

    return response.json();
  }

  private async fetchXUserInfo(
    accessToken: string,
  ): Promise<{ id: string; username: string }> {
    const response = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=id,username',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `User info fetch failed: ${response.status} ${errorBody}`,
      );
      throw new UnauthorizedException(
        'Failed to retrieve X account information.',
      );
    }

    const json = await response.json();
    return json.data;
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [key, value] of this.stateStore.entries()) {
      if (now - value.createdAt > OAUTH_STATE_TTL_MS) {
        this.stateStore.delete(key);
      }
    }
  }
}
