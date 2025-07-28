import { NestFactory } from '@nestjs/core';

import { createWorkingWorkflow, createFailedWorkflow, createSkippedWorkflow } from './example-file';
import { SimpleWorkflowEngineService } from './workflow/workflow-engine.service';
import { TaskEventType } from './workflow/dto/task.enum';
import { AppModule } from './app.module';


async function demonstrateWorkflowScenarios() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const simpleWorkflowEngine = app.get(SimpleWorkflowEngineService);

  console.log('Scenario 1: Working Workflow (All tasks succeed)');
  
  const workingConfig = createWorkingWorkflow();
  const { workflow: workingWorkflow } = workingConfig;

  simpleWorkflowEngine.on('taskEvent', (event) => {
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
    const workingResult = await simpleWorkflowEngine.run(workingWorkflow);
    console.log(`Working Workflow Results:`);
    console.log(`Status: ${workingResult.status}`);
    console.log(`Duration: ${workingResult.duration}ms`);
    console.log(`Completed: ${workingResult.completedTasks}/${workingResult.totalTasks}`);
    console.log(`Failed: ${workingResult.failedTasks}`);

    const completedTasks = Object.keys(workingResult.tasks).filter(id => workingResult.tasks[id].status === 'COMPLETED');
    const failedTasks = Object.keys(workingResult.tasks).filter(id => workingResult.tasks[id].status === 'FAILED');
    const skippedTasks = Object.keys(workingResult.tasks).filter(id => workingResult.tasks[id].status === 'SKIPPED');

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
    console.error('Working workflow failed:', error.message);
  }
  
  console.log('Scenario 2: Failed Workflow (Tasks fail with retries)');

  simpleWorkflowEngine.removeAllListeners('taskEvent');

  simpleWorkflowEngine.on('taskEvent', (event) => {
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
    const failedResult = await simpleWorkflowEngine.run(failedWorkflow);
    console.log(`Failed Workflow Results:`);
    console.log(`Status: ${failedResult.status}`);
    console.log(`Duration: ${failedResult.duration}ms`);
    console.log(`Completed: ${failedResult.completedTasks}/${failedResult.totalTasks}`);
    console.log(`Failed: ${failedResult.failedTasks}`);

    const completedTasks = Object.keys(failedResult.tasks).filter(id => failedResult.tasks[id].status === 'COMPLETED');
    const failedTasks = Object.keys(failedResult.tasks).filter(id => failedResult.tasks[id].status === 'FAILED');
    const skippedTasks = Object.keys(failedResult.tasks).filter(id => failedResult.tasks[id].status === 'SKIPPED');

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
    console.error('Failed workflow failed:', error.message);
  }

  console.log('Scenario 3: Skipped Workflow (Dependency failures)');

  simpleWorkflowEngine.removeAllListeners('taskEvent');

  simpleWorkflowEngine.on('taskEvent', (event) => {
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
    const skippedResult = await simpleWorkflowEngine.run(skippedWorkflow);
    console.log(`Skipped Workflow Results:`);
    console.log(`Status: ${skippedResult.status}`);
    console.log(`Duration: ${skippedResult.duration}ms`);
    console.log(`Completed: ${skippedResult.completedTasks}/${skippedResult.totalTasks}`);
    console.log(`Failed: ${skippedResult.failedTasks}`);

    const completedTasks = Object.keys(skippedResult.tasks).filter(id => skippedResult.tasks[id].status === 'COMPLETED');
    const failedTasks = Object.keys(skippedResult.tasks).filter(id => skippedResult.tasks[id].status === 'FAILED');
    const skippedTasks = Object.keys(skippedResult.tasks).filter(id => skippedResult.tasks[id].status === 'SKIPPED');

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
    console.error('Skipped workflow failed:', error.message);
  }
  await app.close();
}

demonstrateWorkflowScenarios().catch(console.error); 