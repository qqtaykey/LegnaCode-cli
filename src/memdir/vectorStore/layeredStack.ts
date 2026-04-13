/**
 * 4-Layer Memory Stack with budget-aware injection.
 * Combines mempalace's layered approach with OpenViking's L0/L1/L2
 * content tiering and score-filtered budget-capped injection.
 *
 * L0: Identity (~100 tokens) — always loaded
 * L1: Top drawers by importance, using tiered content (L0→L1→L2 degradation)
 * L2: Wing/room filtered retrieval — on-demand
 * L3: Full vector search — explicit recall only
 */

import type { DrawerStore } from './drawerStore.js'
import type { Drawer } from './types.js'
import { estimateTokens } from './contentTiering.js'

const DEFAULT_WAKEUP_BUDGET = 800
const DEFAULT_RECALL_BUDGET = 4000
const L3_MAX_DRAWERS = 10

export interface WakeUpResult {
  /** Combined L0+L1 text for system prompt injection */
  text: string
  /** Approximate token count */
  tokenEstimate: number
  /** Number of drawers included */
  drawerCount: number
}

/** Tiered recall result with degradation info. */
export interface TieredRecallItem {
  drawer: Drawer
  /** Which content tier was used: 'L0' | 'L1' | 'L2' */
  tier: 'L0' | 'L1' | 'L2'
  /** The actual content injected (may be L0/L1 summary or L2 full) */
  displayContent: string
}

export class LayeredStack {
  constructor(
    private store: DrawerStore,
    private identityText: string = '',
  ) {}

  setIdentity(text: string): void {
    this.identityText = text
  }

  /**
   * Budget-aware wake-up: L0 identity + top drawers with degradation.
   * Fills token budget greedily: tries L1 first, degrades to L0 if over budget.
   */
  wakeUp(wing?: string, tokenBudget = DEFAULT_WAKEUP_BUDGET): WakeUpResult {
    let budget = tokenBudget
    const parts: string[] = []
    let drawerCount = 0

    // Phase 1: Identity (always)
    if (this.identityText) {
      parts.push(`[Identity]\n${this.identityText}`)
      budget -= estimateTokens(this.identityText)
    }

    // Phase 2: Top drawers, budget-capped with degradation
    const topDrawers = this.store.topByImportance(30, wing)
    const lines: string[] = []

    for (const d of topDrawers) {
      if (budget <= 0) break

      const l1Text = d.contentL1 || d.content.slice(0, 400)
      const l0Text = d.contentL0 || d.content.slice(0, 100)
      const l1Cost = estimateTokens(l1Text)
      const l0Cost = estimateTokens(l0Text)

      if (l1Cost <= budget) {
        lines.push(`- [${d.room}] ${l1Text}`)
        budget -= l1Cost
        drawerCount++
      } else if (l0Cost <= budget) {
        lines.push(`- [${d.room}] ${l0Text}`)
        budget -= l0Cost
        drawerCount++
      }
      // else: skip — can't fit even L0
    }

    if (lines.length > 0) {
      parts.push(`[Key Memories]\n${lines.join('\n')}`)
    }

    const text = parts.join('\n\n')
    return { text, tokenEstimate: tokenBudget - budget, drawerCount }
  }

  /**
   * Budget-capped recall with L2→L1→L0 degradation.
   * Adapted from OpenViking's _parse_viking_memory strategy.
   */
  recallWithBudget(query: string, wing?: string, charBudget = DEFAULT_RECALL_BUDGET): TieredRecallItem[] {
    const results = this.store.search(query, { wing, topK: 20, minSimilarity: 0.3 })
    const output: TieredRecallItem[] = []
    let remaining = charBudget

    for (const { drawer } of results) {
      if (remaining <= 0) break

      const fullLen = drawer.content.length
      const l1 = drawer.contentL1 || drawer.content.slice(0, 400)
      const l0 = drawer.contentL0 || drawer.content.slice(0, 100)

      if (fullLen <= remaining) {
        output.push({ drawer, tier: 'L2', displayContent: drawer.content })
        remaining -= fullLen
      } else if (l1.length <= remaining) {
        output.push({ drawer, tier: 'L1', displayContent: l1 })
        remaining -= l1.length
      } else if (l0.length <= remaining) {
        output.push({ drawer, tier: 'L0', displayContent: l0 })
        remaining -= l0.length
      }
    }

    return output
  }

  /**
   * L2: Topic-filtered retrieval with actual query for ranking.
   */
  recallByTopic(query: string, wing: string, room?: string, limit = 8): Drawer[] {
    return this.store.search(query || wing, {
      wing,
      room,
      topK: limit,
      minSimilarity: 0.15,
      minImportance: 0.4,
    }).map(r => r.drawer)
  }

  /**
   * L3: Full vector search for explicit recall.
   */
  recallByQuery(query: string, wing?: string, limit = L3_MAX_DRAWERS): Drawer[] {
    return this.store.search(query, {
      wing,
      topK: limit,
      minSimilarity: 0.25,
    }).map(r => r.drawer)
  }

  /**
   * Format tiered recall items as context text.
   */
  formatTieredRecall(items: TieredRecallItem[], label = 'Relevant Context'): string {
    if (items.length === 0) return ''
    const lines = items.map(i =>
      `- [${i.drawer.wing}/${i.drawer.room}] ${i.displayContent}`
    )
    return `[${label}]\n${lines.join('\n')}`
  }

  /**
   * Format flat drawer list (backward compat).
   */
  formatRecall(drawers: Drawer[], label = 'Recalled Memories'): string {
    if (drawers.length === 0) return ''
    const lines = drawers.map(d =>
      `- [${d.wing}/${d.room}] ${d.content.slice(0, 300)}${d.content.length > 300 ? '…' : ''}`
    )
    return `[${label}]\n${lines.join('\n')}`
  }
}
