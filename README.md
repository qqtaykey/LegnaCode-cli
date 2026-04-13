# LegnaCode CLI

🌐 [中文文档](./README.zh-CN.md)

<img width="1256" height="416" alt="image" src="https://github.com/user-attachments/assets/5e4717e6-3404-4901-9f5c-1c6462fb1c1a" />
<img width="1072" height="874" alt="image" src="https://github.com/user-attachments/assets/819c39e8-9db6-4d8d-b911-13600c525422" />

LegnaCode is an intelligent terminal programming assistant powered by Anthropic Claude. It lets you collaborate with AI directly from the command line to accomplish software engineering tasks — editing files, running commands, searching code, managing Git workflows, and more.

> 📊 **Detailed comparison with the original Claude Code** → [COMPARISON.md](./COMPARISON.md)

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full details.

| Version | Date | Summary |
|---------|------|---------|
| [1.4.4](./CHANGELOG.md#144---2026-04-11) | 2026-04-11 | Status messages now display as spinner lines (no longer pollute the conversation); added feature comparison doc |
| [1.4.3](./CHANGELOG.md#143---2026-04-11) | 2026-04-11 | Mempalace memory architecture (DrawerStore + TF-IDF vector search + 4-layer memory stack + temporal knowledge graph); ~88% token savings |
| [1.4.2](./CHANGELOG.md#142---2026-04-11) | 2026-04-11 | Progress feedback enhancements (eliminated 8 silent code paths); verbose enabled by default; instant Token/Timer display; visible interruption reasons |
| [1.4.0](./CHANGELOG.md#140---2026-04-11) | 2026-04-11 | Deep native MiniMax compatibility (6 multimodal tools); RPC subprocess tool execution; Memory Provider plugin system; smart model routing; autonomous skill detection; context compression enhancements; cross-session memory search |
| [1.3.7](./CHANGELOG.md#137---2026-04-09) | 2026-04-09 | Resume session detection fix; Interrupted diagnostic logging; background task status visibility improvements |
| [1.3.6](./CHANGELOG.md#136---2026-04-09) | 2026-04-09 | Fixed Windows path separator causing false "File has been unexpectedly modified" errors in the Edit tool |
| [1.3.5](./CHANGELOG.md#135---2026-04-07) | 2026-04-07 | Fixed SessionStart hook errors; deep fix for Windows alt-screen rendering (eliminated fullReset flicker) |
| [1.3.4](./CHANGELOG.md#134---2026-04-07) | 2026-04-07 | OML Superpowers engineering discipline (11 skills: /verify /tdd /debug /brainstorm etc.); SessionStart skill guidance |
| [1.3.3](./CHANGELOG.md#133---2026-04-07) | 2026-04-07 | Built-in OML smart orchestration layer (magic keywords + 19 agent skills); Windows Terminal fullscreen fix |
| [1.3.2](./CHANGELOG.md#132---2026-04-07) | 2026-04-07 | Disabled History Snip; fixed Windows Terminal streaming text rendering |
| [1.3.1](./CHANGELOG.md#131---2026-04-06) | 2026-04-06 | Fixed 1M model being snipped prematurely; snip threshold now adapts to context window size |
| [1.3.0](./CHANGELOG.md#130---2026-04-04) | 2026-04-04 | Project-local storage: sessions/skills/memory/rules moved to `<project>/.legna/`; global migration `~/.claude/` → `~/.legna/`; `legna migrate` command |
| [1.2.1](./CHANGELOG.md#121---2026-04-04) | 2026-04-04 | Model adapter layer: deep compatibility for MiMo, GLM, DeepSeek, Kimi, and MiniMax providers |
| [1.2.0](./CHANGELOG.md#120---2026-04-03) | 2026-04-03 | Sessions grouped by project; resume with cd; migration supports session records; native Windows compilation |
| [1.1.9](./CHANGELOG.md#119---2026-04-03) | 2026-04-03 | postinstall auto-installs platform package; fixed optionalDependencies failure on Windows/mirror registries |
| [1.1.8](./CHANGELOG.md#118---2026-04-03) | 2026-04-03 | Bin wrapper auto-installs missing platform package; fixed Windows npm global install issues |
| [1.1.7](./CHANGELOG.md#117---2026-04-03) | 2026-04-03 | Fully fixed Windows external module errors; cleared external list |
| [1.1.6](./CHANGELOG.md#116---2026-04-03) | 2026-04-03 | Fixed Windows external module errors; automated cross-platform release workflow; unified version numbers |
| [1.1.5](./CHANGELOG.md#115---2026-04-03) | 2026-04-03 | WebUI admin panel (`legna admin`); dual-directory management; config migration; npm cross-platform publishing |
| [1.0.9](./CHANGELOG.md#109---2026-04-03) | 2026-04-03 | i18n multilingual completion; built-in styled status bar; automatic config migration |
| [1.0.8](./CHANGELOG.md#108---2026-04-02) | 2026-04-02 | MONITOR_TOOL, WORKFLOW_SCRIPTS, HISTORY_SNIP — 3 major subsystems, 47 flags total |
| [1.0.7](./CHANGELOG.md#107---2026-04-02) | 2026-04-02 | TERMINAL_PANEL, WEB_BROWSER_TOOL, TEMPLATES, BG_SESSIONS — 44 flags total |
| [1.0.6](./CHANGELOG.md#106---2026-04-02) | 2026-04-02 | CACHED_MICROCOMPACT, AGENT_TRIGGERS, TREE_SITTER_BASH and 7 more features — 40 flags total |
| [1.0.5](./CHANGELOG.md#105---2026-04-02) | 2026-04-02 | AGENT_TRIGGERS, MCP_SKILLS, REACTIVE_COMPACT, REVIEW_ARTIFACT and 6 more features — 39 flags total |
| [1.0.4](./CHANGELOG.md#104---2026-04-02) | 2026-04-02 | ULTRAPLAN, VERIFICATION_AGENT, AUTO_THEME and 10 more features — 33 flags total |
| [1.0.3](./CHANGELOG.md#103---2026-04-02) | 2026-04-02 | COMMIT_ATTRIBUTION, BASH_CLASSIFIER, EXTRACT_MEMORIES and 16 more features |
| [1.0.2](./CHANGELOG.md#102---2026-04-02) | 2026-04-02 | QUICK_SEARCH, MESSAGE_ACTIONS, FORK_SUBAGENT, HISTORY_PICKER |
| [1.0.1](./CHANGELOG.md#101---2026-04-02) | 2026-04-02 | BUDDY virtual pet, TOKEN_BUDGET, build system fixes |
| [1.0.0](./CHANGELOG.md#100---2026-03-31) | 2026-03-31 | Initial release |

---

## Acknowledgments

This project is built upon the open-source codebase of [Claude Code CLI](https://github.com/anthropics/claude-code).

Claude Code is an outstanding terminal AI programming tool created by the Anthropic team. It pioneered the deep integration of large language models with command-line development workflows, providing rich capabilities including file editing, code search, shell execution, and the MCP protocol. LegnaCode stands on the shoulders of this excellent project, with customizations and brand adaptations.

Thanks to the Anthropic team for open-sourcing Claude Code CLI, enabling the community to explore further possibilities on this foundation.

---

## Features

- **Deep Native MiniMax Compatibility** — Automatically registers 6 multimodal tools (image/video/speech/music/search/vision) when using MiniMax models; `/auth-minimax` to configure API key
- **Terminal-Native Experience** — Modern terminal UI built with React + Ink, with syntax highlighting and structured diff display
- **45+ Built-in Tools** — File read/write, code search (Glob/Grep), shell execution, web fetching, Jupyter Notebook editing, and more
- **RPC Subprocess Tool Execution** — AI-generated scripts call back to LegnaCode tools via Unix Domain Socket, compressing multi-step operations into a single inference
- **Memory Provider Plugin System** — Pluggable memory backends with a built-in filesystem provider; supports external provider extensions
- **Smart Model Routing** — Automatically routes to fast/default/strong model tiers based on prompt complexity
- **Autonomous Skill Detection** — Detects repetitive tool call patterns and suggests saving them as reusable skills
- **Context Compression Enhancements** — Tool output pre-pruning + budget pressure injection for more efficient long conversations
- **Cross-Session Memory Search** — `/recall` command searches historical sessions with keyword matching + relevance ranking
- **Multi-Layer Security** — Bash/Zsh/PowerShell command safety detection, sandboxing, and tiered permission controls
- **Multi-Cloud AI Backends** — Supports Anthropic API, AWS Bedrock, GCP Vertex, and Azure
- **MCP Protocol Support** — Connect external tools and data sources via Model Context Protocol
- **Multi-Agent Collaboration** — Sub-agent spawning, team collaboration, and task orchestration
- **Plugin & Skill System** — Extensible plugin architecture and reusable skill workflows
- **Persistent Memory** — Cross-session context memory system
- **Pure TS Syntax Highlighting** — Built-in highlight.js-based pure TypeScript syntax highlighting with no native module dependencies
- **WebUI Admin Panel** — `legna admin` launches a browser-based admin panel for visual config editing, profile switching, session browsing, and data migration
- **`legna migrate` Command** — Manually migrate `~/.claude/` data to project-local `.legna/`; supports `--global`/`--sessions`/`--dry-run`

---

## Requirements

| Dependency | Version |
|------------|---------|
| [Bun](https://bun.sh) | >= 1.2.0 |
| Node.js | >= 18 (optional) |
| Git | >= 2.0 |
| OS | macOS / Linux |

---

## Installation

### Option 1: npm Global Install (Recommended)

```bash
npm install -g @legna-lnc/legnacode
```

If using a mirror registry (e.g., cnpm, Taobao mirror) and the install fails or the version is out of sync, you can specify the official registry:

```bash
npm install -g @legna-lnc/legnacode --registry=https://registry.npmjs.org
```

Once installed, the `legna` command is available in any directory. It automatically downloads the precompiled binary for your platform (supports macOS arm64/x64, Linux x64/arm64, Windows x64).

```bash
# Verify installation
legna --version

# Update to the latest version
npm update -g @legna-lnc/legnacode
```

### Option 2: Build from Source

```bash
git clone https://github.com/LegnaOS/LegnaCode-cli.git
cd LegnaCode-cli
bun install
bun run compile
# The compiled binary is ./legna — move it to your PATH
```

---

## Quick Start

```bash
# Interactive mode
legna

# Non-interactive mode (ask directly)
legna -p "Explain what this code does"

# Continue the last session
legna --continue

# Check version
legna --version
```

---

## Project Structure

```
├── src/
│   ├── entrypoints/       # Entry point (cli.tsx)
│   ├── server/            # HTTP server (admin WebUI)
│   ├── components/        # React/Ink terminal UI components
│   ├── tools/             # Built-in tools (Bash, file ops, search, etc.)
│   ├── services/          # API calls, MCP client, analytics, etc.
│   ├── native-ts/         # Pure TS replacements for native modules (syntax highlighting, etc.)
│   ├── utils/             # Utility functions
│   └── hooks/             # React hooks
├── webui/                 # Admin WebUI frontend (React + Vite + Tailwind)
├── stubs/                 # Native module stubs (compile-time external dependency placeholders)
├── scripts/               # Build scripts
├── bunfig.toml            # Bun build config (Feature Flags, macro definitions)
└── package.json
```

---

## Build

LegnaCode uses Bun's bundler for building, with two modes:

- `bun run build` — Build to `dist/` directory, suitable for development and debugging
- `bun run compile` — Compile to a standalone `legna` binary, no Bun runtime required

### Admin WebUI

`legna admin` launches a browser-based admin panel that lets you manage all configuration through a web interface — no manual JSON editing needed.

```bash
# Launch admin panel (default port 3456, auto-opens browser)
legna admin

# Custom port
legna admin 8080
```

Tabs at the top of the panel switch between management scopes: **Claude** (`~/.claude/`) and **LegnaCode** (`~/.legna/`). Each scope provides four panels:

| Panel | Function |
|-------|----------|
| Config Editor | Visual editing of settings.json: API endpoint, API key, model mapping (Opus/Sonnet/Haiku), timeout, permission mode, language, etc. |
| Config Profiles | Lists all settings*.json files, shows baseUrl/model, one-click to switch active profile |
| Session History | Browse past sessions showing project path, slug, timestamp, prompt count; one-click copy `legna --resume` command |
| Config Migration | Bidirectional Claude ↔ LegnaCode migration; supports full or selective field migration with pre-migration diff preview |

> When running from source, build the frontend first: `cd webui && npm install && npm run build`, then `bun run src/server/admin.ts`. The npm global install version includes the pre-built WebUI.

Build-time constants such as version numbers are injected via `[bundle.define]` in `bunfig.toml`. Feature Flags in `[bundle.features]` enable dead code elimination.

Native modules (`color-diff-napi`, `modifiers-napi`, etc.) are marked as `external` and load placeholder implementations from `stubs/` at runtime. Syntax highlighting has been switched to a pure TypeScript implementation under `src/native-ts/color-diff/`, requiring no native compilation dependencies.

---

## Configuration

LegnaCode uses `~/.legna/` as the global config directory, with project-level data stored in `<project>/.legna/`:

- `~/.legna/settings.json` — Global user settings
- `~/.legna/.credentials.json` — Authentication credentials
- `<project>/.legna/sessions/` — Project session records (JSONL)
- `<project>/.legna/skills/` — Project skills
- `<project>/.legna/rules/` — Project rules
- `<project>/.legna/settings.json` — Project-level settings
- `LEGNA.md` — Project instruction file, automatically read and followed by the AI

> On first launch, global data is automatically migrated one-way from `~/.claude/` to `~/.legna/` (existing files are not overwritten). Legacy sessions under `~/.claude/projects/` are read automatically via a fallback chain — no manual migration needed. Set `LEGNA_NO_CONFIG_SYNC=1` to disable automatic migration.

### legna migrate

Manually migrate data:

```bash
# Migrate everything (global + current project sessions)
legna migrate

# Migrate global data only: ~/.claude/ → ~/.legna/
legna migrate --global

# Migrate current project sessions to local .legna/sessions/ only
legna migrate --sessions

# Dry run (no files are actually moved)
legna migrate --dry-run
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `CLAUDE_CODE_USE_BEDROCK` | Use AWS Bedrock backend |
| `CLAUDE_CODE_USE_VERTEX` | Use GCP Vertex backend |
| `CLAUDE_CODE_SYNTAX_HIGHLIGHT` | Set to `0` to disable syntax highlighting |
| `MINIMAX_API_KEY` | MiniMax API key (enables multimodal tools) |
| `MINIMAX_REGION` | MiniMax region: `global` (default) or `cn` |
| `MINIMAX_BASE_URL` | Custom MiniMax API URL (overrides region default) |

---

## MiniMax Multimodal Integration

When using a MiniMax model (`ANTHROPIC_BASE_URL` pointing to `api.minimax.io` or `api.minimaxi.com`) with `MINIMAX_API_KEY` configured, LegnaCode automatically registers 6 native multimodal tools that the AI can call directly.

### Configuration

```bash
# Option 1: Environment variables
export MINIMAX_API_KEY="your-api-key"
export MINIMAX_REGION="global"  # or "cn"

# Option 2: Interactive configuration (persisted to ~/.legna/minimax-credentials.json)
legna
> /auth-minimax your-api-key
```

Get your API key: [MiniMax Global](https://platform.minimax.io) or [MiniMax China](https://platform.minimaxi.com)

### Multimodal Tools

| Tool | Function | Example |
|------|----------|---------|
| `MiniMaxImageGenerate` | Text-to-image generation | "Generate a cyberpunk cityscape at night" |
| `MiniMaxVideoGenerate` | Text/image-to-video generation | "Turn this image into a 5-second animation" |
| `MiniMaxSpeechSynthesize` | Text-to-speech | "Convert this text to spoken audio" |
| `MiniMaxMusicGenerate` | Text-to-music generation | "Generate an upbeat piano background track" |
| `MiniMaxVisionDescribe` | Image understanding and analysis | "Describe the contents of this image" |
| `MiniMaxWebSearch` | Web search | "Search for the latest TypeScript 5.x features" |

These tools are only enabled when using MiniMax models and do not affect the tool list for other models.

### Multimodal Workflow

The AI can automatically orchestrate multiple tools to complete complex tasks:

```
User: Help me create a promotional video for my project

AI auto-orchestrates:
1. Analyze the project README, extract key selling points
2. MiniMaxImageGenerate → Generate keyframe images
3. MiniMaxVideoGenerate → Generate video from keyframes
4. MiniMaxSpeechSynthesize → Generate narration voiceover
5. Return URLs for all generated assets
```

### Schema Export

MiniMax tool schemas can be exported in Anthropic-compatible format for external integration:

```typescript
import { exportMiniMaxToolSchemasJSON } from './src/tools/MiniMaxTools/schemaExport.js'
console.log(exportMiniMaxToolSchemasJSON())
```

---

## License

This project follows the open-source license of the upstream Claude Code CLI. See the [Claude Code CLI](https://github.com/anthropics/claude-code) original repository for details.

---

## Links

- [Claude Code CLI (upstream project)](https://github.com/anthropics/claude-code)
- [Anthropic](https://www.anthropic.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
