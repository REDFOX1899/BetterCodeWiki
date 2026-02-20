'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import UserSelector from './UserSelector';
import WikiTypeSelector from './WikiTypeSelector';
import TokenInput from './TokenInput';

interface ModelSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: string;
  setProvider: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  isCustomModel: boolean;
  setIsCustomModel: (value: boolean) => void;
  customModel: string;
  setCustomModel: (value: string) => void;
  onApply: (token?: string) => void;

  // Wiki type options
  isComprehensiveView: boolean;
  setIsComprehensiveView: (value: boolean) => void;

  // File filter options - optional
  excludedDirs?: string;
  setExcludedDirs?: (value: string) => void;
  excludedFiles?: string;
  setExcludedFiles?: (value: string) => void;
  includedDirs?: string;
  setIncludedDirs?: (value: string) => void;
  includedFiles?: string;
  setIncludedFiles?: (value: string) => void;
  showFileFilters?: boolean;
  showWikiType: boolean;

  // Token input for refresh
  showTokenInput?: boolean;
  repositoryType?: 'github' | 'gitlab' | 'bitbucket';
  // Authentication
  authRequired?: boolean;
  authCode?: string;
  setAuthCode?: (code: string) => void;
  isAuthLoading?: boolean;
}

export default function ModelSelectionModal({
  isOpen,
  onClose,
  provider,
  setProvider,
  model,
  setModel,
  isCustomModel,
  setIsCustomModel,
  customModel,
  setCustomModel,
  onApply,
  isComprehensiveView,
  setIsComprehensiveView,
  excludedDirs = '',
  setExcludedDirs,
  excludedFiles = '',
  setExcludedFiles,
  includedDirs = '',
  setIncludedDirs,
  includedFiles = '',
  setIncludedFiles,
  showFileFilters = false,
  authRequired = false,
  authCode = '',
  setAuthCode,
  isAuthLoading,
  showWikiType = true,
  showTokenInput = false,
  repositoryType = 'github',
}: ModelSelectionModalProps) {
  const { messages: t } = useLanguage();

  // Local state for form values (to only apply changes when the user clicks "Submit")
  const [localProvider, setLocalProvider] = useState(provider);
  const [localModel, setLocalModel] = useState(model);
  const [localIsCustomModel, setLocalIsCustomModel] = useState(isCustomModel);
  const [localCustomModel, setLocalCustomModel] = useState(customModel);
  const [localIsComprehensiveView, setLocalIsComprehensiveView] = useState(isComprehensiveView);
  const [localExcludedDirs, setLocalExcludedDirs] = useState(excludedDirs);
  const [localExcludedFiles, setLocalExcludedFiles] = useState(excludedFiles);
  const [localIncludedDirs, setLocalIncludedDirs] = useState(includedDirs);
  const [localIncludedFiles, setLocalIncludedFiles] = useState(includedFiles);

  // Token input state
  const [localAccessToken, setLocalAccessToken] = useState('');
  const [localSelectedPlatform, setLocalSelectedPlatform] = useState<'github' | 'gitlab' | 'bitbucket'>(repositoryType);
  const [showTokenSection, setShowTokenSection] = useState(showTokenInput);

  // Reset local state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setLocalProvider(provider);
      setLocalModel(model);
      setLocalIsCustomModel(isCustomModel);
      setLocalCustomModel(customModel);
      setLocalIsComprehensiveView(isComprehensiveView);
      setLocalExcludedDirs(excludedDirs);
      setLocalExcludedFiles(excludedFiles);
      setLocalIncludedDirs(includedDirs);
      setLocalIncludedFiles(includedFiles);
      setLocalSelectedPlatform(repositoryType);
      setLocalAccessToken('');
      setShowTokenSection(showTokenInput);
    }
  }, [isOpen, provider, model, isCustomModel, customModel, isComprehensiveView, excludedDirs, excludedFiles, includedDirs, includedFiles, repositoryType, showTokenInput]);

  // Handler for applying changes
  const handleApply = () => {
    setProvider(localProvider);
    setModel(localModel);
    setIsCustomModel(localIsCustomModel);
    setCustomModel(localCustomModel);
    setIsComprehensiveView(localIsComprehensiveView);
    if (setExcludedDirs) setExcludedDirs(localExcludedDirs);
    if (setExcludedFiles) setExcludedFiles(localExcludedFiles);
    if (setIncludedDirs) setIncludedDirs(localIncludedDirs);
    if (setIncludedFiles) setIncludedFiles(localIncludedFiles);

    // Pass token to onApply if needed
    if (showTokenInput) {
      onApply(localAccessToken);
    } else {
      onApply();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center bg-black/50 backdrop-blur-sm">
        <div className="relative transform overflow-hidden rounded-lg bg-background text-left shadow-xl transition-all sm:my-8 sm:max-w-lg sm:w-full border border-border">
          {/* Modal header with close button */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              {t.form?.modelSelection || 'Model Selection'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground focus:outline-none transition-colors rounded-sm opacity-70 ring-offset-background hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal body */}
          <div className="p-6 space-y-4">
            {/* Wiki Type Selector */}
            {
              showWikiType && <WikiTypeSelector
                isComprehensiveView={localIsComprehensiveView}
                setIsComprehensiveView={setLocalIsComprehensiveView}
              />
            }

            {/* Divider */}
            <div className="border-t border-border"></div>

            {/* Model Selector */}
            <UserSelector
              provider={localProvider}
              setProvider={setLocalProvider}
              model={localModel}
              setModel={setLocalModel}
              isCustomModel={localIsCustomModel}
              setIsCustomModel={setLocalIsCustomModel}
              customModel={localCustomModel}
              setCustomModel={setLocalCustomModel}
              showFileFilters={showFileFilters}
              excludedDirs={localExcludedDirs}
              setExcludedDirs={showFileFilters ? (value: string) => setLocalExcludedDirs(value) : undefined}
              excludedFiles={localExcludedFiles}
              setExcludedFiles={showFileFilters ? (value: string) => setLocalExcludedFiles(value) : undefined}
              includedDirs={localIncludedDirs}
              setIncludedDirs={showFileFilters ? (value: string) => setLocalIncludedDirs(value) : undefined}
              includedFiles={localIncludedFiles}
              setIncludedFiles={showFileFilters ? (value: string) => setLocalIncludedFiles(value) : undefined}
            />

            {/* Token Input Section for refresh */}
            {showTokenInput && (
              <>
                <div className="border-t border-border"></div>
                <TokenInput
                  selectedPlatform={localSelectedPlatform}
                  setSelectedPlatform={setLocalSelectedPlatform}
                  accessToken={localAccessToken}
                  setAccessToken={setLocalAccessToken}
                  showTokenSection={showTokenSection}
                  onToggleTokenSection={() => setShowTokenSection(!showTokenSection)}
                  allowPlatformChange={false} // Don't allow platform change during refresh
                />
              </>
            )}
            {/* Authorization Code Input */}
            {isAuthLoading && (
              <div className="p-3 bg-muted/50 rounded-md border border-border text-sm text-muted-foreground flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                Loading authentication status...
              </div>
            )}
            {!isAuthLoading && authRequired && (
              <div className="p-4 bg-muted/50 rounded-md border border-border">
                <label htmlFor="authCode" className="block text-sm font-medium text-foreground mb-2">
                  {t.form?.authorizationCode || 'Authorization Code'}
                </label>
                <input
                  type="password"
                  id="authCode"
                  value={authCode || ''}
                  onChange={(e) => setAuthCode?.(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter your authorization code"
                />
                <div className="flex items-center mt-2 text-xs text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-muted-foreground"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t.form?.authorizationRequired || 'Authentication is required to generate the wiki.'}
                </div>
              </div>
            )}
          </div>

          {/* Modal footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {t.common?.cancel || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              {t.common?.submit || 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
