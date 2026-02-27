'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2 } from 'lucide-react';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEATURE_OPTIONS = [
  { value: 'ai_wiki', label: 'AI Wiki Generation' },
  { value: 'diagrams', label: 'Interactive Diagrams' },
  { value: 'code_chat', label: 'Code Chat / Ask AI' },
  { value: 'team', label: 'Team Collaboration' },
  { value: 'private_repos', label: 'Private Repos' },
  { value: 'api', label: 'API Access' },
] as const;

const PRICE_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: '$5/mo', label: '$5/mo' },
  { value: '$10/mo', label: '$10/mo' },
  { value: '$20/mo', label: '$20/mo' },
  { value: 'other', label: 'Other' },
] as const;

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'already_registered' | 'error';

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [useCase, setUseCase] = useState('');
  const [willingToPay, setWillingToPay] = useState('free');
  const [priceOther, setPriceOther] = useState('');
  const [featuresInterested, setFeaturesInterested] = useState<string[]>([]);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setName('');
      setUseCase('');
      setWillingToPay('free');
      setPriceOther('');
      setFeaturesInterested([]);
      setCompany('');
      setRole('');
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  // Auto-close after success
  useEffect(() => {
    if (status === 'success' || status === 'already_registered') {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const toggleFeature = useCallback((feature: string) => {
    setFeaturesInterested(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      const body: Record<string, unknown> = {
        email,
      };
      if (name) body.name = name;
      if (useCase) body.use_case = useCase;
      if (willingToPay) body.willing_to_pay = willingToPay;
      if (willingToPay === 'other' && priceOther) body.price_other = priceOther;
      if (featuresInterested.length > 0) body.features_interested = featuresInterested;
      if (company) body.company = company;
      if (role) body.role = role;

      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setStatus('success');
      } else if (response.status === 409) {
        setStatus('already_registered');
      } else {
        const data = await response.json().catch(() => null);
        setErrorMessage(data?.detail || 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="flex min-h-screen items-center justify-center p-4">
            <motion.div
              className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Success / Already Registered states */}
              {(status === 'success' || status === 'already_registered') ? (
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
                  >
                    <Check className="h-8 w-8 text-primary" />
                  </motion.div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {status === 'success' ? "You're on the list!" : "You're already on the waitlist!"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {status === 'success'
                      ? "We'll notify you when GitUnderstand is ready for you."
                      : "We already have your email. Stay tuned for updates!"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Join the Waitlist</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Get early access to GitUnderstand</p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Email (required) */}
                    <div>
                      <label htmlFor="waitlist-email" className="block text-sm font-medium text-foreground mb-1.5">
                        Email <span className="text-destructive">*</span>
                      </label>
                      <input
                        id="waitlist-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      />
                    </div>

                    {/* Name (optional) */}
                    <div>
                      <label htmlFor="waitlist-name" className="block text-sm font-medium text-foreground mb-1.5">
                        Name
                      </label>
                      <input
                        id="waitlist-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      />
                    </div>

                    {/* Use Case (optional) */}
                    <div>
                      <label htmlFor="waitlist-usecase" className="block text-sm font-medium text-foreground mb-1.5">
                        How do you plan to use GitUnderstand?
                      </label>
                      <textarea
                        id="waitlist-usecase"
                        value={useCase}
                        onChange={(e) => setUseCase(e.target.value)}
                        placeholder="Tell us about your use case..."
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
                      />
                    </div>

                    {/* Willing to Pay (optional) */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        What would you pay for this?
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {PRICE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setWillingToPay(option.value)}
                            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                              willingToPay === option.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      {/* Conditional "Other" input */}
                      {willingToPay === 'other' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="mt-2"
                        >
                          <input
                            type="text"
                            value={priceOther}
                            onChange={(e) => setPriceOther(e.target.value)}
                            placeholder="Your preferred price..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* Features Interested (optional checkboxes) */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Features you are interested in
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {FEATURE_OPTIONS.map((feature) => {
                          const isChecked = featuresInterested.includes(feature.value);
                          return (
                            <button
                              key={feature.value}
                              type="button"
                              onClick={() => toggleFeature(feature.value)}
                              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors text-left ${
                                isChecked
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                isChecked
                                  ? 'border-primary bg-primary'
                                  : 'border-muted-foreground/40'
                              }`}>
                                {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              <span className="truncate">{feature.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Company & Role (optional, inline) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="waitlist-company" className="block text-sm font-medium text-foreground mb-1.5">
                          Company
                        </label>
                        <input
                          id="waitlist-company"
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="Company name"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                        />
                      </div>
                      <div>
                        <label htmlFor="waitlist-role" className="block text-sm font-medium text-foreground mb-1.5">
                          Role
                        </label>
                        <input
                          id="waitlist-role"
                          type="text"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          placeholder="Your role"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>

                    {/* Error message */}
                    {status === 'error' && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-destructive"
                      >
                        {errorMessage}
                      </motion.p>
                    )}
                  </form>

                  {/* Footer */}
                  <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="waitlist-form-trigger"
                      onClick={handleSubmit as unknown as React.MouseEventHandler}
                      disabled={!email || status === 'submitting'}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status === 'submitting' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        'Join Waitlist'
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
