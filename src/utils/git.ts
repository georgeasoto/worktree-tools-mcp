import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isMain: boolean;
}

export interface WorktreeStatus {
  clean: boolean;
  ahead: number;
  behind: number;
  uncommitted: boolean;
}

/**
 * Get the main repository root (not a worktree)
 */
export async function getMainRepoRoot(cwd?: string): Promise<string> {
  const git = simpleGit(cwd);

  // Get all worktrees
  const worktrees = await git.raw(['worktree', 'list', '--porcelain']);
  const lines = worktrees.split('\n');

  // First worktree is always the main repo
  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      return line.substring('worktree '.length);
    }
  }

  throw new Error('Not inside a git repository');
}

/**
 * Get repository name from remote URL or directory name
 */
export async function getRepoName(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);

  try {
    const remotes = await git.getRemotes(true);
    const originRemote = remotes.find(r => r.name === 'origin');

    if (originRemote && originRemote.refs.fetch) {
      // Extract repo name from URL (works for both HTTPS and SSH)
      const match = originRemote.refs.fetch.match(/\/([^/]+?)(\.git)?$/);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
  } catch (error) {
    // No remote or error fetching
  }

  // Fallback to directory name
  return path.basename(repoPath).toLowerCase();
}

/**
 * List all worktrees
 */
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const git = simpleGit(repoPath);
  const worktrees = await git.raw(['worktree', 'list', '--porcelain']);

  const result: WorktreeInfo[] = [];
  const lines = worktrees.split('\n');

  let currentWorktree: Partial<WorktreeInfo> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (currentWorktree.path) {
        result.push(currentWorktree as WorktreeInfo);
      }
      currentWorktree = {
        path: line.substring('worktree '.length),
        isMain: false
      };
    } else if (line.startsWith('HEAD ')) {
      currentWorktree.head = line.substring('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring('branch refs/heads/'.length);
    } else if (line === '') {
      if (currentWorktree.path) {
        result.push(currentWorktree as WorktreeInfo);
        currentWorktree = {};
      }
    }
  }

  // Mark the main repo
  if (result.length > 0) {
    result[0].isMain = true;
  }

  return result;
}

/**
 * Auto-detect the default branch (main or master)
 */
export async function getDefaultBranch(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);

  try {
    // Check if origin/main exists
    await git.raw(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main']);
    return 'origin/main';
  } catch {
    // Try origin/master
    try {
      await git.raw(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/master']);
      return 'origin/master';
    } catch {
      throw new Error('Could not find origin/main or origin/master branch');
    }
  }
}

/**
 * Create a new worktree
 */
export async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string,
  baseBranch?: string
): Promise<void> {
  const git = simpleGit(repoPath);

  // Fetch latest changes
  await git.fetch('origin');

  // Auto-detect default branch if not provided
  const branch = baseBranch || await getDefaultBranch(repoPath);

  // Create worktree
  await git.raw([
    'worktree',
    'add',
    worktreePath,
    '-b',
    branchName,
    branch
  ]);
}

/**
 * Remove a worktree
 */
export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.raw(['worktree', 'remove', worktreePath, '--force']);
}

/**
 * Get worktree status
 */
export async function getWorktreeStatus(worktreePath: string): Promise<WorktreeStatus> {
  const git = simpleGit(worktreePath);

  // Check if clean
  const status = await git.status();
  const clean = status.files.length === 0;

  // Get ahead/behind info
  let ahead = 0;
  let behind = 0;

  try {
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    const tracking = await git.revparse(['--abbrev-ref', `${branch}@{upstream}`]);

    const aheadBehind = await git.raw([
      'rev-list',
      '--left-right',
      '--count',
      `${tracking}...${branch}`
    ]);

    const parts = aheadBehind.trim().split('\t');
    if (parts.length === 2) {
      behind = parseInt(parts[0], 10) || 0;
      ahead = parseInt(parts[1], 10) || 0;
    }
  } catch (error) {
    // No tracking branch or error
  }

  return {
    clean,
    ahead,
    behind,
    uncommitted: !clean
  };
}

/**
 * Delete a branch
 */
export async function deleteBranch(repoPath: string, branchName: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.deleteLocalBranch(branchName, true);
}

/**
 * Detect package manager from lock files
 */
export async function detectPackageManager(worktreePath: string): Promise<string | null> {
  try {
    await fs.access(path.join(worktreePath, 'pnpm-lock.yaml'));
    return 'pnpm';
  } catch {}

  try {
    await fs.access(path.join(worktreePath, 'package-lock.json'));
    return 'npm';
  } catch {}

  try {
    await fs.access(path.join(worktreePath, 'yarn.lock'));
    return 'yarn';
  } catch {}

  return null;
}

/**
 * Install dependencies using detected package manager
 */
export async function installDependencies(worktreePath: string): Promise<{ success: boolean; packageManager: string | null }> {
  const packageManager = await detectPackageManager(worktreePath);

  if (!packageManager) {
    return { success: false, packageManager: null };
  }

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    await execAsync(`${packageManager} install`, {
      cwd: worktreePath,
      timeout: 300000 // 5 minutes
    });
    return { success: true, packageManager };
  } catch (error) {
    throw new Error(`Failed to install dependencies with ${packageManager}: ${error}`);
  }
}

/**
 * Find and copy .env files from main repo to worktree
 */
export async function copyEnvFiles(mainRepoPath: string, worktreePath: string): Promise<number> {
  const { glob } = await import('glob');

  // Find all .env* files in main repo (up to 3 levels deep)
  const envFiles = await glob('.env*', {
    cwd: mainRepoPath,
    dot: true,
    maxDepth: 3,
    nodir: true
  });

  let copiedCount = 0;

  for (const envFile of envFiles) {
    const sourcePath = path.join(mainRepoPath, envFile);
    const targetPath = path.join(worktreePath, envFile);

    // Create target directory if needed
    const targetDir = path.dirname(targetPath);
    await fs.mkdir(targetDir, { recursive: true });

    // Copy file
    await fs.copyFile(sourcePath, targetPath);
    copiedCount++;
  }

  return copiedCount;
}
