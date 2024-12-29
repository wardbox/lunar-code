'use client';

import { signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

interface AuthButtonsProps {
  isSignedIn: boolean;
}

export default function AuthButtons({ isSignedIn }: AuthButtonsProps) {
  return isSignedIn ? (
    <Button
      onClick={() => signOut()}
      variant="ghost"
      className="text-xs uppercase tracking-wider h-auto p-0"
    >
      Sign Out
    </Button>
  ) : (
    <Button
      onClick={() => signIn('github')}
      variant="outline"
      className="text-xs uppercase tracking-wider px-8 py-6"
    >
      Connect GitHub
    </Button>
  );
} 
