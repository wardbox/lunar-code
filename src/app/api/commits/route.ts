import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { fetchUserCommits, fetchUserProfile, fetchBasicCommitStats } from '@/lib/github';
import prisma from '@/lib/prisma';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // First get the GitHub username from profile
    const profile = await fetchUserProfile(session.accessToken);
    console.log('GitHub profile:', { login: profile.login });

    // Get user from database
    const user = await prisma.user.findFirst({
      where: {
        email: session.user?.email,
      },
      include: {
        commitStats: true,
        analysis: true
      },
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // Check if there's an analysis in progress
    if (user.analysis?.status === 'in_progress') {
      return NextResponse.json(user.analysis.progress);
    }

    // Check if we have cached stats that aren't too old
    if (user.commitStats) {
      const lastUpdate = user.commitStats.updatedAt;
      const now = new Date();
      if (now.getTime() - lastUpdate.getTime() < CACHE_TTL) {
        console.log('Returning cached commit stats');
        return NextResponse.json(user.commitStats.data);
      }
    }

    // Create or update analysis progress
    await prisma.analysisProgress.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: 'in_progress',
        progress: {}
      },
      update: {
        status: 'in_progress',
        progress: {},
        error: null
      }
    });

    // If no cache or cache is old, fetch new data
    console.log('Fetching fresh commit stats...');
    const stats = await fetchBasicCommitStats(session.accessToken, profile.login, (progress) => {
      // Update progress in database
      prisma.analysisProgress.update({
        where: { userId: user.id },
        data: {
          progress: JSON.parse(JSON.stringify(progress))
        }
      }).catch(console.error);
    });

    // Serialize the stats to ensure they're JSON-compatible
    const serializedStats = JSON.parse(JSON.stringify(stats));

    // Update both cache and analysis status
    await prisma.$transaction([
      prisma.commitStats.upsert({
        where: { userId: user.id },
        update: { data: serializedStats },
        create: {
          userId: user.id,
          data: serializedStats,
        },
      }),
      prisma.analysisProgress.update({
        where: { userId: user.id },
        data: {
          status: 'completed',
          progress: serializedStats
        }
      })
    ]);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error in /api/commits:', error);

    // Update analysis status with error
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email }
      });
      if (user) {
        await prisma.analysisProgress.update({
          where: { userId: user.id },
          data: {
            status: 'error',
            error: error.message
          }
        });
      }
    }

    return new NextResponse(
      error.message || 'Internal Server Error',
      { status: error.status || 500 }
    );
  }
} 
