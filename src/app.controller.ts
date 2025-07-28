import { Controller, Post, Body } from '@nestjs/common';
import { SimpleWorkflowEngineService } from './workflow/workflow-engine.service';
import { Task } from './workflow/dto/task.interface';

@Controller('workflow')
export class AppController {
  constructor(
    private readonly simpleWorkflowEngineService: SimpleWorkflowEngineService
  ) {}

  @Post('run')
  async runWorkflow(@Body() workflow: Task[]) {
      return await this.simpleWorkflowEngineService.run(workflow);
  }
} 