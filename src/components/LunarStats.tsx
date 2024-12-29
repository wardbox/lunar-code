'use client';

import { useEffect, useState } from 'react';
import { LUNAR_PHASES } from '@/lib/lunar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { GitCommit, Sunrise, Sun, Sunset, Moon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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

export default function LunarStats() {
  const [stats, setStats] = useState<CommitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [progress, setProgress] = useState<{ 
    message: string; 
    progress?: { 
      current: number; 
      total: number; 
      percentage: number;
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
    } 
  } | null>(null);

  useEffect(() => {
    let eventSource: EventSource;

    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        // Start listening for progress updates
        eventSource = new EventSource('/api/progress');
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          setProgress(data);
        };

        // Fetch the actual data
        const response = await fetch('/api/commits');
        if (!response.ok) {
          throw new Error('Failed to fetch commit data');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
        if (eventSource) {
          eventSource.close();
        }
      }
    }

    fetchStats();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  async function fetchDetailedStats() {
    let eventSource: EventSource | undefined;
    try {
      setLoadingDetails(true);
      setError(null);
      setProgress({ message: 'Starting detailed analysis...' });

      // Start listening for progress updates
      eventSource = new EventSource('/api/commits/details');
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Progress update:', data);
        if (data.message || data.progress) {
          setProgress(data);
        }
        // If we get a final stats object, update the stats
        if (data.commitsByPhase && data.averageCommitSize) {
          setStats(data);
          eventSource?.close();
          setLoadingDetails(false);
        }
      };
      eventSource.onerror = (error) => {
        console.error('Progress event source error:', error);
        eventSource?.close();
        setLoadingDetails(false);
        setError('Failed to load detailed stats');
      };
    } catch (err) {
      console.error('Error fetching detailed stats:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoadingDetails(false);
      eventSource?.close();
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
              <Separator className="my-6" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {progress ? (
              <div className="space-y-2">
                <p>{progress.message}</p>
                {progress.progress && (
                  <>
                    <Progress value={progress.progress.percentage} className="h-1" />
                    <p className="text-right text-xs text-muted-foreground">
                      {progress.progress.current} / {progress.progress.total}
                      {' '}({progress.progress.percentage}%)
                    </p>
                  </>
                )}
              </div>
            ) : (
              "Analyzing your commit history..."
            )}
          </div>
        </div>

        {LUNAR_PHASES.map((phase) => (
          <div key={phase.name} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{phase.symbol}</span>
                <span className="text-sm font-serif">{phase.name}</span>
              </div>
              <span className="text-xs tracking-wider text-muted-foreground">
                {progress?.progress?.stats?.commitsByPhase[phase.name] || 0} commits
              </span>
            </div>
            <Progress 
              value={progress?.progress?.stats ? 
                ((progress.progress.stats.commitsByPhase[phase.name] || 0) / 
                Math.max(...Object.values(progress.progress.stats.commitsByPhase), 1)) * 100 
                : 0
              } 
              className="h-1"
            />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="font-serif mb-4 max-w-lg mx-auto">
          <p className="mb-2">{error}</p>
          {error.toString().includes('Rate limit exceeded') && (
            <p className="text-sm text-muted-foreground">
              GitHub limits how many requests we can make to their API. Please wait and try again at the time specified above.
            </p>
          )}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="text-xs uppercase tracking-wider hover:opacity-70"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-xs uppercase tracking-wider text-muted-foreground">No data available</div>;
  }

  const maxCommits = Math.max(...Object.values(stats.commitsByPhase || {}));
  const totalCommits = Object.values(stats.commitsByPhase || {}).reduce((a, b) => a + b, 0);
  
  // Find the dominant phase
  const dominantPhaseName = Object.entries(stats.commitsByPhase || {})
    .reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0])[0];
  const dominantPhase = LUNAR_PHASES.find(phase => phase.name === dominantPhaseName) || LUNAR_PHASES[0];

  // Find preferred time of day
  const maxTimeOfDay = Object.entries(stats.timeOfDay || {
    dawn: 0,
    day: 0,
    dusk: 0,
    night: 0,
  }).reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0]);
  const timeIcons = {
    dawn: <Sunrise className="h-4 w-4" />,
    day: <Sun className="h-4 w-4" />,
    dusk: <Sunset className="h-4 w-4" />,
    night: <Moon className="h-4 w-4" />,
  };

  // Initialize empty stats if needed
  const commitsByPhase = stats.commitsByPhase || {};
  const averageCommitSize = stats.averageCommitSize || {};

  return (
    <div className="space-y-12">
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{dominantPhase.symbol}</span>
            <div>
              <h3 className="font-serif text-lg">You're a {dominantPhase.name.toLowerCase()} coder</h3>
              <p className="text-sm text-muted-foreground">
                {((commitsByPhase[dominantPhaseName] / totalCommits) * 100).toFixed(0)}% of your commits occur during this phase
              </p>
            </div>
          </div>
          <p className="text-sm mb-6">{dominantPhase.personality}</p>
          <Separator className="mb-6" />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                {timeIcons[maxTimeOfDay[0] as keyof typeof timeIcons]}
                <span className="uppercase tracking-wider text-xs">Peak Hours</span>
              </div>
              <p>You commit most during {maxTimeOfDay[0]} ({maxTimeOfDay[1]} commits)</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <GitCommit className="h-4 w-4" />
                <span className="uppercase tracking-wider text-xs">Largest Impact</span>
              </div>
              <p>{stats.largestCommit?.size || 0} changes during {stats.largestCommit?.phase?.toLowerCase() || 'any phase'}</p>
            </div>
          </div>
          {!stats?.averageCommitSize && !loadingDetails && (
            <div className="mt-6 text-center">
              <button
                onClick={fetchDetailedStats}
                className="text-xs uppercase tracking-wider hover:opacity-70"
              >
                Load Detailed Stats
              </button>
            </div>
          )}
          {loadingDetails && (
            <div className="mt-6 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {progress?.message || 'Loading detailed commit information...'}
              </p>
              {progress?.progress && (
                <>
                  <Progress className="mt-2 h-1" value={progress.progress.percentage} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {progress.progress.current} / {progress.progress.total} commits
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-serif text-lg">Lunar Phase Activity</h2>
          <GitCommit className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {totalCommits} commits analyzed across lunar phases
        </p>
      </div>

      <div className="space-y-8">
        {LUNAR_PHASES.map((phase) => (
          <div key={phase.name} className="space-y-3">
            <div className="flex items-center justify-between">
              <HoverCard>
                <HoverCardTrigger>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{phase.symbol}</span>
                    <span className="text-sm font-serif">{phase.name}</span>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{phase.symbol}</span>
                      <h4 className="font-serif text-sm">{phase.name}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{phase.description}</p>
                    <div className="pt-2 text-xs text-muted-foreground">
                      Average commit size: {averageCommitSize[phase.name] || 0} changes
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              <span className="text-xs tracking-wider text-muted-foreground">
                {commitsByPhase[phase.name] || 0} commits
              </span>
            </div>
            <Progress 
              value={((commitsByPhase[phase.name] || 0) / maxCommits) * 100} 
              className="h-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
} 
