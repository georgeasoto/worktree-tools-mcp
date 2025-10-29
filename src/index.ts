#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { createWorktreeTool, CreateWorktreeArgs } from './tools/create-worktree.js';
import { listWorktreesTool, ListWorktreesArgs } from './tools/list-worktrees.js';
import { cleanupWorktreeTool, CleanupWorktreeArgs } from './tools/cleanup-worktree.js';
import { worktreeStatusTool, WorktreeStatusArgs } from './tools/worktree-status.js';
import { createPRTool, CreatePRArgs } from './tools/create-pr.js';

const server = new Server(
  {
    name: 'worktree-tools-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_worktree',
        description:
          'Create a new git worktree with automatic setup. ' +
          'Auto-detects username from GitHub/git, installs dependencies, and copies .env files. ' +
          'Worktrees are created at ../<repo-name>-worktrees/username/TICKET/branch-name',
        inputSchema: {
          type: 'object',
          properties: {
            ticket: {
              type: 'string',
              description: 'Ticket number (e.g., CO-4493, PROJ-123)',
            },
            branchName: {
              type: 'string',
              description: 'Branch name (spaces will be converted to hyphens, e.g., "billing feature" -> "billing-feature")',
            },
            cwd: {
              type: 'string',
              description: 'Optional: Working directory (defaults to current directory)',
            },
            openIde: {
              type: 'string',
              enum: ['cursor', 'vscode', 'auto'],
              description: 'Optional: Open worktree in IDE after creation',
            },
          },
          required: ['ticket', 'branchName'],
        },
      },
      {
        name: 'list_worktrees',
        description:
          'List all git worktrees with their status information. ' +
          'Shows branch name, path, uncommitted changes, and commits ahead/behind master.',
        inputSchema: {
          type: 'object',
          properties: {
            cwd: {
              type: 'string',
              description: 'Optional: Working directory (defaults to current directory)',
            },
          },
        },
      },
      {
        name: 'cleanup_worktree',
        description:
          'Remove a git worktree and optionally delete its branch. ' +
          'Automatically cleans up empty parent directories.',
        inputSchema: {
          type: 'object',
          properties: {
            worktreePath: {
              type: 'string',
              description: 'Path to the worktree to remove',
            },
            deleteBranch: {
              type: 'boolean',
              description: 'Optional: Also delete the local branch (default: false)',
            },
            cwd: {
              type: 'string',
              description: 'Optional: Working directory (defaults to current directory)',
            },
          },
          required: ['worktreePath'],
        },
      },
      {
        name: 'worktree_status',
        description:
          'Get the status of a worktree. ' +
          'Shows if working directory is clean, commits ahead/behind master, and if ready for PR.',
        inputSchema: {
          type: 'object',
          properties: {
            worktreePath: {
              type: 'string',
              description: 'Path to the worktree to check',
            },
          },
          required: ['worktreePath'],
        },
      },
      {
        name: 'create_pr',
        description:
          'Create a GitHub pull request from the current worktree. ' +
          'Auto-generates title and body from commits if not provided. ' +
          'Requires GitHub authentication (GITHUB_TOKEN env var or gh CLI).',
        inputSchema: {
          type: 'object',
          properties: {
            worktreePath: {
              type: 'string',
              description: 'Path to the worktree',
            },
            title: {
              type: 'string',
              description: 'Optional: PR title (auto-generated from commits if not provided)',
            },
            body: {
              type: 'string',
              description: 'Optional: PR body (auto-generated from commits if not provided)',
            },
            draft: {
              type: 'boolean',
              description: 'Optional: Create as draft PR (default: false)',
            },
          },
          required: ['worktreePath'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'create_worktree': {
        const result = await createWorktreeTool(args as unknown as CreateWorktreeArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_worktrees': {
        const result = await listWorktreesTool((args || {}) as unknown as ListWorktreesArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'cleanup_worktree': {
        const result = await cleanupWorktreeTool(args as unknown as CleanupWorktreeArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'worktree_status': {
        const result = await worktreeStatusTool(args as unknown as WorktreeStatusArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_pr': {
        const result = await createPRTool(args as unknown as CreatePRArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Worktree Tools MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
