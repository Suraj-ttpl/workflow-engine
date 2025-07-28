## Objective
Build a lightweight in-memory workflow engine in NestJS that can execute a series of tasks (steps) with dependencies, support retries, and emit lifecycle events.

## Project Requirements
# Core Requirements:

Task Definition
Each task is a function that can succeed (Promise<value>) or fail (throws).
Tasks can have dependencies on other tasks.

# Workflow Execution
Tasks should be executed respecting dependency order.
Failed tasks should retry up to N times (configurable per task).
Task timeouts should be enforced (e.g., max 2 seconds).

# State Tracking
Each task should emit lifecycle events:
TASK_STARTED
TASK_COMPLETED
TASK_FAILED
TASK_RETRY

# Console Logging
Emit a log for each lifecycle event with timestamp, task ID, and message.

# Tests
Unit tests demonstrating capability
Integration tests showing end-to-end application

# Example Workflow Definition
const workflow = [
  {
    id: 'fetchData',
    handler: () => fetchFromRemoteAPI(),
    retries: 2,
    timeoutMs: 1000
  },
  {
    id: 'processData',
    dependencies: ['fetchData'],
    handler: () => processDataLocally(),
    retries: 1
  },
  {
    id: 'saveResult',
    dependencies: ['processData'],
    handler: () => persistToDatabase()
  }
];


# Technical Constraints
Use NestJS for structure
Organize core logic under a service (e.g., WorkflowEngineService)
Tasks should be passed in via method call (workflowEngine.run(workflowDefinition))


# Bonus (for extra credit):
Implement parallel execution of tasks that don’t depend on each other
Provide an event emitter or pub/sub pattern for external listeners to respond to task lifecycle events
Write unit tests for your engine
Use decorators to define tasks (e.g., @TaskStep())


# Recommended Project Structure
src/
├── main.ts
├── app.module.ts
├── workflow/
│   ├── workflow.module.ts
│   ├── workflow-engine.service.ts
│   ├── task.interface.ts
│   └── events.enum.ts


# Evaluation Criteria
Area  Description

Design Quality :- Is the task engine modular, testable, and clearly designed?
Error Handling :- Are retries, failures, and timeouts handled properly?
Concurrency :- tasks run concurrently when dependencies allow?
Code Quality :- Is the code clean, well-typed, and maintainable?
Use of NestJS :-Are modules/services/providers used idiomatically?
Bonus Features :-Are parallelism, decorators, or observables implemented elegantly?


## Run the code
npm run workflow-demo

## Run the test cases
npm test -- --testPathPattern=workflow-engine.service.spec.ts