import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { XOAuthController } from './x-oauth.controller';
import { XOAuthService } from './x-oauth.service';
import { TokenCryptoService } from '../posting/token-crypto.service';

@Module({
  imports: [ConfigModule],
  controllers: [XOAuthController],
  providers: [XOAuthService, TokenCryptoService],
  exports: [XOAuthService],
})
export class XOAuthModule {}
