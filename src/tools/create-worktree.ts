import path from 'path';
import { detectUsername } from '../utils/username.js';
import { getMainRepoRoot, getRepoName, createWorktree, installDependencies, copyEnvFiles } from '../utils/git.js';

export interface CreateWorktreeArgs {
  ticket: string;
  branchName: string;
  cwd?: string;
  openIde?: 'cursor' | 'vscode' | 'auto';
}

export interface CreateWorktreeResult {
  worktreePath: string;
  branchFullName: string;
  username: string;
  usernameSource: string;
  repoName: string;
  dependenciesInstalled: boolean;
  packageManager: string | null;
  envFilesCopied: number;
}

/**
 * Create a new git worktree with automatic setup
 */
export async function createWorktreeTool(args: CreateWorktreeArgs): Promise<CreateWorktreeResult> {
  const { ticket, branchName, cwd, openIde } = args;

  // Validate inputs
  if (!ticket || !ticket.trim()) {
    throw new Error('Ticket number is required');
  }

  if (!branchName || !branchName.trim()) {
    throw new Error('Branch name is required');
  }

  // Get main repository root
  const mainRepoRoot = await getMainRepoRoot(cwd);

  // Detect username
  const usernameResult = await detectUsername(path.join(mainRepoRoot, '.worktree-config'));

  // Get repository name
  const repoName = await getRepoName(mainRepoRoot);

  // Normalize branch name (lowercase, spaces to hyphens)
  const normalizedBranchName = branchName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  // Construct full branch name: username/TICKET/branch-name
  const fullBranchName = `${usernameResult.username}/${ticket}/${normalizedBranchName}`;

  // Construct worktree path
  const worktreesDir = path.join(mainRepoRoot, '..', `${repoName}-worktrees`);
  const worktreePath = path.join(
    worktreesDir,
    usernameResult.username,
    ticket,
    normalizedBranchName
  );

  // Create the worktree
  await createWorktree(mainRepoRoot, worktreePath, fullBranchName, 'origin/master');

  // Install dependencies
  let dependenciesInstalled = false;
  let packageManager: string | null = null;

  try {
    const result = await installDependencies(worktreePath);
    dependenciesInstalled = result.success;
    packageManager = result.packageManager;
  } catch (error) {
    // Dependencies installation failed, but worktree was created
    console.error('Failed to install dependencies:', error);
  }

  // Copy .env files
  let envFilesCopied = 0;
  try {
    envFilesCopied = await copyEnvFiles(mainRepoRoot, worktreePath);
  } catch (error) {
    // .env copy failed, but worktree was created
    console.error('Failed to copy .env files:', error);
  }

  // TODO: Open in IDE if requested
  if (openIde) {
    // This would need to execute commands to open IDE
    // For now, we'll return the path and let Claude handle it
  }

  return {
    worktreePath,
    branchFullName: fullBranchName,
    username: usernameResult.username,
    usernameSource: usernameResult.source,
    repoName,
    dependenciesInstalled,
    packageManager,
    envFilesCopied
  };
}
