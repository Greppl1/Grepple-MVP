export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google';
  apiKey: string;
  model: string;
}

export const PROVIDERS = [
  { id: 'anthropic' as const, label: 'Anthropic (Claude)', prefix: 'sk-ant-' },
  { id: 'openai' as const, label: 'OpenAI (GPT)', prefix: 'sk-' },
  { id: 'google' as const, label: 'Google (Gemini)', prefix: 'AI' },
];

export const MODELS: Record<string, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-5-20250514', label: 'Claude Opus 4.5' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  google: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
};

const CONFIG_KEY = 'grepple_model_config';

export function saveModelConfig(config: ModelConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadModelConfig(): ModelConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearModelConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONFIG_KEY);
}

export function isModelConfigured(): boolean {
  return loadModelConfig() !== null;
}

export function validateApiKey(provider: string, key: string): boolean {
  const p = PROVIDERS.find(p => p.id === provider);
  if (!p) return false;
  return key.startsWith(p.prefix) && key.length > p.prefix.length + 10;
}

export function getProviderLabel(provider: string): string {
  return PROVIDERS.find(p => p.id === provider)?.label ?? provider;
}
