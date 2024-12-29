import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { fetchDetailedCommitStats, fetchUserProfile } from '@/lib/github';
import prisma from '@/lib/prisma';
import { ReadableStream } from 'stream/web';

const encoder = new TextEncoder();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Create a transform stream for progress updates
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  (global as any).progressController = writer;

  try {
    // First get the GitHub username from profile
    const profile = await fetchUserProfile(session.accessToken);
    
    // Get user from database
    const user = await prisma.user.findFirst({
      where: {
        email: session.user?.email,
      },
      include: {
        commitStats: true,
        analysis: true,
      },
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // Start fetching stats in the background
    const statsPromise = fetchDetailedCommitStats(session.accessToken, profile.login, (progress) => {
      // Write progress to stream
      writer.write(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
      
      // Also update progress in database
      prisma.analysisProgress.update({
        where: { userId: user.id },
        data: {
          progress: JSON.parse(JSON.stringify(progress))
        }
      }).catch(console.error);
    });

    // Return the progress stream immediately
    const progressResponse = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    // When stats are done, update the cache
    statsPromise.then(async (stats) => {
      await prisma.commitStats.update({
        where: { userId: user.id },
        data: {
          data: JSON.parse(JSON.stringify(stats))
        }
      });
      
      // Close the stream
      writer.close();
    }).catch((error) => {
      console.error('Error fetching detailed stats:', error);
      writer.close();
    });

    return progressResponse;
  } catch (error: any) {
    console.error('Error setting up stats fetch:', error);
    (global as any).progressController = null;
    return new NextResponse(
      error.message || 'Internal Server Error',
      { status: error.status || 500 }
    );
  }
} 
