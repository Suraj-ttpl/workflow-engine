import { Module } from '@nestjs/common';
import { WorkflowModule } from './workflow/workflow.module';
import { AppController } from './app.controller';

@Module({
  imports: [WorkflowModule],
  controllers: [AppController],
})
export class AppModule {} 