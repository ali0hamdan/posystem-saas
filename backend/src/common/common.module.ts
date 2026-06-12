import { Global, Module } from '@nestjs/common';
import { PlanLimitService } from './services/plan-limit.service';
import { DocumentNumberingService } from './services/document-numbering.service';

@Global()
@Module({
  providers: [PlanLimitService, DocumentNumberingService],
  exports: [PlanLimitService, DocumentNumberingService],
})
export class CommonModule {}
