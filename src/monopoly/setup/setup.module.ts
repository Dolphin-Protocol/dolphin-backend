import { Module } from '@nestjs/common';
import { SetupService } from './setup.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [SetupService],
  imports: [ConfigModule],
})
export class SetupModule {}
