/**
 * Hashline Edit Tool prompt — describes the tool to the model.
 */

export const hashlineEditPrompt = `Performs precise file edits using hash-anchored line references.

## How it works

When you read a file, each line is displayed with a hash anchor: \`LINE+HASH|TEXT\`
For example: \`42sr|function hello() {\`

To edit, reference lines by their anchors instead of reproducing original text.

## Operations

### Replace lines (≔)
Replace a range of lines with new content:
\`\`\`
§src/foo.ts
≔42sr..45ab
new line 1
new line 2
\`\`\`

### Delete lines (≔ with no payload)
\`\`\`
§src/foo.ts
≔42sr..45ab
\`\`\`

### Insert before («)
\`\`\`
§src/foo.ts
«42sr
inserted line before 42
\`\`\`

### Insert after (»)
\`\`\`
§src/foo.ts
»42sr
inserted line after 42
\`\`\`

### Insert at file boundaries
\`\`\`
§src/foo.ts
«BOF
first line of file
»EOF
last line of file
\`\`\`

## Multi-file edits
Use multiple §PATH headers in one input:
\`\`\`
§src/a.ts
≔10ab
new content
§src/b.ts
»5cd
added line
\`\`\`

## Rules
- Always use the FULL anchor (line number + 2-letter hash) exactly as shown by read output
- For single-line edits, use just the anchor: \`≔42sr\`
- For multi-line ranges, use \`≔START..END\`
- Interior lines of a range use ** as hash placeholder (not validated)
- If a hash doesn't match, the edit is rejected — re-read the file and retry
`
