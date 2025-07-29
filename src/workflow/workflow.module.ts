import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { TaskQueueService } from './services/task-queue.service';
import { ValidationService } from './services/validation.service';

@Module({
  providers: [
    WorkflowEngineService,
    TaskQueueService,
    ValidationService
  ],
  exports: [
    WorkflowEngineService,
    TaskQueueService,
    ValidationService
  ]
})
export class WorkflowModule {} 