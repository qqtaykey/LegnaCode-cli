import type { SetAppState, Task, TaskStateBase } from '../../Task.js'
import { createTaskStateBase, generateTaskId } from '../../Task.js'
import { registerTask, updateTaskState } from '../../utils/task/framework.js'
import type { AgentId } from '../../types/ids.js'

export type LocalWorkflowTaskState = TaskStateBase & {
  type: 'local_workflow'
  workflowName: string
  currentStep?: number
  totalSteps?: number
  agentId?: AgentId
}

export function isLocalWorkflowTask(
  task: unknown,
): task is LocalWorkflowTaskState {
  return (
    typeof task === 'object' &&
    task !== null &&
    'type' in task &&
    task.type === 'local_workflow'
  )
}

export function registerWorkflowTask(
  setAppState: SetAppState,
  opts: {
    workflowName: string
    totalSteps?: number
    toolUseId?: string
    agentId?: AgentId
  },
): string {
  const id = generateTaskId('local_workflow')
  const task: LocalWorkflowTaskState = {
    ...createTaskStateBase(
      id,
      'local_workflow',
      `Workflow: ${opts.workflowName}`,
      opts.toolUseId,
    ),
    type: 'local_workflow',
    status: 'running',
    workflowName: opts.workflowName,
    totalSteps: opts.totalSteps,
    currentStep: 0,
    agentId: opts.agentId,
  }
  registerTask(task, setAppState)
  return id
}

export function killWorkflowTask(
  taskId: string,
  setAppState: SetAppState,
): void {
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') return task
    return {
      ...task,
      status: 'killed',
      endTime: Date.now(),
      notified: true,
    }
  })
}

export function skipWorkflowAgent(
  taskId: string,
  setAppState: SetAppState,
): void {
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') return task
    return {
      ...task,
      currentStep: (task.currentStep ?? 0) + 1,
    }
  })
}

export function retryWorkflowAgent(
  taskId: string,
  setAppState: SetAppState,
): void {
  // Re-run the current step by resetting status to running (no-op if already running).
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task => ({
    ...task,
    status: 'running',
  }))
}

export function completeWorkflowTask(
  taskId: string,
  setAppState: SetAppState,
): void {
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task => ({
    ...task,
    status: 'completed',
    endTime: Date.now(),
    notified: true,
  }))
}

export function failWorkflowTask(
  taskId: string,
  setAppState: SetAppState,
): void {
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task => ({
    ...task,
    status: 'failed',
    endTime: Date.now(),
    notified: true,
  }))
}

export const LocalWorkflowTask: Task = {
  name: 'LocalWorkflowTask',
  type: 'local_workflow',

  async kill(taskId, setAppState) {
    killWorkflowTask(taskId, setAppState)
  },
}
