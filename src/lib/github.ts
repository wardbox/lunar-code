import { Octokit } from 'octokit';
import { getLunarPhase } from './lunar';
import Bottleneck from 'bottleneck';

// Create a limiter that respects GitHub's rate limits
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 1000, // Minimum 1 second between requests
  reservoir: 5000, // GitHub's default rate limit
  reservoirRefreshAmount: 5000,
  reservoirRefreshInterval: 60 * 60 * 1000, // 1 hour
});

interface GitHubResponse {
  headers: {
    'x-ratelimit-remaining': string;
    'x-ratelimit-reset': string;
  };
  data: any;
}

// Update rate limits based on GitHub's response headers
function updateRateLimits(response: GitHubResponse) {
  const remaining = parseInt(response.headers['x-ratelimit-remaining'] || '0', 10);
  const reset = parseInt(response.headers['x-ratelimit-reset'] || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  const resetInMs = (reset - now) * 1000;

  if (remaining > 0) {
    // Spread remaining requests over time until reset
    const minTime = Math.max(1000, Math.floor(resetInMs / remaining));
    limiter.updateSettings({ 
      minTime,
      reservoir: remaining 
    });
  } else if (resetInMs > 0) {
    // If no requests remaining, pause until reset
    limiter.updateSettings({ 
      reservoir: 0,
      reservoirRefreshAmount: 5000,
      reservoirRefreshInterval: resetInMs
    });
  }
}

interface CommitStats {
  commitsByPhase: Record<string, number>;
  averageCommitSize: Record<string, number>;
  timeOfDay: {
    dawn: number;
    day: number;
    dusk: number;
    night: number;
  };
  largestCommit: {
    phase: string;
    size: number;
    message: string;
    date: string;
  };
  totalAdditions: number;
  totalDeletions: number;
}

interface GitHubCommitResponse {
  commit: {
    author: {
      name: string | null;
      email: string | null;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
  } | null;
  sha: string;
  html_url: string;
}

interface DetailedCommitResponse {
  commit: {
    author: {
      name: string | null;
      email: string | null;
      date: string;
    };
    message: string;
  };
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

interface GitHubEmail {
  email: string;
  verified: boolean;
  primary: boolean;
  visibility: string | null;
}

interface GitHubRepo {
  owner: {
    login: string;
  };
  name: string;
  fork: boolean;
}

// List of GitHub system emails and usernames to filter out
const GITHUB_SYSTEM_AUTHORS = [
  'noreply@github.com',
  'actions@github.com',
  'github-actions[bot]',
  'web-flow',
  'dependabot[bot]',
];

export async function fetchUserCommits(
  accessToken: string,
  username: string,
): Promise<CommitStats> {
  const octokit = new Octokit({ auth: accessToken });
  const stats: CommitStats = {
    commitsByPhase: {},
    averageCommitSize: {},
    timeOfDay: {
      dawn: 0,    // 4-8
      day: 0,     // 8-16
      dusk: 0,    // 16-20
      night: 0,   // 20-4
    },
    largestCommit: {
      phase: '',
      size: 0,
      message: '',
      date: '',
    },
    totalAdditions: 0,
    totalDeletions: 0,
  };

  try {
    // First get user's verified emails
    console.log('Fetching user emails...');
    const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
    const userEmails = emails
      .filter(email => email.verified)
      .map(email => email.email);
    
    console.log('Fetching repositories...');
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      affiliation: 'owner,collaborator,organization_member',
      sort: 'updated',
      visibility: 'all',
      per_page: 100,
    });

    const nonForkRepos = repos.filter(repo => !repo.fork);
    console.log(`Found ${nonForkRepos.length} repositories to analyze...`);

    let processedRepos = 0;
    let totalCommits = 0;

    // For each repository, get commits
    for (const repo of nonForkRepos) {
      try {
        processedRepos++;
        console.log(`Processing repository ${processedRepos}/${nonForkRepos.length}...`);

        // Get commits from default branch by username
        const commits = await octokit.paginate(
          octokit.rest.repos.listCommits,
          {
            owner: repo.owner.login,
            repo: repo.name,
            author: username,
            per_page: 100,
          }
        ) as GitHubCommitResponse[];

        // Filter out GitHub-generated commits
        const userCommits = commits.filter(commit => {
          const authorEmail = commit.commit.author?.email;
          const authorLogin = commit.author?.login;
          
          // Skip if it's a system author
          if (authorEmail && GITHUB_SYSTEM_AUTHORS.includes(authorEmail)) return false;
          if (authorLogin && GITHUB_SYSTEM_AUTHORS.includes(authorLogin)) return false;
          
          // Keep if it matches username or verified emails
          return (
            authorLogin === username ||
            (authorEmail && userEmails.includes(authorEmail))
          );
        });

        if (userCommits.length > 0) {
          console.log(`Found ${userCommits.length} user commits in repository...`);
        }

        // Process each commit
        for (const commit of userCommits) {
          try {
            // Get detailed commit info including stats
            const { data: detailedCommit } = await octokit.rest.repos.getCommit({
              owner: repo.owner.login,
              repo: repo.name,
              ref: commit.sha,
            }) as { data: DetailedCommitResponse };

            const date = new Date(commit.commit.author?.date || '');
            const phase = getLunarPhase(date);
            const hour = date.getHours();
            
            // Count commits by phase
            stats.commitsByPhase[phase] = (stats.commitsByPhase[phase] || 0) + 1;
            
            // Track commit sizes
            if (detailedCommit.stats) {
              const size = detailedCommit.stats.total;
              stats.averageCommitSize[phase] = stats.averageCommitSize[phase] || 0;
              stats.averageCommitSize[phase] += size;
              
              stats.totalAdditions += detailedCommit.stats.additions;
              stats.totalDeletions += detailedCommit.stats.deletions;

              // Track largest commit
              if (size > stats.largestCommit.size) {
                stats.largestCommit = {
                  phase,
                  size,
                  message: commit.commit.message,
                  date: commit.commit.author?.date || '',
                };
              }
            }
            
            // Track time of day
            if (hour >= 4 && hour < 8) stats.timeOfDay.dawn++;
            else if (hour >= 8 && hour < 16) stats.timeOfDay.day++;
            else if (hour >= 16 && hour < 20) stats.timeOfDay.dusk++;
            else stats.timeOfDay.night++;

            totalCommits++;
          } catch (error) {
            console.warn('Failed to get detailed commit info:', error);
          }
        }
      } catch (error: any) {
        // Handle specific error cases
        if (error.status === 404) {
          // Repository not found or no access - skip silently
          continue;
        } else if (error.status === 403) {
          // Rate limit exceeded - wait for reset
          const resetIn = parseInt(error.response?.headers?.['x-ratelimit-reset'] || '0', 10) * 1000 - Date.now();
          if (resetIn > 0) {
            console.log(`Rate limit exceeded. Waiting ${Math.ceil(resetIn / 1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, resetIn));
            continue;
          }
        } else if (error.status === 409) {
          // Repository is empty
          continue;
        } else {
          // Log unexpected errors without exposing repository details
          console.error(`Unexpected error processing repository: ${error.message}`);
          continue;
        }
      }
    }

    // Calculate averages
    Object.keys(stats.averageCommitSize).forEach(phase => {
      stats.averageCommitSize[phase] = Math.round(
        stats.averageCommitSize[phase] / (stats.commitsByPhase[phase] || 1)
      );
    });

    console.log(`Analysis complete! Processed ${totalCommits} commits across ${processedRepos} repositories.`);
    return stats;
  } catch (error: any) {
    if (error.status === 403) {
      throw new Error(formatRateLimitError(error));
    } else {
      console.error('Error fetching repository data:', error.message);
      throw error;
    }
  }
}

export async function fetchUserProfile(accessToken: string) {
  const octokit = new Octokit({ auth: accessToken });

  // Wrap the profile request with rate limiting
  return limiter.schedule(async () => {
    try {
      const response = await octokit.rest.users.getAuthenticated();
      updateRateLimits(response as GitHubResponse);
      return response.data;
    } catch (error: any) {
      if (error.status === 403) {
        const resetTimestamp = parseInt(error.response?.headers?.['x-ratelimit-reset'] || '0', 10);
        const resetDate = new Date(resetTimestamp * 1000);
        const resetIn = resetTimestamp * 1000 - Date.now();
        const minutes = Math.ceil(resetIn / (60 * 1000));
        
        throw new Error(
          `Rate limit exceeded. You can try again ${
            resetIn > 0 
              ? `in ${minutes} minute${minutes === 1 ? '' : 's'} (at ${resetDate.toLocaleTimeString()})`
              : 'now'
          }`
        );
      }
      console.error('Error fetching user profile:', error);
      throw error;
    }
  });
}

// Helper function to format rate limit errors
export function formatRateLimitError(error: any): string {
  if (error.status === 403) {
    const resetTimestamp = parseInt(error.response?.headers?.['x-ratelimit-reset'] || '0', 10);
    const resetDate = new Date(resetTimestamp * 1000);
    const resetIn = resetTimestamp * 1000 - Date.now();
    const minutes = Math.ceil(resetIn / (60 * 1000));
    
    return resetIn > 0
      ? `Rate limit exceeded. You can try again in ${minutes} minute${
          minutes === 1 ? '' : 's'
        } (at ${resetDate.toLocaleTimeString()})`
      : 'Rate limit exceeded. You can try again now';
  }
  return error.message || 'An unknown error occurred';
} 
