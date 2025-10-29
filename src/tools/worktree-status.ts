import { getWorktreeStatus, WorktreeStatus } from '../utils/git.js';

export interface WorktreeStatusArgs {
  worktreePath: string;
}

export interface WorktreeStatusResult extends WorktreeStatus {
  worktreePath: string;
  readyForPR: boolean;
  message: string;
}

/**
 * Get the status of a worktree
 */
export async function worktreeStatusTool(args: WorktreeStatusArgs): Promise<WorktreeStatusResult> {
  const { worktreePath } = args;

  const status = await getWorktreeStatus(worktreePath);

  // Determine if ready for PR
  const readyForPR = status.clean && status.ahead > 0;

  // Generate human-readable message
  let message = '';
  if (!status.clean) {
    message = '⚠️  Working directory has uncommitted changes';
  } else if (status.ahead === 0) {
    message = 'ℹ️  No commits to push';
  } else if (status.behind > 0) {
    message = `⚠️  Branch is ${status.behind} commit(s) behind master`;
  } else {
    message = `✅ Clean and ${status.ahead} commit(s) ahead - ready for PR`;
  }

  return {
    ...status,
    worktreePath,
    readyForPR,
    message
  };
}
