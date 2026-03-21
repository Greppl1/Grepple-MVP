'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SCORING_ENGINE_URL } from '@/lib/contracts';
import { useToast } from '@/components/Toast';
import { IconCheck, IconX } from '@/components/Icons';

const CATEGORIES = ['Search', 'DeFi', 'DevTools', 'Database', 'AI', 'Data', 'Communication', 'Cloud', 'Productivity'];

const BUDGET_OPTIONS = [
  { value: '0.10', label: '$0.10' },
  { value: '0.25', label: '$0.25' },
  { value: '0.50', label: '$0.50' },
  { value: '1.00', label: '$1.00' },
];

const PLACEHOLDER_SCHEMA = `{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query"
    }
  },
  "required": ["query"]
}`;

const DRAFT_KEY = 'grepple_submit_draft';

interface FormData {
  toolName: string;
  description: string;
  category: string;
  serverUrl: string;
  inputSchema: string;
  testBudget: string;
}

const EMPTY_FORM: FormData = {
  toolName: '',
  description: '',
  category: '',
  serverUrl: '',
  inputSchema: '',
  testBudget: '0.25',
};

function validate(form: FormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.toolName.trim()) {
    errors.toolName = 'Tool name is required';
  }

  if (!form.description.trim()) {
    errors.description = 'Description is required';
  } else if (form.description.trim().length < 20) {
    errors.description = 'Add more detail so agents can understand your tool';
  }

  if (!form.category) {
    errors.category = 'Choose a category';
  }

  if (!form.serverUrl.trim()) {
    errors.serverUrl = 'Server URL is required';
  } else if (!/^https?:\/\//.test(form.serverUrl.trim())) {
    errors.serverUrl = 'Enter a valid URL starting with https://';
  }

  if (form.inputSchema.trim()) {
    try {
      JSON.parse(form.inputSchema);
    } catch {
      errors.inputSchema = 'Invalid JSON — check your syntax';
    }
  }

  return errors;
}

function getSchemaInfo(schema: string): { valid: boolean; keyCount: number } | null {
  const trimmed = schema.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [];
    return { valid: true, keyCount: keys.length };
  } catch {
    return { valid: false, keyCount: 0 };
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error flex items-center gap-1.5 mt-1.5 text-sm text-red">
      <IconX size={14} className="shrink-0" />
      {message}
    </p>
  );
}

function FieldSuccess({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 mt-1.5 text-sm text-green">
      <IconCheck size={14} className="shrink-0" />
      {message}
    </p>
  );
}

export default function SubmitPage() {
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Load draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormData>;
        setFormData((prev) => ({ ...prev, ...parsed }));
        toast('Draft restored from previous session', 'info');
      }
    } catch { /* ignore corrupt data */ }
    setDraftLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft (debounced 1s)
  useEffect(() => {
    if (!draftLoaded) return;
    const hasContent = formData.toolName || formData.description || formData.serverUrl || formData.inputSchema;
    if (!hasContent) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    }, 1000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [formData, draftLoaded]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setFormData(EMPTY_FORM);
    setTouched({});
    toast('Draft cleared', 'info');
  };

  const update = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const errors = validate(formData);
  const isFormValid = Object.keys(errors).length === 0;
  const schemaInfo = getSchemaInfo(formData.inputSchema);

  const showError = (field: string) => touched[field] ? errors[field] : undefined;

  const inputClass = (field: string) => {
    if (!touched[field]) return 'border-border';
    if (errors[field]) return 'input-error border-red/60 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]';
    return 'input-success border-green/50';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Touch all fields to show any remaining errors
    const allFields = ['toolName', 'description', 'category', 'serverUrl', 'inputSchema'];
    const allTouched = allFields.reduce((acc, f) => ({ ...acc, [f]: true }), {});
    setTouched(allTouched);

    if (!isFormValid) return;

    setSubmitting(true);
    try {
      let schema = {};
      try { schema = JSON.parse(formData.inputSchema); } catch { /* empty schema */ }

      const res = await fetch(`${SCORING_ENGINE_URL}/api/v1/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.toolName,
          description: formData.description,
          inputSchema: schema,
          serverUrl: formData.serverUrl,
          category: formData.category,
          runLlmTest: true,
        }),
      });

      localStorage.removeItem(DRAFT_KEY);

      if (res.ok) {
        const data = await res.json();
        toast('Tool submitted! Redirecting to report...', 'success');
        router.push(`/builder/report?id=${data.reportId}&name=${encodeURIComponent(formData.toolName)}`);
      } else {
        toast('Submission received. Generating report...', 'info');
        setTimeout(() => {
          router.push(`/builder/report?name=${encodeURIComponent(formData.toolName)}`);
        }, 1000);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      toast('Scoring engine unavailable. Using demo report.', 'info');
      setTimeout(() => {
        router.push(`/builder/report?name=${encodeURIComponent(formData.toolName)}`);
      }, 1000);
    } finally {
      setSubmitting(false);
    }
  };

  const hasDraft = formData.toolName || formData.description || formData.serverUrl || formData.inputSchema;

  return (
    <div className="p-6 lg:p-8 page-enter">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-text mb-2">Submit a Tool</h1>
          <p className="text-text-secondary">
            We&apos;ll run automated diagnostics and score your tool for the registry.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* Section 1: Tool Details */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-text mb-4">Tool Details</h2>
            <div className="space-y-5">

              {/* Tool Name */}
              <div>
                <label htmlFor="toolName" className="text-sm font-medium text-text-secondary mb-1.5 block">
                  Tool Name <span className="text-red">*</span>
                </label>
                <div className="relative">
                  <input
                    id="toolName"
                    type="text"
                    value={formData.toolName}
                    onChange={(e) => update('toolName', e.target.value)}
                    onBlur={() => handleBlur('toolName')}
                    placeholder="mcp-my-tool"
                    className={`w-full bg-elevated border ${inputClass('toolName')} rounded-lg px-4 py-3 text-text placeholder:text-text-dim focus:border-blue focus:ring-0 transition-colors`}
                  />
                  {touched.toolName && !errors.toolName && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green">
                      <IconCheck size={18} />
                    </span>
                  )}
                </div>
                <FieldError message={showError('toolName')} />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="text-sm font-medium text-text-secondary mb-1.5 block">
                  Description <span className="text-red">*</span>
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) update('description', e.target.value);
                  }}
                  onBlur={() => handleBlur('description')}
                  placeholder="Describe what your tool does, its capabilities, and expected inputs/outputs..."
                  rows={3}
                  className={`w-full bg-elevated border ${inputClass('description')} rounded-lg px-4 py-3 text-text placeholder:text-text-dim focus:border-blue focus:ring-0 transition-colors resize-none`}
                />
                <div className="flex items-center justify-between mt-1.5">
                  <div>
                    <FieldError message={showError('description')} />
                  </div>
                  <span className={`text-xs tabular-nums ${formData.description.length >= 480 ? 'text-amber' : 'text-text-dim'}`}>
                    {formData.description.length}/500
                  </span>
                </div>
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="text-sm font-medium text-text-secondary mb-1.5 block">
                  Category <span className="text-red">*</span>
                </label>
                <div className="relative">
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => { update('category', e.target.value); setTouched((p) => ({ ...p, category: true })); }}
                    onBlur={() => handleBlur('category')}
                    className={`w-full bg-elevated border ${inputClass('category')} rounded-lg px-4 py-3 text-text text-sm focus:border-blue focus:ring-0 transition-colors appearance-none cursor-pointer ${!formData.category ? 'text-text-dim' : ''}`}
                  >
                    <option value="" className="bg-elevated text-text-dim">Select a category...</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-elevated text-text">{cat}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <FieldError message={showError('category')} />
              </div>
            </div>
          </section>

          {/* Section 2: Configuration */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-text mb-4">Configuration</h2>
            <div className="space-y-5">

              {/* Server URL */}
              <div>
                <label htmlFor="serverUrl" className="text-sm font-medium text-text-secondary mb-1.5 block">
                  Server URL <span className="text-red">*</span>
                </label>
                <div className="relative">
                  <input
                    id="serverUrl"
                    type="url"
                    value={formData.serverUrl}
                    onChange={(e) => update('serverUrl', e.target.value)}
                    onBlur={() => handleBlur('serverUrl')}
                    placeholder="https://your-mcp-server.com/api"
                    className={`w-full bg-elevated border ${inputClass('serverUrl')} rounded-lg px-4 py-3 text-text placeholder:text-text-dim focus:border-blue focus:ring-0 transition-colors`}
                  />
                  {touched.serverUrl && !errors.serverUrl && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green">
                      <IconCheck size={18} />
                    </span>
                  )}
                </div>
                <FieldError message={showError('serverUrl')} />
              </div>

              {/* Input Schema */}
              <div>
                <label htmlFor="inputSchema" className="text-sm font-medium text-text-secondary mb-1.5 block">
                  Input Schema <span className="text-text-dim font-normal">(optional)</span>
                </label>
                <textarea
                  id="inputSchema"
                  value={formData.inputSchema}
                  onChange={(e) => update('inputSchema', e.target.value)}
                  onBlur={() => handleBlur('inputSchema')}
                  placeholder={PLACEHOLDER_SCHEMA}
                  className={`w-full bg-elevated border ${inputClass('inputSchema')} rounded-lg px-4 py-3 text-text placeholder:text-text-dim focus:border-blue focus:ring-0 transition-colors resize-none font-mono text-sm`}
                  style={{ minHeight: '150px' }}
                  spellCheck={false}
                />
                {touched.inputSchema && errors.inputSchema && (
                  <FieldError message={errors.inputSchema} />
                )}
                {touched.inputSchema && schemaInfo?.valid && (
                  <FieldSuccess message={`Valid JSON \u00b7 ${schemaInfo.keyCount} parameter${schemaInfo.keyCount !== 1 ? 's' : ''} detected`} />
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Testing Budget */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-text mb-4">Testing Budget</h2>
            <div>
              <label htmlFor="testBudget" className="text-sm font-medium text-text-secondary mb-1.5 block">
                Budget per test
              </label>
              <div className="relative">
                <select
                  id="testBudget"
                  value={formData.testBudget}
                  onChange={(e) => update('testBudget', e.target.value)}
                  className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-text text-sm focus:border-blue focus:ring-0 transition-colors appearance-none cursor-pointer"
                >
                  {BUDGET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-elevated">{opt.label}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <p className="text-text-dim text-xs mt-1.5">
                Maximum cost per diagnostic run. You won&apos;t be charged on testnet.
              </p>
            </div>
          </section>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isFormValid || submitting}
            className="btn-gradient w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
                </svg>
                Running Diagnostics...
              </>
            ) : (
              'Run Diagnostics'
            )}
          </button>

          {/* Clear draft */}
          {hasDraft && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={clearDraft}
                className="text-xs text-text-dim hover:text-amber transition-colors"
              >
                Clear draft
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
