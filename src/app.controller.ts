import { Controller, Get, Post } from '@nestjs/common';
import { WorkflowEngineService } from './workflow/workflow-engine.service';

@Controller()
export class AppController {
  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  @Get()
  getHello(): string {
    return 'Workflow Engine API';
  }

  @Post('workflow')
  async runWorkflow(): Promise<object> {
    const workflow = [
      {
        id: 'task1',
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { result: 'Task 1 completed' };
        },
        retries: 2,
        timeoutMs: 5000
      },
      {
        id: 'task2',
        dependencies: ['task1'],
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { result: 'Task 2 completed' };
        },
        retries: 1,
        timeoutMs: 3000
      }
    ];

    const result = await this.workflowEngine.run(workflow);
    return {
      status: result.status,
      duration: result.duration,
      completedTasks: result.completedTasks,
      failedTasks: result.failedTasks,
      totalTasks: result.totalTasks
    };
  }
} 