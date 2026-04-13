# LegnaCode vs Claude Code Feature Comparison

🌐 [中文文档](./COMPARISON.zh-CN.md)

> LegnaCode is built on top of the Claude Code upstream project, deeply enhanced while maintaining full compatibility. Below is a detailed side-by-side comparison.

## Core Capabilities

| Feature | Claude Code | LegnaCode |
|---------|:-----------:|:---------:|
| Terminal AI coding assistant | ✅ | ✅ |
| 45+ built-in tools | ✅ | ✅ |
| MCP protocol support | ✅ | ✅ |
| Multi-agent collaboration | ✅ | ✅ |
| Plugin & skill system | ✅ | ✅ |
| Git workflow management | ✅ | ✅ |

## Models & Backends

| Feature | Claude Code | LegnaCode |
|---------|:-----------:|:---------:|
| Anthropic API | ✅ | ✅ |
| AWS Bedrock | ✅ | ✅ |
| GCP Vertex | ✅ | ✅ |
| Azure OpenAI | ❌ | ✅ |
| MiniMax deep native integration | ❌ | ✅ 6 multimodal tools auto-registered |
| Intelligent model routing | ❌ | ✅ Auto-selects model tier by prompt complexity |
| Model Adapter architecture | Partial | ✅ Full adapters (MiniMax/Azure/custom) |

## Multimodal (MiniMax-exclusive)

| Feature | Claude Code | LegnaCode |
|---------|:-----------:|:---------:|
| AI image generation | ❌ | ✅ MiniMaxImageGenerate |
| AI video generation | ❌ | ✅ MiniMaxVideoGenerate |
| AI speech synthesis | ❌ | ✅ MiniMaxSpeechSynthesize |
| AI music generation | ❌ | ✅ MiniMaxMusicGenerate |
| AI image understanding | ❌ | ✅ MiniMaxVisionDescribe |
| AI web search | ❌ | ✅ MiniMaxWebSearch |
| Multimodal workflow orchestration | ❌ | ✅ Auto-chains multiple tools for complex tasks |
| Multimodal skill packs | ❌ | ✅ 5 built-in skills to guide AI orchestration |

## Memory System

| Feature | Claude Code | LegnaCode |
|---------|:-----------:|:---------:|
| MEMORY.md persistent memory | ✅ ~8K tokens/turn | ✅ Compatible & preserved |
| 4-layer memory stack | ❌ | ✅ L0+L1 only ~800 tokens/turn (88% savings) |
| Vector semantic search | ❌ | ✅ TF-IDF + cosine similarity, <5ms |
| DrawerStore persistence | ❌ | ✅ SQLite + WAL audit log |
| Temporal knowledge graph | ❌ | ✅ Entity-relation + time-validity queries |
| Room auto-classification | ❌ | ✅ 6 categories (facts/decisions/events/...) |
| PreCompact memory saving | ❌ | ✅ Auto-extracts high-value exchanges before compaction |
| Exchange-pair chunking | ❌ | ✅ Q+A pairing + 5-category scored tagging |
| Cross-session search | ❌ | ✅ `/recall` command |
| Memory Provider plugins | ❌ | ✅ Pluggable memory backends |

## Context Management

| Feature | Claude Code | LegnaCode |
|---------|:-----------:|:---------:|
| Auto Compact | ✅ | ✅ |
| Micro Compact | ✅ | ✅ |
| History Snip | ✅ | ✅ |
| Tool output pre-pruning | ❌ | ✅ Auto-trims large tool_result payloads |
| Budget pressure injection | ❌ | ✅ Nudges model to wrap up when context >80% |
| Worker thread pool | ❌ | ✅ Offloads large file operations |

## Agent Enhancements

| Feature | Claude Code | LegnaCode |
|---------|:-----------:|:---------:|
| Sub-agent spawning | ✅ | ✅ |
| Team collaboration | ✅ | ✅ |
| RPC subprocess tool execution | ❌ | ✅ UDS RPC, compresses multi-step ops into one inference |
| Autonomous skill detection | ❌ | ✅ Detects repeated patterns, prompts to save as skill |
| Tool schema export | ❌ | ✅ Anthropic-compatible format |

## User Experience

| Feature | Claude Code | LegnaCode |
|---------|:-----------:|:---------:|
| Verbose mode | Off by default | ✅ On by default |
| Token/Timer display | Shows after 30s | ✅ Shows from second 1 |
| Compact status indicator | ❌ Silent execution | ✅ Displays "Compacting..." |
| Interruption reason display | ❌ Only shows it stopped | ✅ Shows specific interruption reason |
| Output retry indicator | ❌ Silent retry | ✅ Shows retry progress |
| Tool execution log | ❌ | ✅ Tool name + queue depth |
| Apple Terminal notifications | ❌ Inverted logic bug | ✅ Fixed |

## Configuration & Deployment

| Feature | Claude Code | LegnaCode |
|---------|:-----------:|:---------:|
| Global config directory | `~/.claude/` | `~/.legna/` (auto-migrated) |
| WebUI admin panel | ❌ | ✅ `legna admin` |
| Config migration tool | ❌ | ✅ `legna migrate` |
| MiniMax authentication | ❌ | ✅ `/auth-minimax` |
| Pure TS syntax highlighting | ❌ Requires native modules | ✅ Zero native dependencies |
| Official registry install | — | ✅ `--registry=https://registry.npmjs.org` |

## Platform Support

| Platform | Claude Code | LegnaCode |
|----------|:-----------:|:---------:|
| macOS arm64 | ✅ | ✅ |
| macOS x64 | ✅ | ✅ |
| Linux x64 | ✅ | ✅ |
| Linux arm64 | ✅ | ✅ |
| Windows x64 | ✅ | ✅ |

---

> LegnaCode maintains full compatibility with the Claude Code upstream. All original features work as expected. Enhancements are non-invasive by design and do not affect existing workflows.
