import { Octokit } from 'octokit';
import { getLunarPhase } from './lunar';
import Bottleneck from 'bottleneck';

// Create a limiter that respects GitHub's rate limits
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 250, // 250ms between requests (up to 4 requests per second)
  reservoir: 1000, // GitHub's core API has a much higher limit
  reservoirRefreshAmount: 1000,
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

const encoder = new TextEncoder();

// Helper function to send progress updates
function sendProgress(message: string, progress?: { 
  current: number; 
  total: number; 
  stats?: {
    commitsByPhase: Record<string, number>;
    timeOfDay: {
      dawn: number;
      day: number;
      dusk: number;
      night: number;
    };
    totalCommits: number;
  }
}) {
  const controller = (global as any).progressController;
  if (controller) {
    const data = {
      message,
      ...(progress && {
        progress: {
          current: progress.current,
          total: progress.total,
          percentage: Math.round((progress.current / progress.total) * 100),
          ...(progress.stats && { stats: progress.stats })
        }
      })
    };
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  }
}

async function fetchUserRepos(octokit: Octokit, username: string): Promise<GitHubRepo[]> {
  return limiter.schedule(() => 
    octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      affiliation: 'owner,collaborator,organization_member',
      sort: 'updated',
      visibility: 'all',
      per_page: 100,
    })
  ).then(repos => repos.filter(repo => !repo.fork));
}

export async function fetchUserCommits(
  accessToken: string,
  username: string,
): Promise<CommitStats> {
  console.log(`Starting commit analysis for GitHub user: ${username}`);
  sendProgress(`Starting commit analysis for ${username}...`);
  
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
    sendProgress('Fetching user emails...');
    const { data: emails } = await limiter.schedule(() => 
      octokit.rest.users.listEmailsForAuthenticatedUser()
    );
    const userEmails = emails
      .filter(email => email.verified)
      .map(email => email.email);
    console.log(`Found ${userEmails.length} verified email(s)`);
    sendProgress(`Found ${userEmails.length} verified email(s)`);
    
    console.log('Fetching repositories...');
    sendProgress('Fetching repositories...');
    const repos = await limiter.schedule(() => 
      octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
        affiliation: 'owner,collaborator,organization_member',
        sort: 'updated',
        visibility: 'all',
        per_page: 100,
      })
    );

    const nonForkRepos = repos.filter(repo => !repo.fork);
    console.log(`Found ${nonForkRepos.length} non-fork repositories to analyze...`);
    sendProgress(`Found ${nonForkRepos.length} repositories to analyze`);

    let processedRepos = 0;
    let totalCommits = 0;

    // For each repository, get commits
    for (const repo of nonForkRepos) {
      try {
        processedRepos++;
        console.log(`\nProcessing repository ${processedRepos}/${nonForkRepos.length}: ${repo.full_name}`);
        sendProgress(`Analyzing repositories`, {
          current: processedRepos,
          total: nonForkRepos.length,
          stats: {
            commitsByPhase: stats.commitsByPhase,
            timeOfDay: stats.timeOfDay,
            totalCommits
          }
        });

        // Get all commits from the repository
        console.log('  Fetching commits...');
        const commits = await limiter.schedule(() => 
          octokit.paginate('GET /repos/{owner}/{repo}/commits', {
            owner: repo.owner.login,
            repo: repo.name,
            author: username,
            per_page: 100,
            since: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // Last year only
          })
        );

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

        // Process basic commit info first (lunar phase, time of day)
        for (const commit of userCommits) {
          const date = new Date(commit.commit.author?.date || '');
          const phase = getLunarPhase(date);
          const hour = date.getHours();
          
          // Count commits by phase
          stats.commitsByPhase[phase] = (stats.commitsByPhase[phase] || 0) + 1;
          
          // Track time of day
          if (hour >= 4 && hour < 8) stats.timeOfDay.dawn++;
          else if (hour >= 8 && hour < 16) stats.timeOfDay.day++;
          else if (hour >= 16 && hour < 20) stats.timeOfDay.dusk++;
          else stats.timeOfDay.night++;

          totalCommits++;

          // Send stats update every 5 commits
          if (totalCommits % 5 === 0) {
            sendProgress(`Analyzing repositories`, {
              current: processedRepos,
              total: nonForkRepos.length,
              stats: {
                commitsByPhase: stats.commitsByPhase,
                timeOfDay: stats.timeOfDay,
                totalCommits
              }
            });
          }
        }

        // Process commits in smaller batches for detailed info
        const BATCH_SIZE = 5; // Smaller batch size to avoid timeouts
        for (let i = 0; i < userCommits.length; i += BATCH_SIZE) {
          const batch = userCommits.slice(i, i + BATCH_SIZE);

          // Process batch in parallel
          const batchPromises = batch.map(commit => 
            limiter.schedule(() => 
              octokit.rest.repos.getCommit({
                owner: repo.owner.login,
                repo: repo.name,
                ref: commit.sha,
              })
            )
          );

          try {
            const batchResults = await Promise.all(batchPromises);
            for (let j = 0; j < batchResults.length; j++) {
              const commit = batch[j];
              const { data: detailedCommit } = batchResults[j];
              
              if (detailedCommit.stats?.total) {
                const date = new Date(commit.commit.author?.date || '');
                const phase = getLunarPhase(date);
                const size = detailedCommit.stats.total;

                // Update sizes
                stats.averageCommitSize[phase] = stats.averageCommitSize[phase] || 0;
                stats.averageCommitSize[phase] += size;
                
                stats.totalAdditions += detailedCommit.stats.additions || 0;
                stats.totalDeletions += detailedCommit.stats.deletions || 0;

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
            }
          } catch (error) {
            console.warn('    Failed to process commit batch:', error);
            // Continue with next batch even if this one failed
          }
        }

        // Log repository completion
        console.log(`    Processed ${userCommits.length} commits in ${repo.full_name}`);

      } catch (error: any) {
        // Handle specific error cases
        if (error.status === 404) {
          console.log('  Repository not found or no access - skipping');
          continue;
        } else if (error.status === 403) {
          // Rate limit exceeded - wait for reset
          const resetIn = parseInt(error.response?.headers?.['x-ratelimit-reset'] || '0', 10) * 1000 - Date.now();
          if (resetIn > 0) {
            console.log(`  Rate limit exceeded. Waiting ${Math.ceil(resetIn / 1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, resetIn));
            continue;
          }
        } else if (error.status === 409) {
          console.log('  Repository is empty - skipping');
          continue;
        } else {
          console.error(`  Unexpected error processing repository: ${error.message}`);
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

    // Final analysis
    sendProgress('Analysis complete!');
    console.log('\nFinal Analysis:');
    console.log(`Total commits: ${totalCommits}`);
    console.log('Commits by phase:');
    Object.entries(stats.commitsByPhase).forEach(([phase, count]) => {
      console.log(`  ${phase}: ${count} commits (avg size: ${stats.averageCommitSize[phase]})`);
    });
    console.log('Time of day distribution:');
    Object.entries(stats.timeOfDay).forEach(([time, count]) => {
      console.log(`  ${time}: ${count} commits`);
    });
    if (stats.largestCommit.size > 0) {
      console.log('\nLargest commit:');
      console.log(`  ${stats.largestCommit.size} changes during ${stats.largestCommit.phase}`);
      console.log(`  Message: ${stats.largestCommit.message}`);
      console.log(`  Date: ${new Date(stats.largestCommit.date).toLocaleString()}`);
    }

    return stats;
  } catch (error: any) {
    sendProgress(`Error: ${error.message}`);
    throw error;
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

export async function fetchBasicCommitStats(accessToken: string, username: string, onProgress?: (progress: any) => void) {
  const octokit = new Octokit({ auth: accessToken });
  const repos = await fetchUserRepos(octokit, username);
  
  let totalCommits = 0;
  const commitsByPhase: Record<string, number> = {};
  const commitsByHour: Record<number, number> = {};

  for (const repo of repos) {
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner: repo.owner.login,
      repo: repo.name,
      author: username,
      per_page: 100,
    });

    for (const commit of commits) {
      totalCommits++;
      const date = new Date(commit.commit.author?.date || '');
      const phase = getLunarPhase(date);
      const hour = date.getHours();

      commitsByPhase[phase] = (commitsByPhase[phase] || 0) + 1;
      commitsByHour[hour] = (commitsByHour[hour] || 0) + 1;

      if (onProgress && totalCommits % 10 === 0) {
        onProgress({
          totalCommits,
          commitsByPhase,
          commitsByHour,
          currentRepo: repo.name,
        });
      }
    }
  }

  return {
    totalCommits,
    commitsByPhase,
    commitsByHour,
  };
}

export async function fetchDetailedCommitStats(accessToken: string, username: string, onProgress?: (progress: any) => void) {
  console.log('Starting detailed commit analysis...');
  const stats = await fetchBasicCommitStats(accessToken, username, onProgress);
  console.log('Basic stats fetched, getting commit details...');
  
  const octokit = new Octokit({ auth: accessToken });
  const repos = await fetchUserRepos(octokit, username);
  console.log(`Found ${repos.length} repositories to analyze for details`);

  // Add detailed stats like commit sizes
  let totalAdditions = 0;
  let totalDeletions = 0;
  let largestCommit = { size: 0, message: '', date: new Date() };
  let processedCommits = 0;
  let totalCommits = stats.totalCommits;

  for (const repo of repos) {
    console.log(`Processing detailed stats for ${repo.name}...`);
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner: repo.owner.login,
      repo: repo.name,
      author: username,
      per_page: 100,
    });

    for (const commit of commits) {
      processedCommits++;
      try {
        const details = await octokit.rest.repos.getCommit({
          owner: repo.owner.login,
          repo: repo.name,
          ref: commit.sha,
        });

        totalAdditions += details.data.stats?.additions || 0;
        totalDeletions += details.data.stats?.deletions || 0;

        const size = (details.data.stats?.additions || 0) + (details.data.stats?.deletions || 0);
        if (size > largestCommit.size) {
          largestCommit = {
            size,
            message: commit.commit.message,
            date: new Date(commit.commit.author?.date || ''),
          };
        }

        // Send progress update every 5 commits
        if (processedCommits % 5 === 0) {
          console.log(`Processed ${processedCommits}/${totalCommits} commits...`);
          onProgress?.({
            message: `Analyzing commit details (${processedCommits}/${totalCommits})`,
            progress: {
              current: processedCommits,
              total: totalCommits,
              percentage: Math.round((processedCommits / totalCommits) * 100)
            }
          });
        }
      } catch (error) {
        console.error(`Error processing commit ${commit.sha}:`, error);
      }
    }
  }

  console.log('Detailed analysis complete!');
  console.log(`Total additions: ${totalAdditions}, deletions: ${totalDeletions}`);
  console.log(`Largest commit: ${largestCommit.size} changes`);

  return {
    ...stats,
    totalAdditions,
    totalDeletions,
    largestCommit,
    averageCommitSize: (totalAdditions + totalDeletions) / stats.totalCommits,
  };
} 
