export enum TaskEventType {
  TASK_STARTED = 'TASK_STARTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FAILED = 'TASK_FAILED',
  TASK_RETRY = 'TASK_RETRY',
}

export interface TaskEvent {
  readonly type: TaskEventType;
  readonly taskId: string;
  readonly timestamp: Date;
  readonly attempt?: number;
  readonly error?: string;
  readonly result?: unknown;
}
