export interface Task {
  id: string;
  handler: () => Promise<any>;
  dependencies?: string[];
  retries?: number;
  timeoutMs?: number;
}

export interface TaskState {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  attempts: number;
  maxRetries: number;
  error?: string;
  result?: any;
  dependencies: string[];
  dependents: string[];
}

export interface WorkflowState {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  tasks: Record<string, TaskState>;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
}

export interface WorkflowResult {
  status: 'COMPLETED' | 'FAILED';
  tasks: Record<string, TaskState>;
  startTime: Date;
  endTime: Date;
  duration: number;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
} 
