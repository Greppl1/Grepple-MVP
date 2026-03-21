'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { IconCheck, IconSettings } from '@/components/Icons';

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

const CONFIG_KEY = 'grepple_model_config';

interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google';
  apiKey: string;
  model: string;
}

function saveModelConfig(config: ModelConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function loadModelConfig(): ModelConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearModelConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const PROVIDERS = [
  { value: 'anthropic' as const, label: 'Anthropic (Claude)' },
  { value: 'openai' as const, label: 'OpenAI (GPT)' },
  { value: 'google' as const, label: 'Google (Gemini)' },
];

const MODELS: Record<ModelConfig['provider'], { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-5-20250514', label: 'claude-sonnet-4-5-20250514' },
    { value: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5-20251001' },
    { value: 'claude-opus-4-5-20250514', label: 'claude-opus-4-5-20250514' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
    { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
  ],
};

const PLACEHOLDERS: Record<ModelConfig['provider'], string> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
  google: 'AI...',
};

const PROVIDER_LABELS: Record<ModelConfig['provider'], string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

function validateKeyFormat(provider: ModelConfig['provider'], key: string): boolean {
  if (!key) return false;
  switch (provider) {
    case 'anthropic':
      return key.startsWith('sk-ant-');
    case 'openai':
      return key.startsWith('sk-');
    case 'google':
      return key.startsWith('AI');
  }
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const { toast } = useToast();

  const [provider, setProvider] = useState<ModelConfig['provider']>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(MODELS.anthropic[0].value);
  const [showKey, setShowKey] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);
  const [savedConfig, setSavedConfig] = useState<ModelConfig | null>(null);
  const [mounted, setMounted] = useState(false);

  /* Load existing config on mount */
  useEffect(() => {
    const existing = loadModelConfig();
    if (existing) {
      setProvider(existing.provider);
      setApiKey(existing.apiKey);
      setModel(existing.model);
      setSavedConfig(existing);
    }
    setMounted(true);
  }, []);

  /* When provider changes, reset model to first option of that provider */
  const handleProviderChange = (newProvider: ModelConfig['provider']) => {
    setProvider(newProvider);
    setModel(MODELS[newProvider][0].value);
    setKeyTouched(false);
  };

  const keyValid = validateKeyFormat(provider, apiKey);
  const keyError = keyTouched && apiKey.length > 0 && !keyValid;

  const canSave = apiKey.length > 0 && keyValid;

  const handleSave = () => {
    if (!canSave) return;
    const config: ModelConfig = { provider, apiKey, model };
    saveModelConfig(config);
    setSavedConfig(config);
    toast('Configuration saved', 'success');
  };

  const handleClear = () => {
    clearModelConfig();
    setProvider('anthropic');
    setApiKey('');
    setModel(MODELS.anthropic[0].value);
    setShowKey(false);
    setKeyTouched(false);
    setSavedConfig(null);
    toast('Configuration cleared', 'info');
  };

  /* Avoid hydration mismatch for localStorage-driven state */
  if (!mounted) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 page-enter">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <IconSettings size={28} className="text-accent" />
          <h1 className="text-2xl font-bold text-text">Model Configuration</h1>
        </div>
        <p className="text-text-secondary">
          Connect your AI model to test tools with a real agent.
        </p>
      </div>

      {/* Provider */}
      <div className="mb-8">
        <label htmlFor="provider" className="text-sm font-medium text-text-secondary mb-1.5 block">
          Provider
        </label>
        <select
          id="provider"
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as ModelConfig['provider'])}
          className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-text placeholder:text-text-dim appearance-none cursor-pointer focus:outline-none focus:border-accent transition-colors"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div className="mb-8">
        <label htmlFor="api-key" className="text-sm font-medium text-text-secondary mb-1.5 block">
          API Key
        </label>
        <div className="relative">
          <input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onBlur={() => setKeyTouched(true)}
            placeholder={PLACEHOLDERS[provider]}
            className={`w-full bg-elevated border rounded-lg px-4 py-3 pr-12 text-text placeholder:text-text-dim focus:outline-none transition-colors ${
              keyError
                ? 'border-red-500 focus:border-red-500'
                : keyTouched && keyValid
                  ? 'border-green-500 focus:border-green-500'
                  : 'border-border focus:border-accent'
            }`}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-text-dim hover:text-text transition-colors"
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? (
              /* Eye-off icon */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              /* Eye icon */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {keyError && (
          <p className="mt-1.5 text-sm text-red-400">
            Invalid API key format for {PROVIDER_LABELS[provider]}
          </p>
        )}
      </div>

      {/* Model */}
      <div className="mb-8">
        <label htmlFor="model" className="text-sm font-medium text-text-secondary mb-1.5 block">
          Model
        </label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-text placeholder:text-text-dim appearance-none cursor-pointer focus:outline-none focus:border-accent transition-colors"
        >
          {MODELS[provider].map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Security Notice */}
      <div className="mb-8 bg-elevated border border-border rounded-xl p-4 flex gap-3">
        <div className="mt-0.5 shrink-0 text-text-dim">
          {/* Lock icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          Your API key is stored locally in your browser and never sent to our servers.
          It is only used client-side to authenticate directly with the model provider during tool testing.
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!canSave}
        className={`w-full rounded-lg px-4 py-3 font-medium transition-colors ${
          canSave
            ? 'btn-gradient text-white cursor-pointer'
            : 'bg-elevated text-dim cursor-not-allowed'
        }`}
      >
        Save Configuration
      </button>

      {/* Status Section */}
      {savedConfig && (
        <div className="mt-8 border-t border-border pt-6">
          <div className="flex items-center gap-2 mb-3">
            <IconCheck size={18} className="text-green-400" />
            <span className="text-sm text-text">
              Model configured:{' '}
              <span className="font-medium text-accent">{savedConfig.model}</span> via{' '}
              <span className="font-medium">{PROVIDER_LABELS[savedConfig.provider]}</span>
            </span>
          </div>
          <button
            onClick={handleClear}
            className="text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            Clear configuration
          </button>
        </div>
      )}
    </div>
  );
}
