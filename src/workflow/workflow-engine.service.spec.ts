import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from './workflow-engine.service';
import { TaskQueueService } from './services/task-queue.service';
import { ValidationService } from './services/validation.service';
import { Task } from './dto/task.interface';
import { TaskEvent, TaskEventType } from './dto/task.enum';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        TaskQueueService,
        ValidationService
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
  });

  describe('Sequential Task Execution', () => {
    it('should execute single task successfully', async () => {
      const workflow: Task[] = [{
        id: 'testTask',
        handler: () => Promise.resolve('success'),
        retries: 1,
        timeoutMs: 1000
      }];
      
      const result = await service.run(workflow);
      
      expect(result.status).toBe('COMPLETED');
      expect(result.tasks['testTask']?.status).toBe('COMPLETED');
      expect(result.tasks['testTask']?.result).toBe('success');
      expect(result.completedTasks).toBe(1);
      expect(result.failedTasks).toBe(0);
    });

    it('should execute tasks in dependency order', async () => {
      const executionOrder: string[] = [];
      const workflow: Task[] = [
        {
          id: 'taskA',
          handler: () => {
            executionOrder.push('A');
            return Promise.resolve();
          }
        },
        {
          id: 'taskB',
          dependencies: ['taskA'],
          handler: () => {
            executionOrder.push('B');
            return Promise.resolve();
          }
        },
        {
          id: 'taskC',
          dependencies: ['taskB'],
          handler: () => {
            executionOrder.push('C');
            return Promise.resolve();
          }
        }
      ];
      
      await service.run(workflow);
      expect(executionOrder).toEqual(['A', 'B', 'C']);
    });

    it('should handle task failure and retry', async () => {
      let attempts = 0;
      const workflow: Task[] = [{
        id: 'failingTask',
        handler: () => {
          attempts++;
          if (attempts < 3) throw new Error('Temporary failure');
          return Promise.resolve('success');
        },
        retries: 2,
        timeoutMs: 1000
      }];
      
      const result = await service.run(workflow);
      
      expect(attempts).toBe(3);
      expect(result.tasks['failingTask']?.status).toBe('COMPLETED');
      expect(result.tasks['failingTask']?.attempts).toBe(3);
    });

    it('should fail task after max retries exceeded', async () => {
      const workflow: Task[] = [{
        id: 'permanentlyFailingTask',
        handler: () => Promise.reject(new Error('Permanent failure')),
        retries: 2,
        timeoutMs: 1000
      }];
      
      const result = await service.run(workflow);
      
      expect(result.status).toBe('FAILED');
      expect(result.tasks['permanentlyFailingTask']?.status).toBe('FAILED');
      expect(result.tasks['permanentlyFailingTask']?.attempts).toBe(3);
      expect(result.tasks['permanentlyFailingTask']?.error).toContain('Permanent failure');
    });

    it('should enforce task timeout', async () => {
      const workflow: Task[] = [{
        id: 'slowTask',
        handler: () => new Promise(resolve => setTimeout(resolve, 1000)),
        timeoutMs: 100
      }];
      
      const result = await service.run(workflow);
      
      expect(result.status).toBe('FAILED');
      expect(result.tasks['slowTask']?.status).toBe('FAILED');
      expect(result.tasks['slowTask']?.error).toContain('timed out');
    });
  });

  describe('Dependency Handling', () => {
    it('should skip dependent tasks when dependency fails', async () => {
      const workflow: Task[] = [
        {
          id: 'failingTask',
          handler: () => Promise.reject(new Error('Dependency failed')),
          retries: 0
        },
        {
          id: 'dependentTask',
          dependencies: ['failingTask'],
          handler: () => Promise.resolve('should not execute')
        }
      ];
      
      const result = await service.run(workflow);
      
      expect(result.status).toBe('FAILED');
      expect(result.tasks['failingTask']?.status).toBe('FAILED');
      expect(result.tasks['dependentTask']?.status).toBe('SKIPPED');
    });

    it('should skip tasks when dependencies are not completed', async () => {
      const workflow: Task[] = [
        {
          id: 'taskA',
          handler: () => Promise.resolve('A')
        },
        {
          id: 'taskB',
          dependencies: ['taskA'],
          handler: () => Promise.resolve('B')
        },
        {
          id: 'taskC',
          dependencies: ['taskB'],
          handler: () => Promise.resolve('C')
        }
      ];
      
      const result = await service.run(workflow);
      
      expect(result.status).toBe('COMPLETED');
      expect(result.tasks['taskA']?.status).toBe('COMPLETED');
      expect(result.tasks['taskB']?.status).toBe('COMPLETED');
      expect(result.tasks['taskC']?.status).toBe('COMPLETED');
    });
  });

  describe('Event Emission', () => {
    it('should emit task events', async () => {
      const events: TaskEvent[] = [];
      const workflow: Task[] = [{
        id: 'testTask',
        handler: () => Promise.resolve('success')
      }];
      
      service.on('taskEvent', (event: TaskEvent) => {
        events.push(event);
      });
      
      await service.run(workflow);
      
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.type).toBe(TaskEventType.TASK_STARTED);
      expect(events[0]?.taskId).toBe('testTask');
    });

    it('should emit retry events', async () => {
      let attempts = 0;
      const events: TaskEvent[] = [];
      const workflow: Task[] = [{
        id: 'retryTask',
        handler: () => {
          attempts++;
          if (attempts < 2) throw new Error('Retry needed');
          return Promise.resolve('success');
        },
        retries: 1
      }];
      
      service.on('taskEvent', (event: TaskEvent) => {
        events.push(event);
      });
      
      await service.run(workflow);
      
      const retryEvents = events.filter(e => e.type === TaskEventType.TASK_RETRY);
      expect(retryEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Statistics', () => {
    it('should provide accurate workflow statistics', async () => {
      const workflow: Task[] = [
        {
          id: 'successTask',
          handler: () => Promise.resolve('success')
        },
        {
          id: 'failingTask',
          handler: () => Promise.reject(new Error('Failed')),
          retries: 0
        }
      ];
      
      const result = await service.run(workflow);
      
      expect(result.totalTasks).toBe(2);
      expect(result.completedTasks).toBe(1);
      expect(result.failedTasks).toBe(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Patient Onboarding Workflow', () => {
    it('should complete patient onboarding workflow successfully', async () => {
      const workflow: Task[] = [
        {
          id: 'validatePatientInformation',
          handler: () => Promise.resolve({ valid: true })
        },
        {
          id: 'createDatabaseRecord',
          dependencies: ['validatePatientInformation'],
          handler: () => Promise.resolve({ recordId: '123' })
        },
        {
          id: 'seedDatabaseForPatient',
          dependencies: ['createDatabaseRecord'],
          handler: () => Promise.resolve({ seeded: true })
        },
        {
          id: 'sendWelcomeEmail',
          dependencies: ['seedDatabaseForPatient'],
          handler: () => Promise.resolve({ emailSent: true })
        }
      ];
      
      const result = await service.run(workflow);
      
      expect(result.status).toBe('COMPLETED');
      expect(result.completedTasks).toBe(4);
      expect(result.failedTasks).toBe(0);
    });

    it('should fail workflow when database creation fails permanently', async () => {
      const workflow: Task[] = [
        {
          id: 'validatePatientInformation',
          handler: () => Promise.resolve({ valid: true })
        },
        {
          id: 'createDatabaseRecord',
          dependencies: ['validatePatientInformation'],
          handler: () => Promise.reject(new Error('Database connection failed')),
          retries: 0
        },
        {
          id: 'sendWelcomeEmail',
          dependencies: ['createDatabaseRecord'],
          handler: () => Promise.resolve({ emailSent: true })
        }
      ];
      
      const result = await service.run(workflow);
      
      expect(result.status).toBe('FAILED');
      expect(result.tasks['validatePatientInformation']?.status).toBe('COMPLETED');
      expect(result.tasks['createDatabaseRecord']?.status).toBe('FAILED');
      expect(result.tasks['sendWelcomeEmail']?.status).toBe('SKIPPED');
    });
  });
}); 