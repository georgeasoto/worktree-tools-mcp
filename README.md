# Worktree Tools MCP Server

MCP server for automated git worktree management with Claude. Enables Claude to create, manage, and clean up git worktrees automatically.

## Features

- **Automatic username detection** - From GitHub CLI or git config
- **Full worktree management** - Create, list, cleanup worktrees
- **Dependency installation** - Auto-detects and runs pnpm/npm/yarn
- **.env file copying** - Automatically copies environment files
- **GitHub integration** - Create PRs directly from worktrees
- **Status checking** - Check if worktrees are clean and ready for PR

## Installation

### Option 1: npm (Global)

```bash
npm install -g worktree-tools-mcp
```

### Option 2: Install from GitHub

```bash
npm install -g git+https://github.com/georgeasoto/worktree-tools-mcp.git
```

### Option 3: npx (No Installation)

Use directly with npx:
```bash
npx -y git+https://github.com/georgeasoto/worktree-tools-mcp.git
```

### Option 4: Local Development

```bash
git clone https://github.com/georgeasoto/worktree-tools-mcp.git
cd worktree-tools-mcp
npm install
npm run build
npm link
```

## Configuration for Claude Code

Add to your Claude Code configuration file (typically `~/.config/Claude/claude_desktop_config.json` or similar):

### Option 1: Using npx (Recommended - Always up to date)

```json
{
  "mcpServers": {
    "worktree-tools": {
      "command": "npx",
      "args": ["-y", "git+https://github.com/georgeasoto/worktree-tools-mcp.git"]
    }
  }
}
```

### Option 2: If installed globally

```json
{
  "mcpServers": {
    "worktree-tools": {
      "command": "worktree-tools-mcp"
    }
  }
}
```

### Option 3: Local development

```json
{
  "mcpServers": {
    "worktree-tools": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/worktree-tools-mcp/dist/index.js"]
    }
  }
}
```

After adding the configuration, restart Claude Code to enable the MCP server.

## Available Tools

### `create_worktree`

Create a new git worktree with automatic setup.

**Parameters:**
- `ticket` (required): Ticket number (e.g., "CO-4493", "PROJ-123")
- `branchName` (required): Branch name (spaces converted to hyphens)
- `cwd` (optional): Working directory (defaults to current)
- `openIde` (optional): Open in IDE after creation ("cursor", "vscode", "auto")

**Example:**
```typescript
{
  "ticket": "CO-4493",
  "branchName": "billing feature"
}
```

**What it does:**
1. Auto-detects username from GitHub CLI or git config
2. Creates worktree at `../<repo-name>-worktrees/username/TICKET/branch-name`
3. Creates branch: `username/TICKET/branch-name`
4. Fetches latest changes from origin/master
5. Auto-detects and installs dependencies (pnpm/npm/yarn)
6. Copies all .env files from main repo

### `list_worktrees`

List all worktrees with status information.

**Parameters:**
- `cwd` (optional): Working directory

**Returns:**
- Array of worktrees with branch, path, and status
- Status includes: clean/dirty, commits ahead/behind

### `cleanup_worktree`

Remove a worktree and optionally delete its branch.

**Parameters:**
- `worktreePath` (required): Path to worktree to remove
- `deleteBranch` (optional): Also delete the local branch (default: false)
- `cwd` (optional): Working directory

**What it does:**
1. Removes the worktree directory
2. Optionally deletes the local branch
3. Cleans up empty parent directories

### `worktree_status`

Get the status of a worktree.

**Parameters:**
- `worktreePath` (required): Path to worktree to check

**Returns:**
- Clean/dirty status
- Commits ahead/behind master
- Ready for PR status
- Human-readable message

### `create_pr`

Create a GitHub pull request from a worktree.

**Parameters:**
- `worktreePath` (required): Path to worktree
- `title` (optional): PR title (auto-generated from commits if not provided)
- `body` (optional): PR body (auto-generated if not provided)
- `draft` (optional): Create as draft PR (default: false)

**Requirements:**
- GitHub CLI must be authenticated (`gh auth login`)
- Or set `GITHUB_TOKEN` environment variable

**Returns:**
- PR URL
- PR number
- PR title

## Usage Examples with Claude

Once configured, Claude can automatically manage worktrees:

**Example 1: Create a new worktree**
```
User: "Create a worktree for ticket CO-1234 called payment integration"
Claude: [calls create_worktree tool]
Claude: "I've created a new worktree at ~/repos/myproject-worktrees/username/CO-1234/payment-integration
        with dependencies installed and .env files copied. The worktree is ready to use."
```

**Example 2: List all worktrees**
```
User: "Show me all my active worktrees"
Claude: [calls list_worktrees tool]
Claude: "You have 3 active worktrees:
        1. CO-1234/payment-integration - 5 commits ahead, clean
        2. CO-5678/user-dashboard - 2 commits ahead, uncommitted changes
        3. CO-9012/api-refactor - up to date"
```

**Example 3: Create PR from worktree**
```
User: "Create a PR for my payment integration work"
Claude: [calls create_pr tool]
Claude: "I've created PR #123: 'Add payment integration'
        URL: https://github.com/org/repo/pull/123"
```

**Example 4: Clean up worktree**
```
User: "Clean up the payment integration worktree"
Claude: [calls cleanup_worktree tool with deleteBranch: true]
Claude: "I've removed the worktree and deleted the local branch."
```

## Username Detection

Usernames are automatically detected with this priority:

1. **Manual override** - From `.worktree-config` file in repo root
2. **GitHub CLI** - Uses `gh api user --jq .login`
3. **Git config** - Converts `user.name` to username format (lowercase, hyphens)

If detection fails, you'll get a clear error message with instructions.

## Directory Structure

Worktrees are organized as:
```
~/repos/
├── myproject/                        (main repository)
└── myproject-worktrees/              (all worktrees)
    └── username/
        ├── CO-1234/
        │   └── payment-integration/
        └── CO-5678/
            └── user-dashboard/
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Test the MCP server
npm run build && node dist/index.js
```

## Companion Bash Scripts

This MCP server complements the worktree-tools bash scripts (located at `~/.checkout-scripts/` or `~/.worktree-tools/`). You can use both:

- **Bash scripts** - For manual CLI usage
- **MCP server** - For Claude automation

Both implement the same logic and can be used interchangeably. The bash scripts provide a zero-dependency CLI interface, while the MCP server enables Claude to automate worktree operations.

## Requirements

- Node.js 18+
- Git
- Optional: GitHub CLI (`gh`) for better username detection and PR creation
- Optional: `pnpm`, `npm`, or `yarn` for dependency installation

## License

MIT
