import { NextResponse } from 'next/server';

const encoder = new TextEncoder();

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      // Store the controller in global scope so we can write to it from anywhere
      (global as any).progressController = controller;
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 
