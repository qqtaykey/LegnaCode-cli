import * as React from 'react'
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { Box, Text } from '../../ink.js'
import { FORK_DIRECTIVE_PREFIX } from '../../constants/xml.js'

export function UserForkBoilerplateMessage({
  addMargin,
  param,
}: {
  addMargin: boolean
  param: TextBlockParam
}): React.ReactNode {
  // Extract the directive from the boilerplate text
  const idx = param.text.indexOf(FORK_DIRECTIVE_PREFIX)
  const directive = idx >= 0
    ? param.text.slice(idx + FORK_DIRECTIVE_PREFIX.length).trim()
    : '(unknown directive)'

  return (
    <Box marginTop={addMargin ? 1 : 0} paddingX={1}>
      <Text dimColor>
        <Text color="permission">⑂</Text> Fork: <Text italic>{directive}</Text>
      </Text>
    </Box>
  )
}
