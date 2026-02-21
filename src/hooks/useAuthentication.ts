'use client';

import { useState, useEffect } from 'react';

interface UseAuthenticationReturn {
  authRequired: boolean;
  authCode: string;
  setAuthCode: (code: string) => void;
  isAuthLoading: boolean;
}

export function useAuthentication(): UseAuthenticationReturn {
  const [authRequired, setAuthRequired] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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

  return { authRequired, authCode, setAuthCode, isAuthLoading };
}
