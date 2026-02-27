'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

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
  // Clerk auth state
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
    if (!isLoaded || !isSignedIn) return null;
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
