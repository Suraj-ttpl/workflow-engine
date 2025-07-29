import { ErrorCode } from '../constants/workflow.constants';

export interface WorkflowErrorInfo {
  readonly code: ErrorCode;
  readonly message: string;
  readonly taskId?: string;
  readonly timestamp: Date;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class WorkflowError extends Error {
  public readonly code: ErrorCode;
  public readonly taskId?: string;
  public readonly timestamp: Date;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ErrorCode,
    taskId?: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    if (taskId !== undefined) {
      this.taskId = taskId;
    }
    this.timestamp = new Date();
    if (details !== undefined) {
      this.details = details;
    }
  }

  public toJSON(): WorkflowErrorInfo {
    const result: WorkflowErrorInfo = {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      ...(this.taskId !== undefined && { taskId: this.taskId }),
      ...(this.details !== undefined && { details: this.details })
    };
    
    return result;
  }
}

export class TaskTimeoutError extends WorkflowError {
  constructor(taskId: string, timeoutMs: number) {
    super(
      `Task ${taskId} timed out after ${timeoutMs}ms`,
      'TASK_TIMEOUT',
      taskId,
      { timeoutMs }
    );
    this.name = 'TaskTimeoutError';
  }
}

export class InvalidTaskConfigurationError extends WorkflowError {
  constructor(taskId: string, field: string, value: unknown) {
    super(
      `Invalid configuration for task ${taskId}: ${field} = ${String(value)}`,
      'INVALID_TASK_CONFIGURATION',
      taskId,
      { field, value }
    );
    this.name = 'InvalidTaskConfigurationError';
  }
}

export class WorkflowValidationError extends WorkflowError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message, 'WORKFLOW_VALIDATION', undefined, details);
    this.name = 'WorkflowValidationError';
  }
}

export class ConcurrentExecutionError extends WorkflowError {
  constructor(taskId: string, maxConcurrentTasks: number) {
    super(
      `Cannot execute task ${taskId}: maximum concurrent tasks (${maxConcurrentTasks}) exceeded`,
      'CONCURRENT_EXECUTION_ERROR',
      taskId,
      { maxConcurrentTasks }
    );
    this.name = 'ConcurrentExecutionError';
  }
}

export class QueueFullError extends WorkflowError {
  constructor(maxQueueSize: number) {
    super(
      `Task queue is full: maximum size (${maxQueueSize}) exceeded`,
      'QUEUE_FULL',
      undefined,
      { maxQueueSize }
    );
    this.name = 'QueueFullError';
  }
}

export type WorkflowErrorType = 
  | WorkflowError
  | TaskTimeoutError
  | InvalidTaskConfigurationError
  | WorkflowValidationError
  | ConcurrentExecutionError
  | QueueFullError

export function isWorkflowError(error: unknown): error is WorkflowErrorType {
  return error instanceof WorkflowError;
}

export function getErrorCode(error: unknown): ErrorCode | undefined {
  if (isWorkflowError(error)) {
    return error.code;
  }
  return undefined;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function createErrorInfo(error: unknown): WorkflowErrorInfo {
  if (isWorkflowError(error)) {
    return error.toJSON();
  }
  
  return {
    code: 'WORKFLOW_VALIDATION',
    message: getErrorMessage(error),
    timestamp: new Date()
  };
} 