export enum TaskEventType {
  TASK_STARTED = 'TASK_STARTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FAILED = 'TASK_FAILED',
  TASK_RETRY = 'TASK_RETRY',
}

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  timestamp: Date;
  attempt?: number;
  error?: string;
  result?: any;
}
