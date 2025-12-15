import { Module } from '@nestjs/common';
import { CouncilController } from './council.controller';
import { CouncilService } from './council.service';
import { CouncilStatusService } from './council-status.service';
import { OpenRouterService } from '../common/openrouter.service';

@Module({
  controllers: [CouncilController],
  providers: [CouncilService, CouncilStatusService, OpenRouterService],
  exports: [CouncilService, CouncilStatusService],
})
export class CouncilModule {}

