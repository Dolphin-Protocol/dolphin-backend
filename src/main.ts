import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';

const httpsOptions = {
  key: fs.readFileSync('./server.key'),
  cert: fs.readFileSync('./server.cert'),
};
console.log(httpsOptions);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });
  await app.listen(3003);
}
bootstrap();
