// Background task entry for MCP server connection monitoring.
// Tracks periodic health pings to MCP servers and surfaces status
// in the footer pill and Shift+Down dialog.

import type { AppState } from '../../state/AppState.js'
import type { SetAppState, Task, TaskStateBase } from '../../Task.js'
import { createTaskStateBase, generateTaskId } from '../../Task.js'
import type { AgentId } from '../../types/ids.js'
import { registerTask, updateTaskState } from '../../utils/task/framework.js'

export type MonitorMcpTaskState = TaskStateBase & {
  type: 'monitor_mcp'
  serverName?: string
  lastPingTime?: number
  lastStatus?: string
  agentId?: AgentId
}

export function isMonitorMcpTask(task: unknown): task is MonitorMcpTaskState {
  return (
    typeof task === 'object' &&
    task !== null &&
    'type' in task &&
    task.type === 'monitor_mcp'
  )
}

export function registerMonitorMcpTask(
  setAppState: SetAppState,
  opts: {
    serverName?: string
    agentId?: AgentId
    toolUseId?: string
  },
): string {
  const id = generateTaskId('monitor_mcp')
  const description = opts.serverName
    ? `Monitoring MCP server: ${opts.serverName}`
    : 'Monitoring MCP servers'
  const task: MonitorMcpTaskState = {
    ...createTaskStateBase(id, 'monitor_mcp', description, opts.toolUseId),
    type: 'monitor_mcp',
    status: 'running',
    serverName: opts.serverName,
    agentId: opts.agentId,
  }
  registerTask(task, setAppState)
  return id
}

export function updateMonitorMcpTask(
  taskId: string,
  setAppState: SetAppState,
  lastStatus: string,
): void {
  updateTaskState<MonitorMcpTaskState>(taskId, setAppState, task => ({
    ...task,
    lastPingTime: Date.now(),
    lastStatus,
  }))
}

export function completeMonitorMcpTask(
  taskId: string,
  setAppState: SetAppState,
): void {
  updateTaskState<MonitorMcpTaskState>(taskId, setAppState, task => ({
    ...task,
    status: 'completed',
    endTime: Date.now(),
    notified: true,
  }))
}

export function killMonitorMcp(
  taskId: string,
  setAppState: SetAppState,
): void {
  updateTaskState<MonitorMcpTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') return task
    return {
      ...task,
      status: 'killed',
      endTime: Date.now(),
      notified: true,
    }
  })
}

export function killMonitorMcpTasksForAgent(
  agentId: AgentId,
  getAppState: () => AppState,
  setAppState: SetAppState,
): void {
  const tasks = getAppState().tasks ?? {}
  for (const [taskId, task] of Object.entries(tasks)) {
    if (
      isMonitorMcpTask(task) &&
      task.agentId === agentId &&
      task.status === 'running'
    ) {
      killMonitorMcp(taskId, setAppState)
    }
  }
}

export const MonitorMcpTask: Task = {
  name: 'MonitorMcpTask',
  type: 'monitor_mcp',

  async kill(taskId, setAppState) {
    killMonitorMcp(taskId, setAppState)
  },
}
