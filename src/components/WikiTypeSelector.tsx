'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { FaBookOpen, FaList } from 'react-icons/fa';

interface WikiTypeSelectorProps {
  isComprehensiveView: boolean;
  setIsComprehensiveView: (value: boolean) => void;
}

const WikiTypeSelector: React.FC<WikiTypeSelectorProps> = ({
  isComprehensiveView,
  setIsComprehensiveView,
}) => {
  const { messages: t } = useLanguage();

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground mb-2">
        {t.form?.wikiType || 'Wiki Type'}
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => setIsComprehensiveView(true)}
          className={`group flex items-center justify-between p-3 rounded-md border transition-all ${isComprehensiveView
              ? 'bg-primary/5 border-primary text-primary shadow-sm'
              : 'bg-background border-input text-foreground hover:bg-muted/50 hover:border-accent-foreground/20'
            }`}
        >
          <div className="flex items-center">
            <FaBookOpen className={`mr-2 ${isComprehensiveView ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
            <div className="text-left">
              <div className="font-medium text-sm">{t.form?.comprehensive || 'Comprehensive'}</div>
              <div className={`text-xs ${isComprehensiveView ? 'text-primary/80' : 'text-muted-foreground'}`}>
                {t.form?.comprehensiveDescription || 'Detailed wiki with structured sections'}
              </div>
            </div>
          </div>
          {isComprehensiveView && (
            <div className="ml-2 h-4 w-4 rounded-full border border-primary/30 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary"></div>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsComprehensiveView(false)}
          className={`group flex items-center justify-between p-3 rounded-md border transition-all ${!isComprehensiveView
              ? 'bg-primary/5 border-primary text-primary shadow-sm'
              : 'bg-background border-input text-foreground hover:bg-muted/50 hover:border-accent-foreground/20'
            }`}
        >
          <div className="flex items-center">
            <FaList className={`mr-2 ${!isComprehensiveView ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
            <div className="text-left">
              <div className="font-medium text-sm">{t.form?.concise || 'Concise'}</div>
              <div className={`text-xs ${!isComprehensiveView ? 'text-primary/80' : 'text-muted-foreground'}`}>
                {t.form?.conciseDescription || 'Simplified wiki with essential info'}
              </div>
            </div>
          </div>
          {!isComprehensiveView && (
            <div className="ml-2 h-4 w-4 rounded-full border border-primary/30 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary"></div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default WikiTypeSelector;
