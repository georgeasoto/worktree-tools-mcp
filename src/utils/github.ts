import { Octokit } from '@octokit/rest';
import { simpleGit } from 'simple-git';

export interface PullRequestResult {
  url: string;
  number: number;
  title: string;
}

/**
 * Extract owner and repo from git remote URL
 */
async function getGitHubRepoInfo(repoPath: string): Promise<{ owner: string; repo: string }> {
  const git = simpleGit(repoPath);
  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin');

  if (!origin || !origin.refs.fetch) {
    throw new Error('No origin remote found');
  }

  // Match GitHub URLs (both HTTPS and SSH)
  // Examples:
  // git@github.com:owner/repo.git
  // https://github.com/owner/repo.git
  const match = origin.refs.fetch.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/);

  if (!match) {
    throw new Error('Origin remote is not a GitHub repository');
  }

  return {
    owner: match[1],
    repo: match[2]
  };
}

/**
 * Get GitHub token from environment or gh CLI
 */
async function getGitHubToken(): Promise<string> {
  // Try environment variable first
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // Try gh CLI
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync('gh auth token', { timeout: 5000 });
    const token = stdout.trim();
    if (token) {
      return token;
    }
  } catch (error) {
    // gh CLI not available or not authenticated
  }

  throw new Error(
    'GitHub authentication required. ' +
    'Either set GITHUB_TOKEN environment variable or run: gh auth login'
  );
}

/**
 * Create a pull request
 */
export async function createPullRequest(
  repoPath: string,
  title: string,
  body?: string,
  draft: boolean = false
): Promise<PullRequestResult> {
  const git = simpleGit(repoPath);

  // Get current branch
  const branch = await git.revparse(['--abbrev-ref', 'HEAD']);

  if (branch === 'master' || branch === 'main') {
    throw new Error('Cannot create PR from master/main branch');
  }

  // Get base branch (usually master or main)
  const branches = await git.branch();
  const baseBranch = branches.all.includes('master') ? 'master' : 'main';

  // Get GitHub token and repo info
  const token = await getGitHubToken();
  const { owner, repo } = await getGitHubRepoInfo(repoPath);

  // Create Octokit instance
  const octokit = new Octokit({ auth: token });

  // Create PR
  const response = await octokit.pulls.create({
    owner,
    repo,
    title,
    body: body || '',
    head: branch,
    base: baseBranch,
    draft
  });

  return {
    url: response.data.html_url,
    number: response.data.number,
    title: response.data.title
  };
}

/**
 * Get commit messages since branching from base
 */
export async function getCommitsSinceBase(repoPath: string, baseBranch: string = 'master'): Promise<string[]> {
  const git = simpleGit(repoPath);

  // Get current branch
  const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);

  // Get commits between base and current branch
  const log = await git.log({
    from: `origin/${baseBranch}`,
    to: currentBranch
  });

  return log.all.map(commit => commit.message);
}

/**
 * Generate PR title and body from commits
 */
export async function generatePRContent(repoPath: string): Promise<{ title: string; body: string }> {
  const commits = await getCommitsSinceBase(repoPath);

  if (commits.length === 0) {
    throw new Error('No commits found for PR');
  }

  // Use first commit as title
  const title = commits[0].split('\n')[0]; // First line only

  // Generate body with all commit messages
  const body = commits.length > 1
    ? `## Commits\n\n${commits.map(msg => `- ${msg.split('\n')[0]}`).join('\n')}`
    : '';

  return { title, body };
}
