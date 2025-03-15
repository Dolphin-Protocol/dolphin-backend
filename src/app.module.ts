import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MonopolyModule } from './monopoly/monopoly.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    //sqlite
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db.sqlite',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
    }),
    MonopolyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
