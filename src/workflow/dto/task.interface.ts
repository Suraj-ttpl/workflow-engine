import { TaskStatus, WorkflowStatus } from '../constants/workflow.constants';

export interface Task {
  readonly id: string;
  readonly handler: () => Promise<unknown>;
  readonly dependencies?: readonly string[];
  readonly retries?: number;
  readonly timeoutMs?: number;
}

export interface TaskState {
  readonly id: string;
  readonly status: TaskStatus;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly duration?: number;
  readonly attempts: number;
  readonly maxRetries: number;
  readonly error?: string;
  readonly result?: unknown;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
}

export interface WorkflowState {
  readonly id: string;
  readonly status: WorkflowStatus;
  readonly tasks: Record<string, TaskState>;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly duration?: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly totalTasks: number;
}

export interface WorkflowResult {
  readonly status: 'COMPLETED' | 'FAILED';
  readonly tasks: Record<string, TaskState>;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly totalTasks: number;
}

export interface WorkflowEngineConfig {
  readonly defaultTimeoutMs: number;
  readonly defaultRetries: number;
  readonly maxConcurrentTasks: number;
  readonly retryDelayMs: number;
}

export interface TaskExecutionContext {
  readonly taskId: string;
  readonly attempt: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly dependencies: readonly string[];
}

export interface TaskExecutionResult {
  readonly success: boolean;
  readonly result?: unknown;
  readonly error?: string;
  readonly duration: number;
}

export interface TaskValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

export interface WorkflowValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly taskErrors: Record<string, readonly string[]>;
}

export interface QueueItem {
  readonly task: Task;
  readonly priority: number;
  readonly timestamp: Date;
}

export interface TaskMetrics {
  readonly taskId: string;
  readonly executionCount: number;
  readonly averageDuration: number;
  readonly successRate: number;
  readonly lastExecuted?: Date;
}

export interface WorkflowMetrics {
  readonly totalWorkflows: number;
  readonly completedWorkflows: number;
  readonly failedWorkflows: number;
  readonly averageDuration: number;
  readonly taskMetrics: Record<string, TaskMetrics>;
} 
