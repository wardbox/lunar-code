import { User as PrismaUser } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      commitStats?: {
        data: any;
        updatedAt: Date;
      } | null;
      analysisProgress?: {
        status: string;
        progress: any;
        error?: string | null;
      } | null;
    };
    accessToken?: string;
  }
} 
