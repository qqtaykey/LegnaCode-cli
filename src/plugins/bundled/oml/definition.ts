/**
 * OML (Oh-My-LegnaCode) Builtin Plugin Definition
 *
 * Registers OML as a builtin plugin providing:
 * - 5 orchestration skills (/ultrawork, /ralph, /autopilot, /ralplan, /plan-oml)
 * - 19 agent skills (/oml:explore, /oml:planner, etc.)
 * - 11 engineering discipline skills from superpowers (/verify, /tdd, /debug, etc.)
 * - Magic keyword auto-detection in user prompts
 */

import type { BuiltinPluginDefinition } from '../../../types/plugin.js'
import { getOrchestratorSkills } from './skills.js'
import { getAgentSkills } from './agents.js'
import { getSuperpowersSkills } from './superpowers.js'

export const omlPluginDefinition: BuiltinPluginDefinition = {
  name: 'oml',
  description: 'Oh-My-LegnaCode — 智能编排层 + 工程纪律（35 skills + magic keywords）',
  version: '1.2.0',
  defaultEnabled: true,
  skills: [...getOrchestratorSkills(), ...getAgentSkills(), ...getSuperpowersSkills()],
}
