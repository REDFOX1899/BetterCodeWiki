'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TokenInputProps {
  selectedPlatform: 'github' | 'gitlab' | 'bitbucket';
  setSelectedPlatform: (value: 'github' | 'gitlab' | 'bitbucket') => void;
  accessToken: string;
  setAccessToken: (value: string) => void;
  showTokenSection?: boolean;
  onToggleTokenSection?: () => void;
  allowPlatformChange?: boolean;
}

export default function TokenInput({
  selectedPlatform,
  setSelectedPlatform,
  accessToken,
  setAccessToken,
  showTokenSection = true,
  onToggleTokenSection,
  allowPlatformChange = true
}: TokenInputProps) {
  const { messages: t } = useLanguage();

  const platformName = selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1);

  return (
    <div className="mb-4">
      {onToggleTokenSection && (
        <button
          type="button"
          onClick={onToggleTokenSection}
          className="text-sm font-medium text-primary hover:text-primary/80 flex items-center transition-colors border-b border-input hover:border-primary pb-0.5 mb-2"
        >
          {showTokenSection ? t.form?.hideTokens || 'Hide Access Tokens' : t.form?.addTokens || 'Add Access Tokens for Private Repositories'}
        </button>
      )}

      {showTokenSection && (
        <div className="mt-2 p-4 bg-muted/30 rounded-md border border-border">
          {allowPlatformChange && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-foreground mb-2">
                {t.form?.selectPlatform || 'Select Platform'}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlatform('github')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-all ${selectedPlatform === 'github'
                    ? 'bg-primary/10 border-primary text-primary shadow-sm font-medium'
                    : 'bg-background border-input text-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                >
                  <span className="text-sm">GitHub</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlatform('gitlab')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-all ${selectedPlatform === 'gitlab'
                    ? 'bg-primary/10 border-primary text-primary shadow-sm font-medium'
                    : 'bg-background border-input text-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                >
                  <span className="text-sm">GitLab</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlatform('bitbucket')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-all ${selectedPlatform === 'bitbucket'
                    ? 'bg-primary/10 border-primary text-primary shadow-sm font-medium'
                    : 'bg-background border-input text-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                >
                  <span className="text-sm">Bitbucket</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="access-token" className="block text-xs font-medium text-foreground mb-2">
              {(t.form?.personalAccessToken || 'Personal Access Token').replace('{platform}', platformName)}
            </label>
            <input
              id="access-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={(t.form?.tokenPlaceholder || 'Enter your access token').replace('{platform}', platformName)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center mt-2 text-xs text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-muted-foreground"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t.form?.tokenSecurityNote || 'Your token is stored locally and never sent to our servers.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 