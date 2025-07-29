import { plainToClass } from 'class-transformer';
import { Injectable } from '@nestjs/common';
import { validate } from 'class-validator';

import { Task, TaskValidationResult, WorkflowValidationResult } from '../dto/task.interface';
import { WorkflowValidationError, InvalidTaskConfigurationError } from '../dto/error.interface';
import { WORKFLOW_CONSTANTS } from '../constants/workflow.constants';
import { TaskDto, WorkflowDto } from '../dto/task.dto';

@Injectable()
export class ValidationService {

  public async validateWorkflow(workflow: readonly Task[]): Promise<WorkflowValidationResult> {
    const errors: string[] = [];
    const taskErrors: Record<string, readonly string[]> = {};

    try {
      const workflowDto = plainToClass(WorkflowDto, { tasks: workflow });
      const workflowValidationErrors = await validate(workflowDto);

      if (workflowValidationErrors.length > 0) {
        const workflowErrorMessages = workflowValidationErrors.map(error => 
          Object.values(error.constraints || {}).join(', ')
        );
        errors.push(...workflowErrorMessages);
      }

      for (const task of workflow) {
        const taskValidationResult = await this.validateTask(task);
        if (!taskValidationResult.isValid) {
          taskErrors[task.id] = taskValidationResult.errors;
          errors.push(`Task ${task.id}: ${taskValidationResult.errors.join(', ')}`);
        }
      }

      const workflowRuleErrors = this.validateWorkflowRules(workflow);
      errors.push(...workflowRuleErrors);

      return {
        isValid: errors.length === 0,
        errors,
        taskErrors
      };
    } catch (error) {
      console.error('Workflow validation failed', error);
      return {
        isValid: false,
        errors: [getErrorMessage(error)],
        taskErrors: {}
      };
    }
  }

  public async validateTask(task: Task): Promise<TaskValidationResult> {
    const errors: string[] = [];

    try {
      const taskDto = plainToClass(TaskDto, task);
      const validationErrors = await validate(taskDto);

      if (validationErrors.length > 0) {
        const errorMessages = validationErrors.map(error => 
          Object.values(error.constraints || {}).join(', ')
        );
        errors.push(...errorMessages);
      }

      const taskRuleErrors = this.validateTaskRules(task);
      errors.push(...taskRuleErrors);

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error(`Task ${task.id} validation failed`, error);
      return {
        isValid: false,
        errors: [getErrorMessage(error)]
      };
    }
  }

  private validateWorkflowRules(workflow: readonly Task[]): readonly string[] {
    const errors: string[] = [];

    const taskIds = workflow.map(task => task.id);
    const duplicateIds = taskIds.filter((id, index) => taskIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate task IDs found: ${duplicateIds.join(', ')}`);
    }

    if (workflow.length === 0) {
      errors.push('Workflow must contain at least one task');
    }

    if (workflow.length > WORKFLOW_CONSTANTS.VALIDATION.MAX_DEPENDENCIES_PER_TASK * 10) {
      errors.push(`Workflow too large: maximum ${WORKFLOW_CONSTANTS.VALIDATION.MAX_DEPENDENCIES_PER_TASK * 10} tasks allowed`);
    }

    return errors;
  }

  private validateTaskRules(task: Task): readonly string[] {
    const errors: string[] = [];

    if (!task.id || task.id.trim().length === 0) {
      errors.push('Task ID is required');
    } else if (task.id.length > WORKFLOW_CONSTANTS.VALIDATION.MAX_TASK_ID_LENGTH) {
      errors.push(`Task ID too long: maximum ${WORKFLOW_CONSTANTS.VALIDATION.MAX_TASK_ID_LENGTH} characters allowed`);
    }

    if (typeof task.handler !== 'function') {
      errors.push('Task handler must be a function');
    }

    if (task.retries !== undefined) {
      if (!Number.isInteger(task.retries) || task.retries < WORKFLOW_CONSTANTS.VALIDATION.MIN_RETRIES) {
        errors.push(`Retries must be an integer >= ${WORKFLOW_CONSTANTS.VALIDATION.MIN_RETRIES}`);
      }
      if (task.retries > WORKFLOW_CONSTANTS.VALIDATION.MAX_RETRIES) {
        errors.push(`Retries cannot exceed ${WORKFLOW_CONSTANTS.VALIDATION.MAX_RETRIES}`);
      }
    }

    if (task.timeoutMs !== undefined) {
      if (!Number.isInteger(task.timeoutMs) || task.timeoutMs < WORKFLOW_CONSTANTS.VALIDATION.MIN_TIMEOUT_MS) {
        errors.push(`Timeout must be an integer >= ${WORKFLOW_CONSTANTS.VALIDATION.MIN_TIMEOUT_MS}ms`);
      }
      if (task.timeoutMs > WORKFLOW_CONSTANTS.VALIDATION.MAX_TIMEOUT_MS) {
        errors.push(`Timeout cannot exceed ${WORKFLOW_CONSTANTS.VALIDATION.MAX_TIMEOUT_MS}ms`);
      }
    }

    if (task.dependencies) {
      if (!Array.isArray(task.dependencies)) {
        errors.push('Dependencies must be an array');
      } else {
        if (task.dependencies.length > WORKFLOW_CONSTANTS.VALIDATION.MAX_DEPENDENCIES_PER_TASK) {
          errors.push(`Too many dependencies: maximum ${WORKFLOW_CONSTANTS.VALIDATION.MAX_DEPENDENCIES_PER_TASK} allowed`);
        }

        for (const dependency of task.dependencies) {
          if (typeof dependency !== 'string' || dependency.trim().length === 0) {
            errors.push('Dependency must be a non-empty string');
          }
          if (dependency === task.id) {
            errors.push('Task cannot depend on itself');
          }
        }
      }
    }

    return errors;
  }

  public validateDependencies(workflow: readonly Task[]): void {
    const taskIds = new Set(workflow.map(task => task.id));

    for (const task of workflow) {
      if (task.dependencies) {
        for (const dependency of task.dependencies) {
          if (!taskIds.has(dependency)) {
            throw new InvalidTaskConfigurationError(
              task.id,
              'dependencies',
              `Dependency '${dependency}' not found in workflow`
            );
          }
        }
      }
    }
  }

  public validateCircularDependencies(workflow: readonly Task[]): void {
    const taskMap = new Map(workflow.map(task => [task.id, task]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) {
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recursionStack.add(taskId);

      const task = taskMap.get(taskId);
      if (task?.dependencies) {
        for (const dependency of task.dependencies) {
          if (hasCycle(dependency)) {
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const task of workflow) {
      if (!visited.has(task.id) && hasCycle(task.id)) {
        const cyclePath = this.findCircularDependencyPath(workflow);
        throw new WorkflowValidationError(
          `Circular dependencies detected: ${cyclePath.join(' -> ')}`,
          { cyclePath }
        );
      }
    }
  }

  private findCircularDependencyPath(workflow: readonly Task[]): readonly string[] {
    const taskMap = new Map(workflow.map(task => [task.id, task]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const findCycle = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) {
        const cycleStart = path.indexOf(taskId);
        if (cycleStart !== -1) {
          path.splice(0, cycleStart);
          path.push(taskId);
        }
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const task = taskMap.get(taskId);
      if (task?.dependencies) {
        for (const dependency of task.dependencies) {
          if (findCycle(dependency)) {
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
      path.pop();
      return false;
    };

    for (const task of workflow) {
      if (!visited.has(task.id) && findCycle(task.id)) {
        return path;
      }
    }

    return [];
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
} 