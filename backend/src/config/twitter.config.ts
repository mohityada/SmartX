import { registerAs } from '@nestjs/config';

export const twitterConfig = registerAs('twitter', () => ({
  clientId: process.env.TWITTER_CLIENT_ID || '',
  clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
  /** AES-256-GCM key (64-char hex string = 32 bytes) for encrypting stored tokens */
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',
}));
