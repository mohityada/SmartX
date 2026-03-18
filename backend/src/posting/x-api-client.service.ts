import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitterApi } from 'twitter-api-v2';
import { PrismaService } from '../common/prisma';
import { TokenCryptoService } from './token-crypto.service';

export interface XApiPostResult {
  xTweetId: string;
}

/**
 * Wraps twitter-api-v2 with token decryption and automatic refresh.
 * Each call gets a client scoped to a specific X account.
 */
@Injectable()
export class XApiClientService {
  private readonly logger = new Logger(XApiClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  /**
   * Post a tweet to X using the given account's stored tokens.
   * Automatically refreshes the OAuth2 token if it has expired.
   */
  async postTweet(xAccountId: string, text: string): Promise<XApiPostResult> {
    const xAccount = await this.prisma.xAccount.findUniqueOrThrow({
      where: { id: xAccountId },
    });

    let accessToken = this.tokenCrypto.decrypt(xAccount.accessTokenEnc);

    // Check if the token is expired (or about to expire in 60s)
    const isExpired =
      xAccount.tokenExpiresAt &&
      xAccount.tokenExpiresAt.getTime() < Date.now() + 60_000;

    if (isExpired) {
      accessToken = await this.refreshToken(xAccount.id, xAccount.refreshTokenEnc);
    }

    const client = new TwitterApi(accessToken);
    const result = await client.v2.tweet(text);

    this.logger.log(
      `Posted tweet ${result.data.id} via X account ${xAccount.xUsername}`,
    );

    return { xTweetId: result.data.id };
  }

  /**
   * Refresh the OAuth2 token using the stored refresh token.
   * Updates the DB with the new encrypted tokens.
   */
  private async refreshToken(
    xAccountId: string,
    refreshTokenEnc: string,
  ): Promise<string> {
    const clientId = this.configService.get<string>('twitter.clientId')!;
    const clientSecret = this.configService.get<string>('twitter.clientSecret')!;

    const refreshToken = this.tokenCrypto.decrypt(refreshTokenEnc);

    const client = new TwitterApi({
      clientId,
      clientSecret,
    });

    const {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    } = await client.refreshOAuth2Token(refreshToken);

    const expiresAt = new Date(Date.now() + (expiresIn ?? 7200) * 1000);

    await this.prisma.xAccount.update({
      where: { id: xAccountId },
      data: {
        accessTokenEnc: this.tokenCrypto.encrypt(newAccessToken),
        refreshTokenEnc: newRefreshToken
          ? this.tokenCrypto.encrypt(newRefreshToken)
          : undefined,
        tokenExpiresAt: expiresAt,
      },
    });

    this.logger.log(`Refreshed OAuth2 token for X account ${xAccountId}`);
    return newAccessToken;
  }
}
