import { Module } from '@nestjs/common';
import { CouncilModule } from './council/council.module';

@Module({
  imports: [CouncilModule],
})
export class AppModule {}

