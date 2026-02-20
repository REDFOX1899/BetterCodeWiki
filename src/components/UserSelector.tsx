'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

// Define the interfaces for our model configuration
interface Model {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
  models: Model[];
  supportsCustomModel?: boolean;
}

interface ModelConfig {
  providers: Provider[];
  defaultProvider: string;
}

interface ModelSelectorProps {
  provider: string;
  setProvider: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  isCustomModel: boolean;
  setIsCustomModel: (value: boolean) => void;
  customModel: string;
  setCustomModel: (value: string) => void;

  // File filter configuration
  showFileFilters?: boolean;
  excludedDirs?: string;
  setExcludedDirs?: (value: string) => void;
  excludedFiles?: string;
  setExcludedFiles?: (value: string) => void;
  includedDirs?: string;
  setIncludedDirs?: (value: string) => void;
  includedFiles?: string;
  setIncludedFiles?: (value: string) => void;
}

export default function UserSelector({
  provider,
  setProvider,
  model,
  setModel,
  isCustomModel,
  setIsCustomModel,
  customModel,
  setCustomModel,

  // File filter configuration
  showFileFilters = false,
  excludedDirs = '',
  setExcludedDirs,
  excludedFiles = '',
  setExcludedFiles,
  includedDirs = '',
  setIncludedDirs,
  includedFiles = '',
  setIncludedFiles
}: ModelSelectorProps) {
  // State to manage the visibility of the filters modal and filter section
  const [isFilterSectionOpen, setIsFilterSectionOpen] = useState(false);
  // State to manage filter mode: 'exclude' or 'include'
  const [filterMode, setFilterMode] = useState<'exclude' | 'include'>('exclude');
  const { messages: t } = useLanguage();

  // State for model configurations from backend
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for viewing default values
  const [showDefaultDirs, setShowDefaultDirs] = useState(false);
  const [showDefaultFiles, setShowDefaultFiles] = useState(false);

  // Fetch model configurations from the backend
  useEffect(() => {
    const fetchModelConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/models/config');

        if (!response.ok) {
          throw new Error(`Error fetching model configurations: ${response.status}`);
        }

        const data = await response.json();
        setModelConfig(data);

        // Initialize provider and model with defaults from API if not already set
        if (!provider && data.defaultProvider) {
          setProvider(data.defaultProvider);

          // Find the default provider and set its default model
          const selectedProvider = data.providers.find((p: Provider) => p.id === data.defaultProvider);
          if (selectedProvider && selectedProvider.models.length > 0) {
            setModel(selectedProvider.models[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch model configurations:', err);
        setError('Failed to load model configurations. Using default options.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchModelConfig();
  }, [provider, setModel, setProvider]);

  // Handler for changing provider
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setTimeout(() => {
      // Reset custom model state when changing providers
      setIsCustomModel(false);

      // Set default model for the selected provider
      if (modelConfig) {
        const selectedProvider = modelConfig.providers.find((p: Provider) => p.id === newProvider);
        if (selectedProvider && selectedProvider.models.length > 0) {
          setModel(selectedProvider.models[0].id);
        }
      }
    }, 10);
  };

  // Default excluded directories from config.py
  const defaultExcludedDirs =
    `./.venv/
./venv/
./env/
./virtualenv/
./node_modules/
./bower_components/
./jspm_packages/
./.git/
./.svn/
./.hg/
./.bzr/
./__pycache__/
./.pytest_cache/
./.mypy_cache/
./.ruff_cache/
./.coverage/
./dist/
./build/
./out/
./target/
./bin/
./obj/
./docs/
./_docs/
./site-docs/
./_site/
./.idea/
./.vscode/
./.vs/
./.eclipse/
./.settings/
./logs/
./log/
./tmp/
./temp/
./.eng`;

  // Default excluded files from config.py
  const defaultExcludedFiles =
    `package-lock.json
yarn.lock
pnpm-lock.yaml
npm-shrinkwrap.json
poetry.lock
Pipfile.lock
requirements.txt.lock
Cargo.lock
composer.lock
.lock
.DS_Store
Thumbs.db
desktop.ini
*.lnk
.env
.env.*
*.env
*.cfg
*.ini
.flaskenv
.gitignore
.gitattributes
.gitmodules
.github
.gitlab-ci.yml
.prettierrc
.eslintrc
.eslintignore
.stylelintrc
.editorconfig
.jshintrc
.pylintrc
.flake8
mypy.ini
pyproject.toml
tsconfig.json
webpack.config.js
babel.config.js
rollup.config.js
jest.config.js
karma.conf.js
vite.config.js
next.config.js
*.min.js
*.min.css
*.bundle.js
*.bundle.css
*.map
*.gz
*.zip
*.tar
*.tgz
*.rar
*.pyc
*.pyo
*.pyd
*.so
*.dll
*.class
*.exe
*.o
*.a
*.jpg
*.jpeg
*.png
*.gif
*.ico
*.svg
*.webp
*.mp3
*.mp4
*.wav
*.avi
*.mov
*.webm
*.csv
*.tsv
*.xls
*.xlsx
*.db
*.sqlite
*.sqlite3
*.pdf
*.docx
*.pptx`;

  // Display loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">Loading model configurations...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-destructive mb-2">{error}</div>
        )}

        {/* Provider Selection */}
        <div>
          <label htmlFor="provider-dropdown" className="block text-xs font-medium text-foreground mb-1.5">
            {t.form?.modelProvider || 'Model Provider'}
          </label>
          <select
            id="provider-dropdown"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>{t.form?.selectProvider || 'Select Provider'}</option>
            {modelConfig?.providers.map((providerOption) => (
              <option key={providerOption.id} value={providerOption.id}>
                {t.form?.[`provider${providerOption.id.charAt(0).toUpperCase() + providerOption.id.slice(1)}`] || providerOption.name}
              </option>
            ))}
          </select>
        </div>

        {/* Model Selection - consistent height regardless of type */}
        <div>
          <label htmlFor={isCustomModel ? "custom-model-input" : "model-dropdown"} className="block text-xs font-medium text-foreground mb-1.5">
            {t.form?.modelSelection || 'Model Selection'}
          </label>

          {isCustomModel ? (
            <input
              id="custom-model-input"
              type="text"
              value={customModel}
              onChange={(e) => {
                setCustomModel(e.target.value);
                setModel(e.target.value);
              }}
              placeholder={t.form?.customModelPlaceholder || 'Enter custom model name'}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          ) : (
            <select
              id="model-dropdown"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!provider || isLoading || !modelConfig?.providers.find(p => p.id === provider)?.models?.length}
            >
              {modelConfig?.providers.find((p: Provider) => p.id === provider)?.models.map((modelOption) => (
                <option key={modelOption.id} value={modelOption.id}>
                  {modelOption.name}
                </option>
              )) || <option value="">{t.form?.selectModel || 'Select Model'}</option>}
            </select>
          )}
        </div>

        {/* Custom model toggle - only when provider supports it */}
        {modelConfig?.providers.find((p: Provider) => p.id === provider)?.supportsCustomModel && (
          <div className="mb-2">
            <div className="flex items-center pb-1">
              <div
                className="relative flex items-center cursor-pointer"
                onClick={() => {
                  const newValue = !isCustomModel;
                  setIsCustomModel(newValue);
                  if (newValue) {
                    setCustomModel(model);
                  }
                }}
              >
                <input
                  id="use-custom-model"
                  type="checkbox"
                  checked={isCustomModel}
                  onChange={() => { }}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-colors ${isCustomModel ? 'bg-primary' : 'bg-input'}`}></div>
                <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-background shadow-sm transition-transform transform ${isCustomModel ? 'translate-x-4' : ''}`}></div>
              </div>
              <label
                htmlFor="use-custom-model"
                className="ml-2 text-sm font-medium text-muted-foreground cursor-pointer select-none"
                onClick={(e) => {
                  e.preventDefault();
                  const newValue = !isCustomModel;
                  setIsCustomModel(newValue);
                  if (newValue) {
                    setCustomModel(model);
                  }
                }}
              >
                {t.form?.useCustomModel || 'Use custom model'}
              </label>
            </div>
          </div>
        )}

        {showFileFilters && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsFilterSectionOpen(!isFilterSectionOpen)}
              className="flex items-center text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <span className="mr-1.5 text-xs transition-transform duration-200" style={{ transform: isFilterSectionOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              {t.form?.advancedOptions || 'Advanced Options'}
            </button>

            {isFilterSectionOpen && (
              <div className="mt-3 p-4 border border-border/60 rounded-lg bg-muted/20">
                {/* Filter Mode Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t.form?.filterMode || 'Filter Mode'}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterMode('exclude')}
                      className={`flex-1 px-3 py-2 rounded-md border text-sm transition-all font-medium ${filterMode === 'exclude'
                          ? 'bg-primary/10 border-primary text-primary shadow-sm'
                          : 'border-input text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                      {t.form?.excludeMode || 'Exclude Paths'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('include')}
                      className={`flex-1 px-3 py-2 rounded-md border text-sm transition-all font-medium ${filterMode === 'include'
                          ? 'bg-primary/10 border-primary text-primary shadow-sm'
                          : 'border-input text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                      {t.form?.includeMode || 'Include Only Paths'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {filterMode === 'exclude'
                      ? (t.form?.excludeModeDescription || 'Specify paths to exclude from processing (default behavior)')
                      : (t.form?.includeModeDescription || 'Specify only the paths to include, ignoring all others')
                    }
                  </p>
                </div>

                {/* Directories Section */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    {filterMode === 'exclude'
                      ? (t.form?.excludedDirs || 'Excluded Directories')
                      : (t.form?.includedDirs || 'Included Directories')
                    }
                  </label>
                  <textarea
                    value={filterMode === 'exclude' ? excludedDirs : includedDirs}
                    onChange={(e) => {
                      if (filterMode === 'exclude') {
                        setExcludedDirs?.(e.target.value);
                      } else {
                        setIncludedDirs?.(e.target.value);
                      }
                    }}
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={filterMode === 'exclude'
                      ? (t.form?.enterExcludedDirs || 'Enter excluded directories, one per line...')
                      : (t.form?.enterIncludedDirs || 'Enter included directories, one per line...')
                    }
                  />
                  {filterMode === 'exclude' && (
                    <>
                      <div className="flex mt-1.5">
                        <button
                          type="button"
                          onClick={() => setShowDefaultDirs(!showDefaultDirs)}
                          className="text-xs text-primary hover:text-primary/80 transition-colors hover:underline"
                        >
                          {showDefaultDirs ? (t.form?.hideDefault || 'Hide Default') : (t.form?.viewDefault || 'View Default')}
                        </button>
                      </div>
                      {showDefaultDirs && (
                        <div className="mt-2 p-3 rounded-md bg-muted/50 text-xs border border-border/50">
                          <p className="mb-1 text-muted-foreground font-medium">{t.form?.defaultNote || 'These defaults are already applied. Add your custom exclusions above.'}</p>
                          <pre className="whitespace-pre-wrap font-mono text-muted-foreground overflow-y-auto max-h-32 text-[10px] leading-relaxed">{defaultExcludedDirs}</pre>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Files Section */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    {filterMode === 'exclude'
                      ? (t.form?.excludedFiles || 'Excluded Files')
                      : (t.form?.includedFiles || 'Included Files')
                    }
                  </label>
                  <textarea
                    value={filterMode === 'exclude' ? excludedFiles : includedFiles}
                    onChange={(e) => {
                      if (filterMode === 'exclude') {
                        setExcludedFiles?.(e.target.value);
                      } else {
                        setIncludedFiles?.(e.target.value);
                      }
                    }}
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={filterMode === 'exclude'
                      ? (t.form?.enterExcludedFiles || 'Enter excluded files, one per line...')
                      : (t.form?.enterIncludedFiles || 'Enter included files, one per line...')
                    }
                  />
                  {filterMode === 'exclude' && (
                    <>
                      <div className="flex mt-1.5">
                        <button
                          type="button"
                          onClick={() => setShowDefaultFiles(!showDefaultFiles)}
                          className="text-xs text-primary hover:text-primary/80 transition-colors hover:underline"
                        >
                          {showDefaultFiles ? (t.form?.hideDefault || 'Hide Default') : (t.form?.viewDefault || 'View Default')}
                        </button>
                      </div>
                      {showDefaultFiles && (
                        <div className="mt-2 p-3 rounded-md bg-muted/50 text-xs border border-border/50">
                          <p className="mb-1 text-muted-foreground font-medium">{t.form?.defaultNote || 'These defaults are already applied. Add your custom exclusions above.'}</p>
                          <pre className="whitespace-pre-wrap font-mono text-muted-foreground overflow-y-auto max-h-32 text-[10px] leading-relaxed">{defaultExcludedFiles}</pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
