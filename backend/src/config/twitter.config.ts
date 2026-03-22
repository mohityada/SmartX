import { registerAs } from '@nestjs/config';

export const twitterConfig = registerAs('twitter', () => ({
  clientId: process.env.TWITTER_CLIENT_ID || '',
  clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
  /** AES-256-GCM key (64-char hex string = 32 bytes) for encrypting stored tokens */
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',
  /** OAuth2 callback URL — must exactly match the Callback URI in the X Developer Portal */
  callbackUrl: process.env.X_OAUTH_CALLBACK_URL || '',
}));
