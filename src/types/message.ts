/**
 * Core message types for LegnaCode conversation system.
 *
 * This file defines the discriminated union of all message types that flow
 * through the conversation pipeline: user input, assistant responses, system
 * notifications, attachments, progress events, and streaming events.
 *
 * Reconstructed from 188 import sites across the codebase.
 */

import type { UUID } from 'crypto'
import type {
  BetaContentBlock,
  BetaToolUseBlock,
  BetaRawMessageStreamEvent,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { BetaUsage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { APIError } from '@anthropic-ai/sdk'
import type { SDKAssistantMessageError } from '../entrypoints/agentSdkTypes.js'
import type { Progress } from '../Tool.js'
import type { Attachment } from '../utils/attachments.js'
import type { PermissionMode } from './permissions.js'

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type MessageOrigin =
  | { kind: 'human' }
  | { kind: 'channel'; server: string }
  | { kind: 'coordinator' }

export type SystemMessageLevel = 'info' | 'warning' | 'error'

export type PartialCompactDirection = 'forward' | 'backward'

export type StopHookInfo = {
  hookName: string
  durationMs: number
  command: string
  output?: string
  error?: string
}

export type CompactMetadata = {
  trigger: 'manual' | 'auto'
  preTokens: number
  userContext?: string
  messagesSummarized?: number
}

// ---------------------------------------------------------------------------
// UserMessage
// ---------------------------------------------------------------------------

export type UserMessage = {
  type: 'user'
  uuid: UUID
  timestamp: string
  message: {
    role: 'user'
    content: string | ContentBlockParam[]
  }
  isMeta?: true
  isVisibleInTranscriptOnly?: true
  isVirtual?: true
  isCompactSummary?: true
  summarizeMetadata?: {
    messagesSummarized: number
    userContext?: string
    direction?: PartialCompactDirection
  }
  toolUseResult?: unknown
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
  imagePasteIds?: number[]
  sourceToolAssistantUUID?: UUID
  sourceToolUseID?: string
  permissionMode?: PermissionMode
  origin?: MessageOrigin
}

// ---------------------------------------------------------------------------
// AssistantMessage
// ---------------------------------------------------------------------------

export type AssistantMessage = {
  type: 'assistant'
  uuid: UUID
  timestamp: string
  message: {
    id: string
    container: unknown | null
    model: string
    role: 'assistant'
    stop_reason: string | null
    stop_sequence: string | null
    type: 'message'
    usage: BetaUsage
    content: BetaContentBlock[]
    context_management: unknown | null
  }
  requestId: string | undefined
  apiError?: string
  error?: SDKAssistantMessageError
  errorDetails?: string
  isApiErrorMessage?: boolean
  isVirtual?: true
  isMeta?: true
  advisorModel?: string
  research?: unknown
}

// ---------------------------------------------------------------------------
// SystemMessage variants
// ---------------------------------------------------------------------------

type SystemMessageBase = {
  type: 'system'
  uuid: UUID
  timestamp: string
  isMeta?: boolean
}

export type SystemInformationalMessage = SystemMessageBase & {
  subtype: 'informational'
  content: string
  level: SystemMessageLevel
  toolUseID?: string
  preventContinuation?: boolean
}

export type SystemAPIErrorMessage = SystemMessageBase & {
  subtype: 'api_error'
  level: 'error'
  cause?: Error
  error: APIError
  retryInMs: number
  retryAttempt: number
  maxRetries: number
}

export type SystemCompactBoundaryMessage = SystemMessageBase & {
  subtype: 'compact_boundary'
  content: string
  level: 'info'
  compactMetadata: CompactMetadata
  logicalParentUuid?: UUID
}

export type SystemMicrocompactBoundaryMessage = SystemMessageBase & {
  subtype: 'microcompact_boundary'
  content: string
  level: 'info'
  microcompactMetadata: {
    trigger: 'auto'
    preTokens: number
    tokensSaved: number
    compactedToolIds: string[]
    clearedAttachmentUUIDs: string[]
  }
}

export type SystemStopHookSummaryMessage = SystemMessageBase & {
  subtype: 'stop_hook_summary'
  hookCount: number
  hookInfos: StopHookInfo[]
  hookErrors: string[]
  preventedContinuation: boolean
  stopReason: string | undefined
  hasOutput: boolean
  level: SystemMessageLevel
  toolUseID?: string
  hookLabel?: string
  totalDurationMs?: number
}

export type SystemTurnDurationMessage = SystemMessageBase & {
  subtype: 'turn_duration'
  durationMs: number
  budgetTokens?: number
  budgetLimit?: number
  budgetNudges?: number
  messageCount?: number
}

export type SystemAwaySummaryMessage = SystemMessageBase & {
  subtype: 'away_summary'
  content: string
}

export type SystemMemorySavedMessage = SystemMessageBase & {
  subtype: 'memory_saved'
  writtenPaths: string[]
}

export type SystemAgentsKilledMessage = SystemMessageBase & {
  subtype: 'agents_killed'
}

export type SystemApiMetricsMessage = SystemMessageBase & {
  subtype: 'api_metrics'
  ttftMs: number
  otps: number
  isP50?: boolean
  hookDurationMs?: number
  turnDurationMs?: number
  toolDurationMs?: number
  classifierDurationMs?: number
  toolCount?: number
  hookCount?: number
  classifierCount?: number
  configWriteCount?: number
}

export type SystemLocalCommandMessage = SystemMessageBase & {
  subtype: 'local_command'
  content: string
  level: 'info'
}

export type SystemPermissionRetryMessage = SystemMessageBase & {
  subtype: 'permission_retry'
  content: string
  commands: string[]
  level: 'info'
}

export type SystemBridgeStatusMessage = SystemMessageBase & {
  subtype: 'bridge_status'
  content: string
  url: string
  upgradeNudge?: string
}

export type SystemScheduledTaskFireMessage = SystemMessageBase & {
  subtype: 'scheduled_task_fire'
  content: string
}

export type SystemThinkingMessage = SystemMessageBase & {
  subtype: 'thinking'
}

export type SystemFileSnapshotMessage = SystemMessageBase & {
  subtype: 'file_snapshot'
  content: string
  level: 'info'
  snapshotFiles: Array<{
    key: string
    path: string
    content: string
  }>
}

// ---------------------------------------------------------------------------
// SystemMessage union
// ---------------------------------------------------------------------------

export type SystemMessage =
  | SystemInformationalMessage
  | SystemAPIErrorMessage
  | SystemCompactBoundaryMessage
  | SystemMicrocompactBoundaryMessage
  | SystemStopHookSummaryMessage
  | SystemTurnDurationMessage
  | SystemAwaySummaryMessage
  | SystemMemorySavedMessage
  | SystemAgentsKilledMessage
  | SystemApiMetricsMessage
  | SystemLocalCommandMessage
  | SystemPermissionRetryMessage
  | SystemBridgeStatusMessage
  | SystemScheduledTaskFireMessage
  | SystemThinkingMessage
  | SystemFileSnapshotMessage

// ---------------------------------------------------------------------------
// Other message types
// ---------------------------------------------------------------------------

export type AttachmentMessage<A extends Attachment = Attachment> = {
  type: 'attachment'
  uuid: UUID
  timestamp: string
  attachment: A
}

export type ProgressMessage<P extends Progress = Progress> = {
  type: 'progress'
  data: P
  toolUseID: string
  parentToolUseID: string
  uuid: UUID
  timestamp: string
}

export type StreamEvent = {
  type: 'stream_event'
  event: BetaRawMessageStreamEvent
  ttftMs?: number
}

export type RequestStartEvent = {
  type: 'stream_request_start'
}

export type TombstoneMessage = {
  type: 'tombstone'
  message: AssistantMessage
}

export type ToolUseSummaryMessage = {
  type: 'tool_use_summary'
  summary: string
  precedingToolUseIds: string[]
  uuid: UUID
  timestamp: string
}

export type HookResultMessage = AttachmentMessage

// ---------------------------------------------------------------------------
// Main Message union
// ---------------------------------------------------------------------------

export type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | AttachmentMessage
  | ProgressMessage
  | StreamEvent
  | RequestStartEvent
  | TombstoneMessage
  | ToolUseSummaryMessage

// ---------------------------------------------------------------------------
// Normalized variants (single-content-block messages for rendering pipeline)
// ---------------------------------------------------------------------------

export type NormalizedUserMessage = Omit<UserMessage, 'message'> & {
  type: 'user'
  message: {
    role: 'user'
    content: [ContentBlockParam]
  }
}

export type NormalizedAssistantMessage<C extends BetaContentBlock = BetaContentBlock> =
  Omit<AssistantMessage, 'message'> & {
    type: 'assistant'
    message: AssistantMessage['message'] & {
      content: [C]
    }
  }

export type NormalizedMessage =
  | NormalizedUserMessage
  | NormalizedAssistantMessage
  | AttachmentMessage
  | ProgressMessage
  | SystemMessage

// ---------------------------------------------------------------------------
// UI rendering types
// ---------------------------------------------------------------------------

export type GroupedToolUseMessage = {
  type: 'grouped_tool_use'
  toolName: string
  messages: NormalizedAssistantMessage<BetaToolUseBlock>[]
  results: NormalizedUserMessage[]
  displayMessage: NormalizedAssistantMessage<BetaToolUseBlock>
  uuid: string
  timestamp: string
  messageId: string
}

export type CollapsibleMessage =
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | GroupedToolUseMessage

export type CollapsedReadSearchGroup = {
  type: 'collapsed_read_search'
  searchCount: number
  readCount: number
  listCount: number
  replCount: number
  memorySearchCount: number
  memoryReadCount: number
  memoryWriteCount: number
  readFilePaths: string[]
  searchArgs: string[]
  latestDisplayHint: string | undefined
  messages: CollapsibleMessage[]
  displayMessage: CollapsibleMessage
  uuid: UUID
  timestamp: string
  teamMemorySearchCount?: number
  teamMemoryReadCount?: number
  teamMemoryWriteCount?: number
  mcpCallCount?: number
  mcpServerNames?: string[]
  bashCount?: number
  gitOpBashCount?: number
  commits?: { sha: string; kind: string }[]
  pushes?: { branch: string }[]
  branches?: { ref: string; action: string }[]
  prs?: { number: number; url?: string; action: string }[]
  hookTotalMs?: number
  hookCount?: number
  hookInfos?: StopHookInfo[]
  relevantMemories?: { path: string; content: string; mtimeMs: number }[]
}

export type RenderableMessage =
  | NormalizedUserMessage
  | NormalizedAssistantMessage
  | AttachmentMessage
  | SystemMessage
  | GroupedToolUseMessage
  | CollapsedReadSearchGroup
