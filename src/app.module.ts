import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngestService } from './ingest.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, IngestService],
})
export class AppModule { }
