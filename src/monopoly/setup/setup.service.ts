import { Injectable } from '@nestjs/common';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SetupService {
  private suiClient: SuiClient;
  constructor(private configService: ConfigService) {
    this.suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  }

  getSuiClient() {
    return this.suiClient;
  }

  async loadKeypair() {
    const privateKey = this.configService.get('ADMIN_PRIVATE_KEY');
    const player1PrivateKey = this.configService.get('PLAYER_1_PRIVATE_KEY');
    const player2PrivateKey = this.configService.get('PLAYER_2_PRIVATE_KEY');

    const { secretKey: adminSecretKey } = decodeSuiPrivateKey(privateKey);
    const admin = Ed25519Keypair.fromSecretKey(adminSecretKey);

    const { secretKey: player1SecretKey } =
      decodeSuiPrivateKey(player1PrivateKey);
    const player1 = Ed25519Keypair.fromSecretKey(player1SecretKey);

    const { secretKey: player2SecretKey } =
      decodeSuiPrivateKey(player2PrivateKey);
    const player2 = Ed25519Keypair.fromSecretKey(player2SecretKey);

    return {
      admin,
      player1,
      player2,
    };
  }
}
