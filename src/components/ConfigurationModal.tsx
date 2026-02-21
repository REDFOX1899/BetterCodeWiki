'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import UserSelector from './UserSelector';
import TokenInput from './TokenInput';

export interface WikiTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt_guidance: string;
  structure_hint: string;
  page_count: string;
  focus_areas: string[];
}

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Repository input
  repositoryInput: string;

  // Language selection
  selectedLanguage: string;
  setSelectedLanguage: (value: string) => void;
  supportedLanguages: Record<string, string>;

  // Wiki type options
  isComprehensiveView: boolean;
  setIsComprehensiveView: (value: boolean) => void;

  // Template selection
  selectedTemplate: string;
  setSelectedTemplate: (value: string) => void;

  // Model selection
  provider: string;
  setProvider: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  isCustomModel: boolean;
  setIsCustomModel: (value: boolean) => void;
  customModel: string;
  setCustomModel: (value: string) => void;

  // Platform selection
  selectedPlatform: 'github' | 'gitlab' | 'bitbucket';
  setSelectedPlatform: (value: 'github' | 'gitlab' | 'bitbucket') => void;

  // Access token
  accessToken: string;
  setAccessToken: (value: string) => void;

  // File filter options
  excludedDirs: string;
  setExcludedDirs: (value: string) => void;
  excludedFiles: string;
  setExcludedFiles: (value: string) => void;
  includedDirs: string;
  setIncludedDirs: (value: string) => void;
  includedFiles: string;
  setIncludedFiles: (value: string) => void;

  // Form submission
  onSubmit: () => void;
  isSubmitting: boolean;

  // Authentication
  authRequired?: boolean;
  authCode?: string;
  setAuthCode?: (code: string) => void;
  isAuthLoading?: boolean;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  BookOpen: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  Layers: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25-9.75 5.25-9.75-5.25 4.179-2.25" />
    </svg>
  ),
  Code: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  ),
  Rocket: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
  Shield: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
};

const STEPS = [
  { number: 1, label: 'Wiki Settings' },
  { number: 2, label: 'Model & Filters' },
  { number: 3, label: 'Access & Auth' },
] as const;

export default function ConfigurationModal({
  isOpen,
  onClose,
  repositoryInput,
  selectedLanguage,
  setSelectedLanguage,
  supportedLanguages,
  isComprehensiveView,
  setIsComprehensiveView,
  selectedTemplate,
  setSelectedTemplate,
  provider,
  setProvider,
  model,
  setModel,
  isCustomModel,
  setIsCustomModel,
  customModel,
  setCustomModel,
  selectedPlatform,
  setSelectedPlatform,
  accessToken,
  setAccessToken,
  excludedDirs,
  setExcludedDirs,
  excludedFiles,
  setExcludedFiles,
  includedDirs,
  setIncludedDirs,
  includedFiles,
  setIncludedFiles,
  onSubmit,
  isSubmitting,
  authRequired,
  authCode,
  setAuthCode,
  isAuthLoading
}: ConfigurationModalProps) {
  const { messages: t } = useLanguage();

  const [currentStep, setCurrentStep] = useState(1);
  const [showTokenSection, setShowTokenSection] = useState(false);
  const [templates, setTemplates] = useState<Record<string, WikiTemplate>>({});

  // Fetch templates from the backend
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/wiki_templates');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.templates) {
            setTemplates(data.templates);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch wiki templates:', err);
      }
    };
    fetchTemplates();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Reset to step 1 when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
    }
  }, [isOpen]);

  // Sync comprehensive view with template selection
  useEffect(() => {
    // "comprehensive" is the only template that uses sections
    setIsComprehensiveView(selectedTemplate === 'comprehensive');
  }, [selectedTemplate, setIsComprehensiveView]);

  if (!isOpen) return null;

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, 3) as 1 | 2 | 3);
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1) as 1 | 2 | 3);

  const templateList = Object.values(templates);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card elevation-4 animate-in fade-in zoom-in-95 duration-200 sm:mx-4">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <h3 className="text-lg font-semibold leading-none tracking-tight text-foreground">
            {t.form?.configureWiki || 'Configure Wiki'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="sr-only">Close</span>
          </button>
        </div>

        {/* Modal body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {/* Step Indicators */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.map((step, idx) => (
                <React.Fragment key={step.number}>
                  {/* Step circle + label */}
                  <div className="flex flex-col items-center gap-1.5 relative z-10">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-300 ${
                        currentStep > step.number
                          ? 'bg-success text-success-foreground'
                          : currentStep === step.number
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {currentStep > step.number ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.number
                      )}
                    </div>
                    <span
                      className={`text-xs whitespace-nowrap transition-colors duration-300 ${
                        currentStep === step.number
                          ? 'font-bold text-foreground'
                          : currentStep > step.number
                            ? 'font-medium text-success'
                            : 'font-medium text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connector line between steps */}
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 mx-3 mb-5">
                      <div className="h-0.5 w-full rounded-full bg-border relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-success rounded-full transition-all duration-500 ease-out"
                          style={{ width: currentStep > step.number ? '100%' : '0%' }}
                        />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content with fixed min-height */}
          <div className="min-h-[320px] relative">
            <AnimatePresence mode="wait">
              {/* Step 1: Wiki Settings */}
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {/* Repository info */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium leading-none mb-2 text-foreground">
                      {t.form?.repository || 'Repository'}
                    </label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      {repositoryInput}
                    </div>
                  </div>

                  {/* Language selection */}
                  <div className="mb-6">
                    <label htmlFor="language-select" className="block text-sm font-medium leading-none mb-2 text-foreground">
                      {t.form?.wikiLanguage || 'Wiki Language'}
                    </label>
                    <div className="relative">
                      <select
                        id="language-select"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                      >
                        {
                          Object.entries(supportedLanguages).map(([key, value]) => <option key={key} value={key}>{value}</option>)
                        }
                      </select>
                      <div className="absolute right-3 top-2.5 pointer-events-none">
                        <svg className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Wiki Template Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium leading-none mb-2 text-foreground">
                      {t.form?.wikiTemplate || 'Wiki Template'}
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Choose what kind of documentation to generate
                    </p>
                    {templateList.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {templateList.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => setSelectedTemplate(tmpl.id)}
                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:bg-accent hover:text-accent-foreground ${
                              selectedTemplate === tmpl.id
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border bg-background'
                            }`}
                          >
                            <div className={`flex-shrink-0 mt-0.5 ${
                              selectedTemplate === tmpl.id ? 'text-primary' : 'text-muted-foreground'
                            }`}>
                              {TEMPLATE_ICONS[tmpl.icon] || TEMPLATE_ICONS.BookOpen}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm text-foreground truncate">{tmpl.name}</span>
                                {selectedTemplate === tmpl.id && (
                                  <div className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground line-clamp-2">{tmpl.description}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      /* Fallback to the original comprehensive/concise toggle when templates fail to load */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => { setIsComprehensiveView(true); setSelectedTemplate('comprehensive'); }}
                          className={`flex flex-col items-start p-4 rounded-lg border text-left transition-all hover:bg-accent hover:text-accent-foreground ${isComprehensiveView
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border bg-background'
                            }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <div className="font-semibold text-sm text-foreground">{t.form?.comprehensive || 'Comprehensive'}</div>
                            {isComprehensiveView && (
                              <div className="h-2 w-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t.form?.comprehensiveDescription || 'Detailed wiki with structured sections'}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setIsComprehensiveView(false); setSelectedTemplate('comprehensive'); }}
                          className={`flex flex-col items-start p-4 rounded-lg border text-left transition-all hover:bg-accent hover:text-accent-foreground ${!isComprehensiveView
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border bg-background'
                            }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <div className="font-semibold text-sm text-foreground">{t.form?.concise || 'Concise'}</div>
                            {!isComprehensiveView && (
                              <div className="h-2 w-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t.form?.conciseDescription || 'Simplified wiki with fewer pages'}
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Model & Filters */}
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <div className="mb-6">
                    <UserSelector
                      provider={provider}
                      setProvider={setProvider}
                      model={model}
                      setModel={setModel}
                      isCustomModel={isCustomModel}
                      setIsCustomModel={setIsCustomModel}
                      customModel={customModel}
                      setCustomModel={setCustomModel}
                      showFileFilters={true}
                      excludedDirs={excludedDirs}
                      setExcludedDirs={setExcludedDirs}
                      excludedFiles={excludedFiles}
                      setExcludedFiles={setExcludedFiles}
                      includedDirs={includedDirs}
                      setIncludedDirs={setIncludedDirs}
                      includedFiles={includedFiles}
                      setIncludedFiles={setIncludedFiles}
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 3: Access & Auth */}
              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {/* Access token section */}
                  <div className="mb-6">
                    <TokenInput
                      selectedPlatform={selectedPlatform}
                      setSelectedPlatform={setSelectedPlatform}
                      accessToken={accessToken}
                      setAccessToken={setAccessToken}
                      showTokenSection={showTokenSection}
                      onToggleTokenSection={() => setShowTokenSection(!showTokenSection)}
                      allowPlatformChange={true}
                    />
                  </div>

                  {/* Authorization Code Input */}
                  {isAuthLoading && (
                    <div className="mb-6 p-4 rounded-md border border-border bg-muted/50 text-sm text-muted-foreground animate-pulse">
                      Loading authentication status...
                    </div>
                  )}
                  {!isAuthLoading && authRequired && (
                    <div className="mb-6 p-4 rounded-md border border-border bg-background shadow-sm">
                      <label htmlFor="authCode" className="block text-sm font-medium leading-none mb-2 text-foreground">
                        {t.form?.authorizationCode || 'Authorization Code'}
                      </label>
                      <input
                        type="password"
                        id="authCode"
                        value={authCode || ''}
                        onChange={(e) => setAuthCode?.(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Enter your authorization code"
                      />
                      <div className="flex items-center mt-2 text-xs text-muted-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t.form?.authorizationRequired || 'Authentication is required to generate the wiki.'}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
          {/* Left side button */}
          <div>
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              >
                {t.common?.cancel || 'Cancel'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
          </div>

          {/* Right side button */}
          <div>
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                Next
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {isSubmitting ? (t.common?.processing || 'Processing...') : (t.common?.generateWiki || 'Generate Wiki')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
