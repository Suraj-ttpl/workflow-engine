import { Injectable } from '@nestjs/common';
import { Task, QueueItem, WorkflowEngineConfig } from '../dto/task.interface';
import { QueueFullError, ConcurrentExecutionError } from '../dto/error.interface';
import { WORKFLOW_CONSTANTS, ENVIRONMENT_CONFIG } from '../constants/workflow.constants';

@Injectable()
export class TaskQueueService {
  private readonly queue: QueueItem[] = [];
  private readonly runningTasks = new Set<string>();
  private config: WorkflowEngineConfig;
  private isProcessing = false;

  constructor() {
    this.config = {
      defaultTimeoutMs: ENVIRONMENT_CONFIG.DEFAULT_TIMEOUT_MS,
      defaultRetries: ENVIRONMENT_CONFIG.DEFAULT_RETRIES,
      maxConcurrentTasks: ENVIRONMENT_CONFIG.MAX_CONCURRENT_TASKS,
      retryDelayMs: ENVIRONMENT_CONFIG.RETRY_DELAY_MS
    };
  }

  public enqueue(task: Task, priority = 0): void {
    if (this.queue.length >= WORKFLOW_CONSTANTS.QUEUE.MAX_SIZE) {
      throw new QueueFullError(WORKFLOW_CONSTANTS.QUEUE.MAX_SIZE);
    }

    const queueItem: QueueItem = {
      task,
      priority,
      timestamp: new Date()
    };

    this.queue.push(queueItem);
    this.queue.sort((a, b) => b.priority - a.priority);
    
    console.debug(`Task ${task.id} enqueued with priority ${priority}`);
  }

  public dequeue(): Task | null {
    const item = this.queue.shift();
    return item?.task ?? null;
  }

  public canExecuteTask(taskId: string): boolean {
    if (this.runningTasks.has(taskId)) {
      return false;
    }

    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      return false;
    }

    return true;
  }

  public startTask(taskId: string): void {
    if (!this.canExecuteTask(taskId)) {
      throw new ConcurrentExecutionError(taskId, this.config.maxConcurrentTasks);
    }

    this.runningTasks.add(taskId);
  }

  public finishTask(taskId: string): void {
    this.runningTasks.delete(taskId);
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public getRunningTasksCount(): number {
    return this.runningTasks.size;
  }

  public getRunningTasks(): readonly string[] {
    return Array.from(this.runningTasks);
  }

  public clearQueue(): void {
    this.queue.length = 0;
    console.debug('Task queue cleared');
  }

  public getQueueStatus(): {
    readonly queueSize: number;
    readonly runningTasks: number;
    readonly maxConcurrentTasks: number;
    readonly isProcessing: boolean;
  } {
    return {
      queueSize: this.queue.length,
      runningTasks: this.runningTasks.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      isProcessing: this.isProcessing
    };
  }

  public setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }

  public isQueueEmpty(): boolean {
    return this.queue.length === 0;
  }

  public hasRunningTasks(): boolean {
    return this.runningTasks.size > 0;
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
    
    console.debug('Task queue configuration updated', this.config);
  }
} 
