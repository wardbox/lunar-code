import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { fetchUserCommits, fetchUserProfile } from "@/lib/github";
import { Session } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

interface ExtendedSession extends Session {
  accessToken?: string;
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as ExtendedSession;

  if (!session?.accessToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const userProfile = await fetchUserProfile(session.accessToken);
    const stats = await fetchUserCommits(session.accessToken, userProfile.login);
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching commits:', error);
    return new NextResponse("Failed to fetch commits", { status: 500 });
  }
} 
