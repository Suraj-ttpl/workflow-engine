import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

import { Task, TaskState, WorkflowResult } from './dto/task.interface';
import { TaskEvent, TaskEventType } from './dto/task.enum';

@Injectable()
export class SimpleWorkflowEngineService extends EventEmitter {

  async run(workflow: Task[]): Promise<WorkflowResult> {
    const startTime = new Date();

    const taskStates: Record<string, TaskState> = {};

    for (let task of workflow) {
      taskStates[task.id] = {
        id: task.id,
        status: 'PENDING',
        attempts: 0,
        maxRetries: task.retries || 0,
        dependencies: task.dependencies || [],
        dependents: []
      };
    }

    if (this.checkCircularDependencies(taskStates)) {
      throw new Error('Circular dependencies detected in workflow');
    }

    const result = await this.executeTasks(workflow, taskStates);

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const completedTasks = Object.values(taskStates).filter(t => t.status === 'COMPLETED').length;
    const failedTasks = Object.values(taskStates).filter(t => t.status === 'FAILED').length;

    return {
      status: result.status,
      tasks: taskStates,
      startTime,
      endTime,
      duration,
      completedTasks,
      failedTasks,
      totalTasks: workflow.length
    };
  }

  private checkCircularDependencies(taskStates: Record<string, TaskState>): boolean {
    const visited: any = {};
    const stack: any = {};

    function visit(taskId: string): boolean {
      if (stack[taskId]) return true;
      if (visited[taskId]) return false;

      visited[taskId] = true;
      stack[taskId] = true;

      const task = taskStates[taskId];
      const deps = task.dependencies || [];

      for (let i = 0; i < deps.length; i++) {
        if (visit(deps[i])) return true;
      }

      stack[taskId] = false;
      return false;
    }

    for (let taskId in taskStates) {
      if (visit(taskId)) return true;
    }

    return false;
  }

  private async executeTasks(
    workflow: Task[],
    taskStates: Record<string, TaskState>,
  ): Promise<{ status: 'COMPLETED' | 'FAILED' }> {
    
    for (let task of workflow) {
      const taskState = taskStates[task.id];
      
      if (task.dependencies && task.dependencies.length > 0) {
        let dependenciesCompleted = true;
        for (let depId of task.dependencies) {
          const depTask = taskStates[depId];
          if (!depTask || depTask.status !== 'COMPLETED') {
            dependenciesCompleted = false;
            break;
          }
        }
        
        if (!dependenciesCompleted) {
          taskState.status = 'SKIPPED';
          taskState.error = 'Dependency not completed';
          console.log('TASK_SKIPPED: ' + task.id + ' - Dependency not completed');
          this.sendEvent(TaskEventType.TASK_FAILED, task.id, taskState.attempts, 'Dependency not completed');
          continue;
        }
      }

      const success = await this.executeTaskWithRetries(task, taskState);
      
      if (!success) {
        this.markDependentsAsSkipped(task.id, taskStates);
      }
    }

    const failed = Object.values(taskStates).some(t => t.status === 'FAILED');
    return { status: failed ? 'FAILED' : 'COMPLETED' };
  }

  private async executeTaskWithRetries(
    task: Task,
    taskState: TaskState,
  ): Promise<boolean> {
    const maxRetries = task.retries || 0;
    const timeoutMs = task.timeoutMs || 30000;

    while (taskState.attempts <= maxRetries) {
      taskState.attempts++;
      taskState.status = 'RUNNING';
      taskState.startTime = new Date();

      this.sendEvent(TaskEventType.TASK_STARTED, task.id, taskState.attempts);
      console.log('TASK_STARTED: ' + task.id + ' (attempt ' + taskState.attempts + ')');

      try {
        const result = await this.executeWithTimeout(task.handler, timeoutMs);

        taskState.status = 'COMPLETED';
        taskState.endTime = new Date();
        taskState.duration = taskState.endTime.getTime() - taskState.startTime.getTime();
        taskState.result = result;

        this.sendEvent(TaskEventType.TASK_COMPLETED, task.id, taskState.attempts, undefined, result);
        console.log('TASK_COMPLETED: ' + task.id + '\n');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (taskState.attempts <= maxRetries) {
          this.sendEvent(TaskEventType.TASK_RETRY, task.id, taskState.attempts, message);
          console.log('TASK_RETRY: ' + task.id + ' (attempt ' + taskState.attempts + '/' + maxRetries + ')');
          
          await this.sleep(100);
          
        } else {
          taskState.status = 'FAILED';
          taskState.endTime = new Date();
          taskState.duration = taskState.endTime.getTime() - taskState.startTime.getTime();
          taskState.error = message;

          this.sendEvent(TaskEventType.TASK_FAILED, task.id, taskState.attempts, message);
          console.log('TASK_FAILED: ' + task.id + ' - ' + message);
        }
      }
    }

    return false;
  }

  private async executeWithTimeout(handler: () => Promise<any>, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Task timeout after ' + timeoutMs + 'ms')), timeoutMs);

      handler().then(res => {
        clearTimeout(timer);
        resolve(res);
      }).catch(err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private markDependentsAsSkipped(taskId: string, taskStates: Record<string, TaskState>) {
    for (let taskIdKey in taskStates) {
      const task = taskStates[taskIdKey];
      if (task.dependencies && task.dependencies.includes(taskId)) {
        if (task.status === 'PENDING') {
          task.status = 'SKIPPED';
          task.error = 'Dependency failed: ' + taskId;
          console.log('TASK_SKIPPED: ' + taskIdKey + ' (dependency ' + taskId + ' failed)');
        }
      }
    }
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private sendEvent(type: TaskEventType, taskId: string, attempt?: number, error?: string, result?: any) {
    const event: TaskEvent = {
      type,
      taskId,
      timestamp: new Date(),
      attempt,
      error,
      result
    };
    this.emit('taskEvent', event);
  }
}
