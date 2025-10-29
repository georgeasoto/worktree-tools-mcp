import { exec } from 'child_process';
import { promisify } from 'util';
import { simpleGit } from 'simple-git';

const execAsync = promisify(exec);

export interface UsernameResult {
  username: string;
  source: 'manual_config' | 'github_cli' | 'git_config';
}

/**
 * Auto-detect username with priority order:
 * 1. Manual override from config file (if set via set-username)
 * 2. GitHub username from GitHub CLI (if available)
 * 3. Git user.name converted to username format
 */
export async function detectUsername(configPath?: string): Promise<UsernameResult> {
  // 1. Check for manual override from config file
  if (configPath) {
    try {
      const fs = await import('fs/promises');
      const config = await fs.readFile(configPath, 'utf-8');
      const match = config.match(/USERNAME=(.+)/);
      if (match && match[1]) {
        return {
          username: match[1].trim(),
          source: 'manual_config'
        };
      }
    } catch (error) {
      // Config file doesn't exist or can't be read, continue to auto-detection
    }
  }

  // 2. Try GitHub CLI (most accurate for GitHub workflows)
  try {
    const { stdout } = await execAsync('gh api user --jq .login', {
      timeout: 5000
    });
    const username = stdout.trim();
    if (username && username.length > 0) {
      return {
        username,
        source: 'github_cli'
      };
    }
  } catch (error) {
    // GitHub CLI not available or not authenticated, continue
  }

  // 3. Fallback to git config user.name
  try {
    const git = simpleGit();
    const gitName = await git.getConfig('user.name');
    if (gitName.value) {
      // Convert name to username format: lowercase, spaces to hyphens, remove special chars
      const username = gitName.value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      if (username.length > 0) {
        return {
          username,
          source: 'git_config'
        };
      }
    }
  } catch (error) {
    // Git config not available
  }

  throw new Error(
    'Unable to detect username automatically. ' +
    'Please configure git: git config --global user.name "Your Name" ' +
    'or install GitHub CLI: brew install gh && gh auth login'
  );
}

/**
 * Convert a display name to username format
 */
export function normalizeUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
