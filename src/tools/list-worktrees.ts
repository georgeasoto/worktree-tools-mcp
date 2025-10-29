import { getMainRepoRoot, listWorktrees, getWorktreeStatus, WorktreeInfo } from '../utils/git.js';

export interface ListWorktreesArgs {
  cwd?: string;
}

export interface WorktreeListItem extends WorktreeInfo {
  status?: {
    clean: boolean;
    ahead: number;
    behind: number;
    uncommitted: boolean;
  };
}

export interface ListWorktreesResult {
  worktrees: WorktreeListItem[];
  mainRepoPath: string;
}

/**
 * List all git worktrees with their status
 */
export async function listWorktreesTool(args: ListWorktreesArgs): Promise<ListWorktreesResult> {
  const { cwd } = args;

  // Get main repository root
  const mainRepoPath = await getMainRepoRoot(cwd);

  // List all worktrees
  const worktrees = await listWorktrees(mainRepoPath);

  // Get status for each worktree (except main repo)
  const worktreesWithStatus: WorktreeListItem[] = await Promise.all(
    worktrees.map(async (worktree) => {
      if (worktree.isMain) {
        return worktree;
      }

      try {
        const status = await getWorktreeStatus(worktree.path);
        return {
          ...worktree,
          status
        };
      } catch (error) {
        // If we can't get status, return without it
        return worktree;
      }
    })
  );

  // Filter out the main repo from the list
  const filteredWorktrees = worktreesWithStatus.filter(w => !w.isMain);

  return {
    worktrees: filteredWorktrees,
    mainRepoPath
  };
}
