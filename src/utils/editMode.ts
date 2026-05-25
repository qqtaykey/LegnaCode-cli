/**
 * Edit mode configuration — controls whether the classic str_replace or
 * hashline anchor-based editing is used.
 */

export type EditMode = 'classic' | 'hashline'

const DEFAULT_EDIT_MODE: EditMode = 'hashline'

/**
 * Resolve the active edit mode from settings.
 * Falls back to 'hashline' for new installations.
 */
export function getEditMode(): EditMode {
  // TODO: Read from settings.json when settings integration is wired up
  // For now, return the default
  return DEFAULT_EDIT_MODE
}

/**
 * Check if hashline edit mode is active.
 */
export function isHashlineEditMode(): boolean {
  return getEditMode() === 'hashline'
}
