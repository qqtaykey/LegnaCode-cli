// Hashline Edit System constants

/** Lines of context shown either side of a hash mismatch. */
export const MISMATCH_CONTEXT = 2

/** Filler hash used for the interior of a multi-line range; not validated. */
export const RANGE_INTERIOR_HASH = '**'

/** Optional patch envelope start marker; silently consumed when present. */
export const BEGIN_PATCH_MARKER = '*** Begin Patch'

/** Optional patch envelope end marker; terminates parsing when encountered. */
export const END_PATCH_MARKER = '*** End Patch'

/**
 * Recovery sentinel emitted when a stream is truncated mid-call.
 * Behaves like END_PATCH_MARKER for parsing — terminates the line loop —
 * and additionally surfaces a warning in the tool result.
 */
export const ABORT_MARKER = '*** Abort'

/** Warning text appended to the tool result when ABORT_MARKER terminates parsing. */
export const ABORT_WARNING =
  'Tool stream truncated mid-call. Applied ops above are valid. Re-issue any remaining edits.'

/** Tool name for registration */
export const HASHLINE_EDIT_TOOL_NAME = 'HashlineEdit'
