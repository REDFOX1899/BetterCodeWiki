'use client';

import { useState, useEffect, useCallback } from 'react';

// Clerk is only available when a valid publishable key is configured.
const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isClerkEnabled = clerkPubKey.startsWith("pk_");

// Conditionally resolve the useAuth hook at module scope.
// When Clerk is not configured, we use a no-op stub that returns safe defaults.
const useAuth: () => { isLoaded: boolean; isSignedIn: boolean; getToken: (() => Promise<string | null>) | null } =
  isClerkEnabled
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require('@clerk/nextjs').useAuth
    : () => ({ isLoaded: true, isSignedIn: false, getToken: null });

interface UseAuthenticationReturn {
  /** Whether the backend requires auth codes (legacy) */
  authRequired: boolean;
  /** Legacy auth code value */
  authCode: string;
  /** Legacy auth code setter */
  setAuthCode: (code: string) => void;
  /** Whether the auth state is still loading */
  isAuthLoading: boolean;
  /** Whether the user is signed in via Clerk */
  isAuthenticated: boolean;
  /** Whether Clerk has finished loading */
  isLoaded: boolean;
  /** Get a Clerk JWT token for API/WebSocket calls */
  getToken: () => Promise<string | null>;
}

export function useAuthentication(): UseAuthenticationReturn {
  // useAuth is always the same function reference per build — either Clerk's
  // hook or the no-op stub — so this satisfies the Rules of Hooks.
  const { isLoaded, isSignedIn, getToken: clerkGetToken } = useAuth();

  // Legacy backend auth status
  const [authRequired, setAuthRequired] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Fetch legacy backend auth status
  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        setIsAuthLoading(true);
        const response = await fetch('/api/auth/status');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAuthRequired(data.auth_required);
      } catch (err) {
        console.error('Failed to fetch auth status:', err);
        setAuthRequired(true);
      } finally {
        setIsAuthLoading(false);
      }
    };

    fetchAuthStatus();
  }, []);

  // Wrapper around Clerk's getToken that handles edge cases
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!isLoaded || !isSignedIn || !clerkGetToken) return null;
    try {
      return await clerkGetToken();
    } catch (err) {
      console.error('Failed to get Clerk token:', err);
      return null;
    }
  }, [isLoaded, isSignedIn, clerkGetToken]);

  return {
    authRequired,
    authCode,
    setAuthCode,
    isAuthLoading: isAuthLoading || !isLoaded,
    isAuthenticated: isLoaded && !!isSignedIn,
    isLoaded: !!isLoaded,
    getToken,
  };
}
