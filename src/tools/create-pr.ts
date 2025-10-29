import { createPullRequest, generatePRContent, PullRequestResult } from '../utils/github.js';

export interface CreatePRArgs {
  worktreePath: string;
  title?: string;
  body?: string;
  draft?: boolean;
}

export interface CreatePRResult extends PullRequestResult {
  worktreePath: string;
}

/**
 * Create a GitHub pull request from the current worktree
 */
export async function createPRTool(args: CreatePRArgs): Promise<CreatePRResult> {
  const { worktreePath, title, body, draft = false } = args;

  let prTitle = title;
  let prBody = body;

  // If title/body not provided, generate from commits
  if (!prTitle || !prBody) {
    const generated = await generatePRContent(worktreePath);
    prTitle = prTitle || generated.title;
    prBody = prBody || generated.body;
  }

  // Create the PR
  const result = await createPullRequest(worktreePath, prTitle, prBody, draft);

  return {
    ...result,
    worktreePath
  };
}
