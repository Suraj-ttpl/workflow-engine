import { NestFactory } from '@nestjs/core';

import { createWorkingWorkflow, createFailedWorkflow, createSkippedWorkflow } from './example-file';
import { WorkflowEngineService } from './workflow/workflow-engine.service';
import { TaskEventType } from './workflow/dto/task.enum';
import { AppModule } from './app.module';

async function demonstrateWorkflowScenarios() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const workflowEngine = app.get(WorkflowEngineService);

  console.log('Scenario 1: Working Workflow (All tasks succeed)');
  
  const workingConfig = createWorkingWorkflow();
  const { workflow: workingWorkflow } = workingConfig;

  workflowEngine.on('taskEvent', (event) => {
    switch (event.type) {
      case TaskEventType.TASK_STARTED:
        console.log(`${event.taskId} started (attempt ${event.attempt})`);
        break;
      case TaskEventType.TASK_COMPLETED:
        console.log(`${event.taskId} completed successfully`);
        break;
      case TaskEventType.TASK_FAILED:
        console.log(`${event.taskId} failed: ${event.error}`);
        break;
      case TaskEventType.TASK_RETRY:
        console.log(`${event.taskId} retrying (attempt ${event.attempt})`);
        break;
    }
  });

  try {
    const workingResult = await workflowEngine.run(workingWorkflow);
    console.log(`\n-------------------------------------------------\nWorking Workflow Results:`);
    console.log(`Status: ${workingResult.status}`);
    console.log(`Duration: ${workingResult.duration}ms`);
    console.log(`Completed: ${workingResult.completedTasks}/${workingResult.totalTasks}`);
    console.log(`Failed: ${workingResult.failedTasks}`);
    console.log(`Skipped: ${Object.keys(workingResult.tasks).length - workingResult.completedTasks - workingResult.failedTasks}`);

    const completedTasks = Object.keys(workingResult.tasks).filter(id => workingResult.tasks[id]?.status === 'COMPLETED');
    const failedTasks = Object.keys(workingResult.tasks).filter(id => workingResult.tasks[id]?.status === 'FAILED');
    const skippedTasks = Object.keys(workingResult.tasks).filter(id => workingResult.tasks[id]?.status === 'SKIPPED');

    if (completedTasks.length > 0) {
      console.log(`COMPLETED: {${completedTasks.join(', ')}}`);
    }
    if (failedTasks.length > 0) {
      console.log(`FAILED: {${failedTasks.join(', ')}}`);
    }
    if (skippedTasks.length > 0) {
      console.log(`SKIPPED: {${skippedTasks.join(', ')}}`);
    }

    console.log('\n\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Working workflow failed:', errorMessage);
  }
  
  console.log('Scenario 2: Failed Workflow (Tasks fail with retries)');

  workflowEngine.removeAllListeners('taskEvent');

  workflowEngine.on('taskEvent', (event) => {
    switch (event.type) {
      case TaskEventType.TASK_STARTED:
        console.log(`${event.taskId} started (attempt ${event.attempt})`);
        break;
      case TaskEventType.TASK_COMPLETED:
        console.log(`${event.taskId} completed successfully`);
        break;
      case TaskEventType.TASK_FAILED:
        console.log(`${event.taskId} failed: ${event.error}`);
        break;
      case TaskEventType.TASK_RETRY:
        console.log(`${event.taskId} retrying (attempt ${event.attempt})`);
        break;
    }
  });

  const failedConfig = createFailedWorkflow();
  const { workflow: failedWorkflow } = failedConfig;

  try {
    const failedResult = await workflowEngine.run(failedWorkflow);
    console.log(`\n-------------------------------------------------\nFailed Workflow Results:`);
    console.log(`Status: ${failedResult.status}`);
    console.log(`Duration: ${failedResult.duration}ms`);
    console.log(`Completed: ${failedResult.completedTasks}/${failedResult.totalTasks}`);
    console.log(`Failed: ${failedResult.failedTasks}`);
    console.log(`Skipped: ${Object.keys(failedResult.tasks).length - failedResult.completedTasks - failedResult.failedTasks}`);

    const completedTasks = Object.keys(failedResult.tasks).filter(id => failedResult.tasks[id]?.status === 'COMPLETED');
    const failedTasks = Object.keys(failedResult.tasks).filter(id => failedResult.tasks[id]?.status === 'FAILED');
    const skippedTasks = Object.keys(failedResult.tasks).filter(id => failedResult.tasks[id]?.status === 'SKIPPED');

    if (completedTasks.length > 0) {
      console.log(`COMPLETED: {${completedTasks.join(', ')}}`);
    }
    if (failedTasks.length > 0) {
      console.log(`FAILED: {${failedTasks.join(', ')}}`);
    }
    if (skippedTasks.length > 0) {
      console.log(`SKIPPED: {${skippedTasks.join(', ')}}`);
    }
    console.log('\n\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed workflow failed:', errorMessage);
  }

  console.log('Scenario 3: Skipped Workflow (Dependency failures)');

  workflowEngine.removeAllListeners('taskEvent');

  workflowEngine.on('taskEvent', (event) => {
    switch (event.type) {
      case TaskEventType.TASK_STARTED:
        console.log(`${event.taskId} started (attempt ${event.attempt})`);
        break;
      case TaskEventType.TASK_COMPLETED:
        console.log(`${event.taskId} completed successfully`);
        break;
      case TaskEventType.TASK_FAILED:
        console.log(`${event.taskId} failed: ${event.error}`);
        break;
      case TaskEventType.TASK_RETRY:
        console.log(`${event.taskId} retrying (attempt ${event.attempt})`);
        break;
    }
  });

  const skippedConfig = createSkippedWorkflow();
  const { workflow: skippedWorkflow } = skippedConfig;

  try {
    const skippedResult = await workflowEngine.run(skippedWorkflow);
    console.log(`\n-------------------------------------------------\nSkipped Workflow Results:`);
    console.log(`Status: ${skippedResult.status}`);
    console.log(`Duration: ${skippedResult.duration}ms`);
    console.log(`Completed: ${skippedResult.completedTasks}/${skippedResult.totalTasks}`);
    console.log(`Failed: ${skippedResult.failedTasks}`);
    console.log(`Skipped: ${Object.keys(skippedResult.tasks).length - skippedResult.completedTasks - skippedResult.failedTasks}`);

    const completedTasks = Object.keys(skippedResult.tasks).filter(id => skippedResult.tasks[id]?.status === 'COMPLETED');
    const failedTasks = Object.keys(skippedResult.tasks).filter(id => skippedResult.tasks[id]?.status === 'FAILED');
    const skippedTasks = Object.keys(skippedResult.tasks).filter(id => skippedResult.tasks[id]?.status === 'SKIPPED');

    if (completedTasks.length > 0) {
      console.log(`COMPLETED: {${completedTasks.join(', ')}}`);
    }
    if (failedTasks.length > 0) {
      console.log(`FAILED: {${failedTasks.join(', ')}}`);
    }
    if (skippedTasks.length > 0) {
      console.log(`SKIPPED: {${skippedTasks.join(', ')}}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Skipped workflow failed:', errorMessage);
  }
  await app.close();
}

demonstrateWorkflowScenarios().catch(console.error); 