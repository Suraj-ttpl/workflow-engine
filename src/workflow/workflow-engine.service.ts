import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

import {  TaskTimeoutError,  WorkflowValidationError, getErrorMessage, createErrorInfo } from './dto/error.interface';
import { Task, TaskState, WorkflowResult, WorkflowEngineConfig } from './dto/task.interface';
import { ENVIRONMENT_CONFIG } from './constants/workflow.constants';
import { ValidationService } from './services/validation.service';
import { TaskQueueService } from './services/task-queue.service';
import { TaskEvent, TaskEventType } from './dto/task.enum';

@Injectable()
export class WorkflowEngineService extends EventEmitter {
  private config: WorkflowEngineConfig;

  constructor(
    private readonly taskQueueService: TaskQueueService,
    private readonly validationService: ValidationService
  ) {
    super();
    this.config = {
      defaultTimeoutMs: ENVIRONMENT_CONFIG.DEFAULT_TIMEOUT_MS,
      defaultRetries: ENVIRONMENT_CONFIG.DEFAULT_RETRIES,
      maxConcurrentTasks: ENVIRONMENT_CONFIG.MAX_CONCURRENT_TASKS,
      retryDelayMs: ENVIRONMENT_CONFIG.RETRY_DELAY_MS
    };
  }

  public async run(workflow: readonly Task[]): Promise<WorkflowResult> {
    const startTime = new Date();

    try {
      await this.validateWorkflow(workflow);

      const taskStates: Record<string, TaskState> = this.initializeTaskStates(workflow);

      this.validationService.validateCircularDependencies(workflow);

      this.validationService.validateDependencies(workflow);

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
    } catch (error) {
      console.error('Workflow execution failed', error);
      throw error;
    }
  }

  private async validateWorkflow(workflow: readonly Task[]): Promise<void> {
    const validationResult = await this.validationService.validateWorkflow(workflow);

    if (!validationResult.isValid) {
      const errorInfo = createErrorInfo(new WorkflowValidationError(
        `Workflow validation failed: ${validationResult.errors.join('; ')}`,
        { taskErrors: validationResult.taskErrors }
      ));
      
      throw new WorkflowValidationError(
        errorInfo.message,
        errorInfo.details
      );
    }
  }

  private initializeTaskStates(workflow: readonly Task[]): Record<string, TaskState> {
    const taskStates: Record<string, TaskState> = {};

    for (const task of workflow) {
      const dependents: string[] = [];
      
      for (const otherTask of workflow) {
        if (otherTask.dependencies?.includes(task.id)) {
          dependents.push(otherTask.id);
        }
      }

      taskStates[task.id] = {
        id: task.id,
        status: 'PENDING',
        attempts: 0,
        maxRetries: task.retries ?? this.config.defaultRetries,
        dependencies: task.dependencies ?? [],
        dependents
      };
    }

    return taskStates;
  }

  private async executeTasks(
    workflow: readonly Task[],
    taskStates: Record<string, TaskState>,
  ): Promise<{ status: 'COMPLETED' | 'FAILED' }> {
    let hasFailedTasks = false;

    for (const task of workflow) {
      const taskState = taskStates[task.id];
      if (!taskState) {
        continue;
      }

      if (task.dependencies && task.dependencies.length > 0) {
        const dependenciesCompleted = this.areDependenciesCompleted(task, taskStates);
        if (!dependenciesCompleted) {
          (taskState as any).status = 'SKIPPED';
          this.sendEvent(TaskEventType.TASK_FAILED, task.id, undefined, 'Dependency not completed');
          continue;
        }
      }

      const success = await this.executeTaskWithRetries(task, taskState);
      
      if (!success) {
        hasFailedTasks = true;
        this.markDependentsAsSkipped(task.id, taskStates);
      }
    }

    return { status: hasFailedTasks ? 'FAILED' : 'COMPLETED' };
  }

  private areDependenciesCompleted(task: Task, taskStates: Record<string, TaskState>): boolean {
    if (!task.dependencies) {
      return true;
    }

    return task.dependencies.every(dependencyId => {
      const dependencyState = taskStates[dependencyId];
      return dependencyState?.status === 'COMPLETED';
    });
  }

  private async executeTaskWithRetries(
    task: Task,
    taskState: TaskState,
  ): Promise<boolean> {
    const maxRetries = task.retries ?? this.config.defaultRetries;
    const timeoutMs = task.timeoutMs ?? this.config.defaultTimeoutMs;

    while (taskState.attempts <= maxRetries) {
      (taskState as any).attempts++;
      (taskState as any).status = 'RUNNING';
      (taskState as any).startTime = new Date();

      this.sendEvent(TaskEventType.TASK_STARTED, task.id, taskState.attempts);

      try {
        if (!this.taskQueueService.canExecuteTask(task.id)) {
          throw new Error(`Cannot execute task ${task.id}: queue capacity exceeded`);
        }

        this.taskQueueService.startTask(task.id);

        const result = await this.executeWithTimeout(task.handler, timeoutMs, task.id);
        
        (taskState as any).status = 'COMPLETED';
        (taskState as any).endTime = new Date();
        (taskState as any).duration = taskState.endTime!.getTime() - taskState.startTime!.getTime();
        (taskState as any).result = result;

        this.taskQueueService.finishTask(task.id);
        this.sendEvent(TaskEventType.TASK_COMPLETED, task.id, taskState.attempts, undefined, result);

        return true;
      } catch (error) {
        this.taskQueueService.finishTask(task.id);
        
        const errorMessage = getErrorMessage(error);
        (taskState as any).error = errorMessage;

        if (taskState.attempts > maxRetries) {
          (taskState as any).status = 'FAILED';
          (taskState as any).endTime = new Date();
          (taskState as any).duration = taskState.endTime!.getTime() - taskState.startTime!.getTime();

          this.sendEvent(TaskEventType.TASK_FAILED, task.id, taskState.attempts, errorMessage);
          return false;
        }

        this.sendEvent(TaskEventType.TASK_RETRY, task.id, taskState.attempts, errorMessage);
        await this.sleep(this.config.retryDelayMs);
      }
    }

    return false;
  }

  private async executeWithTimeout(handler: () => Promise<unknown>, timeoutMs: number, taskId: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TaskTimeoutError(taskId, timeoutMs));
      }, timeoutMs);

      handler()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private markDependentsAsSkipped(taskId: string, taskStates: Record<string, TaskState>): void {
    const taskState = taskStates[taskId];
    if (!taskState) {
      return;
    }

    for (const dependentId of taskState.dependents) {
      const dependentState = taskStates[dependentId];
      if (dependentState && dependentState.status === 'PENDING') {
        (dependentState as any).status = 'SKIPPED';
        this.sendEvent(TaskEventType.TASK_FAILED, dependentId, undefined, `Dependency ${taskId} failed`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private sendEvent(
    type: TaskEventType, 
    taskId: string, 
    attempt?: number, 
    error?: string, 
    result?: unknown
  ): void {
    const event: TaskEvent = {
      type,
      taskId,
      timestamp: new Date(),
      attempt: attempt ?? 0,
      error: error ?? '',
      result
    };

    this.emit('taskEvent', event);
    console.log(`${type}: ${taskId}${attempt ? ` (attempt ${attempt})` : ''}${error ? ` - ${error}` : ''}`);
  }

  public getRunningTasksCount(): number {
    return this.taskQueueService.getRunningTasksCount();
  }

  public getQueuedTasksCount(): number {
    return this.taskQueueService.getQueueSize();
  }

  public getConfig(): WorkflowEngineConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<WorkflowEngineConfig>): void {
    this.config = {
      defaultTimeoutMs: newConfig.defaultTimeoutMs ?? this.config.defaultTimeoutMs,
      defaultRetries: newConfig.defaultRetries ?? this.config.defaultRetries,
      maxConcurrentTasks: newConfig.maxConcurrentTasks ?? this.config.maxConcurrentTasks,
      retryDelayMs: newConfig.retryDelayMs ?? this.config.retryDelayMs
    };
    
    this.taskQueueService.updateConfig(newConfig);
    console.debug('Workflow engine configuration updated', this.config);
  }

  public getQueueStatus(): ReturnType<typeof this.taskQueueService.getQueueStatus> {
    return this.taskQueueService.getQueueStatus();
  }
}
