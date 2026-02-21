'use client';

import { useState, useEffect } from 'react';

interface ModelSelectionParams {
  providerParam: string;
  modelParam: string;
  isCustomModelParam: boolean;
  customModelParam: string;
  excludedDirs: string;
  excludedFiles: string;
  includedDirs: string;
  includedFiles: string;
  isComprehensiveParam: boolean;
}

interface UseModelSelectionReturn {
  selectedProviderState: string;
  setSelectedProviderState: (v: string) => void;
  selectedModelState: string;
  setSelectedModelState: (v: string) => void;
  isCustomSelectedModelState: boolean;
  setIsCustomSelectedModelState: (v: boolean) => void;
  customSelectedModelState: string;
  setCustomSelectedModelState: (v: string) => void;
  showModelOptions: boolean;
  setShowModelOptions: (v: boolean) => void;
  modelExcludedDirs: string;
  setModelExcludedDirs: (v: string) => void;
  modelExcludedFiles: string;
  setModelExcludedFiles: (v: string) => void;
  modelIncludedDirs: string;
  setModelIncludedDirs: (v: string) => void;
  modelIncludedFiles: string;
  setModelIncludedFiles: (v: string) => void;
  isComprehensiveView: boolean;
  setIsComprehensiveView: (v: boolean) => void;
}

export function useModelSelection(params: ModelSelectionParams): UseModelSelectionReturn {
  const [selectedProviderState, setSelectedProviderState] = useState(params.providerParam);
  const [selectedModelState, setSelectedModelState] = useState(params.modelParam);
  const [isCustomSelectedModelState, setIsCustomSelectedModelState] = useState(params.isCustomModelParam);
  const [customSelectedModelState, setCustomSelectedModelState] = useState(params.customModelParam);
  const [showModelOptions, setShowModelOptions] = useState(false);
  const [modelExcludedDirs, setModelExcludedDirs] = useState(params.excludedDirs);
  const [modelExcludedFiles, setModelExcludedFiles] = useState(params.excludedFiles);
  const [modelIncludedDirs, setModelIncludedDirs] = useState(params.includedDirs);
  const [modelIncludedFiles, setModelIncludedFiles] = useState(params.includedFiles);
  const [isComprehensiveView, setIsComprehensiveView] = useState(params.isComprehensiveParam);

  // When provider is empty, fetch the default from /api/models/config
  useEffect(() => {
    if (selectedProviderState) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/models/config');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.defaultProvider) {
          setSelectedProviderState(data.defaultProvider);
          // Also set the default model for that provider if we don't have one
          if (!selectedModelState && data.providers) {
            const providerConfig = data.providers.find(
              (p: { id: string; models?: { id: string }[] }) => p.id === data.defaultProvider
            );
            if (providerConfig?.models?.[0]?.id) {
              setSelectedModelState(providerConfig.models[0].id);
            }
          }
        }
      } catch {
        // Silently ignore — the backend may not be reachable yet
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    selectedProviderState, setSelectedProviderState,
    selectedModelState, setSelectedModelState,
    isCustomSelectedModelState, setIsCustomSelectedModelState,
    customSelectedModelState, setCustomSelectedModelState,
    showModelOptions, setShowModelOptions,
    modelExcludedDirs, setModelExcludedDirs,
    modelExcludedFiles, setModelExcludedFiles,
    modelIncludedDirs, setModelIncludedDirs,
    modelIncludedFiles, setModelIncludedFiles,
    isComprehensiveView, setIsComprehensiveView,
  };
}
