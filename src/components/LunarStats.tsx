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
  timeOfDay: {
    dawn: number;
    day: number;
    dusk: number;
    night: number;
  };
}

export default function LunarStats() {
  const [stats, setStats] = useState<CommitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);
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
      }
    }

    fetchStats();
  }, []);

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
          <div className="text-xs uppercase tracking-wider text-muted-foreground animate-pulse">
            Analyzing your commit history...
          </div>
        </div>

        {LUNAR_PHASES.map((phase) => (
          <div key={phase.name} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full" />
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

  const maxCommits = Math.max(...Object.values(stats.commitsByPhase));
  const totalCommits = Object.values(stats.commitsByPhase).reduce((a, b) => a + b, 0);
  
  // Find the dominant phase
  const dominantPhaseName = Object.entries(stats.commitsByPhase)
    .reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const dominantPhase = LUNAR_PHASES.find(phase => phase.name === dominantPhaseName)!;

  // Find preferred time of day
  const maxTimeOfDay = Object.entries(stats.timeOfDay)
    .reduce((a, b) => (b[1] > a[1] ? b : a));
  const timeIcons = {
    dawn: <Sunrise className="h-4 w-4" />,
    day: <Sun className="h-4 w-4" />,
    dusk: <Sunset className="h-4 w-4" />,
    night: <Moon className="h-4 w-4" />,
  };

  return (
    <div className="space-y-12">
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{dominantPhase.symbol}</span>
            <div>
              <h3 className="font-serif text-lg">You're a {dominantPhase.name.toLowerCase()} coder</h3>
              <p className="text-sm text-muted-foreground">
                {((stats.commitsByPhase[dominantPhaseName] / totalCommits) * 100).toFixed(0)}% of your commits occur during this phase
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
                <span className="uppercase tracking-wider text-xs">Total Commits</span>
              </div>
              <p>{totalCommits} commits analyzed</p>
            </div>
          </div>
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
                  </div>
                </HoverCardContent>
              </HoverCard>
              <span className="text-xs tracking-wider text-muted-foreground">
                {stats.commitsByPhase[phase.name] || 0} commits
              </span>
            </div>
            <Progress 
              value={((stats.commitsByPhase[phase.name] || 0) / maxCommits) * 100} 
              className="h-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
} 
