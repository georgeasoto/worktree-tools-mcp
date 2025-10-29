import fs from 'fs/promises';
import path from 'path';
import { getMainRepoRoot, removeWorktree, deleteBranch } from '../utils/git.js';

export interface CleanupWorktreeArgs {
  worktreePath: string;
  deleteBranch?: boolean;
  cwd?: string;
}

export interface CleanupWorktreeResult {
  removed: boolean;
  worktreePath: string;
  branchName?: string;
  branchDeleted: boolean;
  directoriesRemoved: string[];
}

/**
 * Remove a worktree and optionally delete its branch
 */
export async function cleanupWorktreeTool(args: CleanupWorktreeArgs): Promise<CleanupWorktreeResult> {
  const { worktreePath, deleteBranch: shouldDeleteBranch = false, cwd } = args;

  // Get main repository root
  const mainRepoPath = await getMainRepoRoot(cwd);

  // Get branch name before removing worktree
  let branchName: string | undefined;
  try {
    const { simpleGit } = await import('simple-git');
    const git = simpleGit(worktreePath);
    branchName = await git.revparse(['--abbrev-ref', 'HEAD']);
  } catch (error) {
    // Couldn't get branch name, might be already deleted
  }

  // Remove the worktree
  await removeWorktree(mainRepoPath, worktreePath);

  // Delete branch if requested
  let branchDeleted = false;
  if (shouldDeleteBranch && branchName) {
    try {
      await deleteBranch(mainRepoPath, branchName);
      branchDeleted = true;
    } catch (error) {
      // Branch might not exist or already deleted
      console.error(`Failed to delete branch ${branchName}:`, error);
    }
  }

  // Clean up empty parent directories
  const directoriesRemoved: string[] = [];
  let currentDir = path.dirname(worktreePath);

  // Walk up the directory tree and remove empty directories
  // Stop at the worktrees base directory or home directory
  while (
    currentDir !== '/' &&
    currentDir !== process.env.HOME &&
    currentDir.includes('-worktrees')
  ) {
    try {
      const entries = await fs.readdir(currentDir);
      if (entries.length === 0) {
        await fs.rmdir(currentDir);
        directoriesRemoved.push(currentDir);
        currentDir = path.dirname(currentDir);
      } else {
        // Directory not empty, stop walking up
        break;
      }
    } catch (error) {
      // Directory doesn't exist or can't be removed, stop walking up
      break;
    }
  }

  return {
    removed: true,
    worktreePath,
    branchName,
    branchDeleted,
    directoriesRemoved
  };
}
