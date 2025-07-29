import { IsString, IsOptional, IsNumber, IsArray, Min, Max, ValidateNested, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class TaskDto {
  @IsString()
  id!: string;

  handler!: () => Promise<unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  retries?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(300000)
  timeoutMs?: number;
}

export class WorkflowDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskDto)
  tasks!: TaskDto[];
}

export class WorkflowConfigDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(300000)
  defaultTimeoutMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  defaultRetries?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100)
  maxConcurrentTasks?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(10000)
  retryDelayMs?: number;
}

export class TaskResultDto {
  @IsString()
  taskId!: string;

  @IsString()
  status!: 'COMPLETED' | 'FAILED' | 'SKIPPED';

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  attempts?: number;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  result?: unknown;
}

export class WorkflowResultDto {
  @IsString()
  status!: 'COMPLETED' | 'FAILED';

  @IsNumber()
  duration!: number;

  @IsNumber()
  completedTasks!: number;

  @IsNumber()
  failedTasks!: number;

  @IsNumber()
  totalTasks!: number;

  @ValidateNested({ each: true })
  @Type(() => TaskResultDto)
  tasks!: Record<string, TaskResultDto>;
} 
