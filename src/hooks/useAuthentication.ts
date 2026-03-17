'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseAuthenticationReturn {
  /** Whether the backend requires auth codes (legacy) */
  authRequired: boolean;
  /** Legacy auth code value */
  authCode: string;
  /** Legacy auth code setter */
  setAuthCode: (code: string) => void;
  /** Whether the auth state is still loading */
  isAuthLoading: boolean;
  /** Whether the user is signed in — always true with Clerk removed */
  isAuthenticated: boolean;
  /** Whether auth has finished loading — always true */
  isLoaded: boolean;
  /** Get a JWT token for API/WebSocket calls — returns null (no Clerk) */
  getToken: () => Promise<string | null>;
}

export function useAuthentication(): UseAuthenticationReturn {
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

  const getToken = useCallback(async (): Promise<string | null> => {
    return null;
  }, []);

  return {
    authRequired,
    authCode,
    setAuthCode,
    isAuthLoading,
    isAuthenticated: true,
    isLoaded: true,
    getToken,
  };
}
