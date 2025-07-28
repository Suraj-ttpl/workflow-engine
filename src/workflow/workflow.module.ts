import { Module } from '@nestjs/common';
import { SimpleWorkflowEngineService } from './workflow-engine.service';

@Module({
  providers: [SimpleWorkflowEngineService],
  exports: [SimpleWorkflowEngineService],
})
export class WorkflowModule {} 