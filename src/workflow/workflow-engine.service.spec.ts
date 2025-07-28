import { Test, TestingModule } from '@nestjs/testing';
import { SimpleWorkflowEngineService } from './workflow-engine.service';
import { Task } from './dto/task.interface';
import { TaskEventType } from './dto/task.enum';

describe('SimpleWorkflowEngineService', () => {
  let service: SimpleWorkflowEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SimpleWorkflowEngineService],
    }).compile();

    service = module.get<SimpleWorkflowEngineService>(SimpleWorkflowEngineService);
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
      expect(result.tasks.testTask.status).toBe('COMPLETED');
      expect(result.tasks.testTask.result).toBe('success');
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
      expect(result.tasks.failingTask.status).toBe('COMPLETED');
      expect(result.tasks.failingTask.attempts).toBe(3);
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
      expect(result.tasks.permanentlyFailingTask.status).toBe('FAILED');
      expect(result.tasks.permanentlyFailingTask.attempts).toBe(3); // Initial + 2 retries
      expect(result.tasks.permanentlyFailingTask.error).toContain('Permanent failure');
    });

    it('should enforce task timeout', async () => {
      const workflow: Task[] = [{
        id: 'slowTask',
        handler: () => new Promise(resolve => setTimeout(resolve, 2000)),
        retries: 0,
        timeoutMs: 500
      }];
      
      const result = await service.run(workflow);
      
      expect(result.tasks.slowTask.status).toBe('FAILED');
      expect(result.tasks.slowTask.error).toContain('timeout');
    });
  });

  describe('Dependency Handling', () => {
    it('should skip dependent tasks when dependency fails', async () => {
      const workflow: Task[] = [
        {
          id: 'taskA',
          handler: () => Promise.resolve('success')
        },
        {
          id: 'taskB',
          dependencies: ['taskA'],
          handler: () => Promise.reject(new Error('Task B fails')),
          retries: 0
        },
        {
          id: 'taskC',
          dependencies: ['taskB'],
          handler: () => Promise.resolve('success')
        }
      ];
      
      const result = await service.run(workflow);
      
      expect(result.tasks.taskA.status).toBe('COMPLETED');
      expect(result.tasks.taskB.status).toBe('FAILED');
      expect(result.tasks.taskC.status).toBe('SKIPPED');
    });

    it('should skip tasks when dependencies are not completed', async () => {
      const workflow: Task[] = [
        {
          id: 'taskA',
          handler: () => Promise.reject(new Error('Task A fails')),
          retries: 0
        },
        {
          id: 'taskB',
          dependencies: ['taskA'],
          handler: () => Promise.resolve('success')
        }
      ];
      
      const result = await service.run(workflow);
      
      expect(result.tasks.taskA.status).toBe('FAILED');
      expect(result.tasks.taskB.status).toBe('SKIPPED');
    });
  });

  describe('Circular Dependencies', () => {
    it('should throw error for circular dependencies', async () => {
      const workflow: Task[] = [
        {
          id: 'taskA',
          dependencies: ['taskB'],
          handler: () => Promise.resolve()
        },
        {
          id: 'taskB',
          dependencies: ['taskA'],
          handler: () => Promise.resolve()
        }
      ];
      
      await expect(service.run(workflow)).rejects.toThrow('Circular dependencies detected');
    });
  });

  describe('Patient Onboarding Workflow', () => {
    it('should execute patient onboarding workflow successfully', async () => {
      const workflow: Task[] = [
        {
          id: 'validatePatientInformation',
          handler: () => Promise.resolve({ valid: true, patientName: 'John Doe' }),
          retries: 2,
          timeoutMs: 3000
        },
        {
          id: 'createDatabaseRecord',
          dependencies: ['validatePatientInformation'],
          handler: () => Promise.resolve({ patientId: 'PAT123', recordId: 'REC456' }),
          retries: 1,
          timeoutMs: 2000
        },
        {
          id: 'seedDatabaseForPatient',
          dependencies: ['createDatabaseRecord'],
          handler: () => Promise.resolve({ seeded: true, historyCount: 5 }),
          retries: 2,
          timeoutMs: 4000
        },
        {
          id: 'sendWelcomeEmail',
          dependencies: ['seedDatabaseForPatient'],
          handler: () => Promise.resolve({ sent: true, emailId: 'EMAIL789' }),
          retries: 3,
          timeoutMs: 2000
        }
      ];
      
      const result = await service.run(workflow);
      
      expect(result.status).toBe('COMPLETED');
      expect(result.tasks.validatePatientInformation.status).toBe('COMPLETED');
      expect(result.tasks.createDatabaseRecord.status).toBe('COMPLETED');
      expect(result.tasks.seedDatabaseForPatient.status).toBe('COMPLETED');
      expect(result.tasks.sendWelcomeEmail.status).toBe('COMPLETED');
      expect(result.completedTasks).toBe(4);
      expect(result.failedTasks).toBe(0);
    });

    it('should handle validation failure with retries', async () => {
      let validationAttempts = 0;
      const workflow: Task[] = [
        {
          id: 'validatePatientInformation',
          handler: () => {
            validationAttempts++;
            if (validationAttempts < 3) throw new Error('Invalid patient data');
            return Promise.resolve({ valid: true });
          },
          retries: 2,
          timeoutMs: 3000
        },
        {
          id: 'createDatabaseRecord',
          dependencies: ['validatePatientInformation'],
          handler: () => Promise.resolve({ patientId: 'PAT123' })
        }
      ];

      const result = await service.run(workflow);
      
      expect(validationAttempts).toBe(3);
      expect(result.tasks.validatePatientInformation.status).toBe('COMPLETED');
      expect(result.tasks.createDatabaseRecord.status).toBe('COMPLETED');
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
          retries: 1,
          timeoutMs: 2000
        },
        {
          id: 'seedDatabaseForPatient',
          dependencies: ['createDatabaseRecord'],
          handler: () => Promise.resolve({ seeded: true })
        },
        {
          id: 'sendWelcomeEmail',
          dependencies: ['seedDatabaseForPatient'],
          handler: () => Promise.resolve({ sent: true })
        }
      ];

      const result = await service.run(workflow);
      
      expect(result.status).toBe('FAILED');
      expect(result.tasks.validatePatientInformation.status).toBe('COMPLETED');
      expect(result.tasks.createDatabaseRecord.status).toBe('FAILED');
      expect(result.tasks.seedDatabaseForPatient.status).toBe('SKIPPED');
      expect(result.tasks.sendWelcomeEmail.status).toBe('SKIPPED');
    });

    it('should handle seeding timeout', async () => {
      const workflow: Task[] = [
        {
          id: 'validatePatientInformation',
          handler: () => Promise.resolve({ valid: true })
        },
        {
          id: 'createDatabaseRecord',
          dependencies: ['validatePatientInformation'],
          handler: () => Promise.resolve({ patientId: 'PAT123' })
        },
        {
          id: 'seedDatabaseForPatient',
          dependencies: ['createDatabaseRecord'],
          handler: () => new Promise(resolve => setTimeout(resolve, 5000)),
          retries: 1,
          timeoutMs: 1000
        },
        {
          id: 'sendWelcomeEmail',
          dependencies: ['seedDatabaseForPatient'],
          handler: () => Promise.resolve({ sent: true })
        }
      ];

      const result = await service.run(workflow);
      
      expect(result.tasks.seedDatabaseForPatient.status).toBe('FAILED');
      expect(result.tasks.seedDatabaseForPatient.error).toContain('timeout');
      expect(result.tasks.sendWelcomeEmail.status).toBe('SKIPPED');
    });
  });

  describe('Event System', () => {
    it('should emit lifecycle events for each task', async () => {
      const events: any[] = [];
      service.on('taskEvent', (event) => {
        events.push(event);
      });

      const workflow: Task[] = [{
        id: 'testTask',
        handler: () => Promise.resolve('success'),
        retries: 1,
        timeoutMs: 1000
      }];

      await service.run(workflow);

      expect(events).toHaveLength(2); // STARTED + COMPLETED
      expect(events[0].type).toBe(TaskEventType.TASK_STARTED);
      expect(events[0].taskId).toBe('testTask');
      expect(events[1].type).toBe(TaskEventType.TASK_COMPLETED);
      expect(events[1].taskId).toBe('testTask');
    });

    it('should emit retry events on failure', async () => {
      const events: any[] = [];
      service.on('taskEvent', (event) => {
        events.push(event);
      });

      let attempts = 0;
      const workflow: Task[] = [{
        id: 'failingTask',
        handler: () => {
          attempts++;
          if (attempts < 2) throw new Error('Temporary failure');
          return Promise.resolve('success');
        },
        retries: 1,
        timeoutMs: 1000
      }];

      await service.run(workflow);

      const retryEvents = events.filter(e => e.type === TaskEventType.TASK_RETRY);
      expect(retryEvents).toHaveLength(1);
      expect(retryEvents[0].attempt).toBe(1);
    });

    it('should emit events for patient onboarding workflow', async () => {
      const events: any[] = [];
      service.on('taskEvent', (event) => {
        events.push(event);
      });

      const workflow: Task[] = [
        {
          id: 'validatePatientInformation',
          handler: () => Promise.resolve({ valid: true })
        },
        {
          id: 'createDatabaseRecord',
          dependencies: ['validatePatientInformation'],
          handler: () => Promise.resolve({ patientId: 'PAT123' })
        },
        {
          id: 'seedDatabaseForPatient',
          dependencies: ['createDatabaseRecord'],
          handler: () => Promise.resolve({ seeded: true })
        },
        {
          id: 'sendWelcomeEmail',
          dependencies: ['seedDatabaseForPatient'],
          handler: () => Promise.resolve({ sent: true })
        }
      ];

      await service.run(workflow);

      // Should have 8 events: 4 STARTED + 4 COMPLETED
      expect(events).toHaveLength(8);
      
      // Check event sequence
      expect(events[0].type).toBe(TaskEventType.TASK_STARTED);
      expect(events[0].taskId).toBe('validatePatientInformation');
      expect(events[1].type).toBe(TaskEventType.TASK_COMPLETED);
      expect(events[1].taskId).toBe('validatePatientInformation');
      
      expect(events[2].type).toBe(TaskEventType.TASK_STARTED);
      expect(events[2].taskId).toBe('createDatabaseRecord');
      expect(events[3].type).toBe(TaskEventType.TASK_COMPLETED);
      expect(events[3].taskId).toBe('createDatabaseRecord');
      
      expect(events[4].type).toBe(TaskEventType.TASK_STARTED);
      expect(events[4].taskId).toBe('seedDatabaseForPatient');
      expect(events[5].type).toBe(TaskEventType.TASK_COMPLETED);
      expect(events[5].taskId).toBe('seedDatabaseForPatient');
      
      expect(events[6].type).toBe(TaskEventType.TASK_STARTED);
      expect(events[6].taskId).toBe('sendWelcomeEmail');
      expect(events[7].type).toBe(TaskEventType.TASK_COMPLETED);
      expect(events[7].taskId).toBe('sendWelcomeEmail');
    });
  });

  describe('Workflow Statistics', () => {
    it('should provide accurate workflow statistics', async () => {
      const workflow: Task[] = [
        {
          id: 'task1',
          handler: () => Promise.resolve('success')
        },
        {
          id: 'task2',
          dependencies: ['task1'],
          handler: () => Promise.reject(new Error('Task 2 fails')),
          retries: 0
        },
        {
          id: 'task3',
          dependencies: ['task2'],
          handler: () => Promise.resolve('success')
        }
      ];

      const result = await service.run(workflow);
      
      expect(result.totalTasks).toBe(3);
      expect(result.completedTasks).toBe(1);
      expect(result.failedTasks).toBe(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
    });
  });
}); 