'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SCORING_ENGINE_URL } from '@/lib/contracts';
import { useToast } from '@/components/Toast';
import { IconCheck, IconArrowRight, IconChevronLeft } from '@/components/Icons';

const CATEGORIES = ['Search', 'DeFi', 'DevTools', 'Database', 'AI', 'Data', 'Communication'];

const PLACEHOLDER_SCHEMA = `{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query"
    },
    "limit": {
      "type": "number",
      "description": "Max results to return",
      "default": 10
    }
  },
  "required": ["query"]
}`;

const STEP_LABELS = ['Basics', 'Configuration', 'Review & Submit'] as const;

interface FormState {
  toolName: string;
  description: string;
  category: string;
  serverUrl: string;
  inputSchema: string;
  testBudget: number;
}

type ValidationItem = { label: string; status: 'pass' | 'warn' | 'fail' };

function getStep1Validation(form: FormState): ValidationItem[] {
  return [
    {
      label: 'Tool name provided',
      status: form.toolName.length > 0 ? 'pass' : 'fail',
    },
    {
      label: 'Description (20+ chars)',
      status:
        form.description.length >= 20
          ? 'pass'
          : form.description.length > 0
          ? 'warn'
          : 'fail',
    },
    {
      label: 'Category selected',
      status: form.category ? 'pass' : 'fail',
    },
  ];
}

function getStep2Validation(form: FormState): ValidationItem[] {
  let schemaValid = false;
  const schemaEmpty = !form.inputSchema.trim();
  try {
    if (!schemaEmpty) {
      JSON.parse(form.inputSchema);
      schemaValid = true;
    }
  } catch {
    // invalid
  }

  return [
    {
      label: 'MCP Server URL',
      status: form.serverUrl.startsWith('http') ? 'pass' : form.serverUrl.length > 0 ? 'warn' : 'fail',
    },
    {
      label: 'Input schema (valid JSON)',
      status: schemaValid ? 'pass' : schemaEmpty ? 'pass' : 'warn',
    },
    {
      label: 'Test budget set',
      status: form.testBudget > 0 ? 'pass' : 'fail',
    },
  ];
}

function isStep1Valid(form: FormState): boolean {
  return form.toolName.length > 0 && form.description.length >= 20 && form.category.length > 0;
}

function isStep2Valid(form: FormState): boolean {
  if (!form.serverUrl.startsWith('http')) return false;
  if (form.inputSchema.trim()) {
    try {
      JSON.parse(form.inputSchema);
    } catch {
      return false;
    }
  }
  return true;
}

function getParsedParams(schema: string) {
  try {
    const parsed = JSON.parse(schema);
    const props = parsed.properties || {};
    const required = parsed.required || [];
    return Object.entries(props).map(([key, val]: [string, unknown]) => {
      const v = val as Record<string, unknown>;
      return {
        name: key,
        type: (v.type as string) || 'unknown',
        required: required.includes(key),
        description: (v.description as string) || '',
      };
    });
  } catch {
    return [];
  }
}

function CheckMark({ filled }: { filled: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs transition-all duration-300 ${
        filled
          ? 'bg-green-dim text-green'
          : 'bg-elevated text-text-dim'
      }`}
    >
      {filled ? <IconCheck size={12} /> : <span className="w-1 h-1 rounded-full bg-text-dim" />}
    </span>
  );
}

function StatusDot({ status }: { status: 'pass' | 'warn' | 'fail' }) {
  const classes = {
    pass: 'bg-green',
    warn: 'bg-amber',
    fail: 'bg-red/40',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${classes[status]}`} />;
}

/* ── Step Indicator ────────────────────────────────────────── */

function StepIndicator({
  current,
  step1Done,
  step2Done,
}: {
  current: number;
  step1Done: boolean;
  step2Done: boolean;
}) {
  const stepStatus = (idx: number): 'active' | 'completed' | 'future' => {
    if (idx === current) return 'active';
    if (idx === 0 && step1Done) return 'completed';
    if (idx === 1 && step2Done) return 'completed';
    if (idx < current) return 'completed';
    return 'future';
  };

  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_LABELS.map((label, idx) => {
        const status = stepStatus(idx);
        const circleClass =
          status === 'active'
            ? 'bg-blue border-blue text-white'
            : status === 'completed'
            ? 'bg-green-dim border-green text-green'
            : 'bg-elevated border-border text-text-dim';
        const labelClass =
          status === 'active'
            ? 'text-white'
            : status === 'completed'
            ? 'text-green'
            : 'text-text-dim';

        return (
          <div key={idx} className="flex items-center">
            {idx > 0 && (
              <div
                className={`w-12 sm:w-20 h-px ${
                  idx <= current || (idx === 1 && step1Done) || (idx === 2 && step2Done)
                    ? 'bg-blue'
                    : 'bg-border'
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all duration-300 ${circleClass}`}
              >
                {status === 'completed' ? <IconCheck size={16} /> : idx + 1}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${labelClass}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function SubmitPage() {
  const [form, setForm] = useState<FormState>({
    toolName: '',
    description: '',
    category: '',
    serverUrl: '',
    inputSchema: '',
    testBudget: 0.25,
  });
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const update = useCallback(
    (field: keyof FormState, value: string | number) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const s1Valid = isStep1Valid(form);
  const s2Valid = isStep2Valid(form);
  const allValid = s1Valid && s2Valid;
  const parsedParams = getParsedParams(form.inputSchema);

  const currentStepValid = step === 0 ? s1Valid : step === 1 ? s2Valid : allValid;

  const validationItemsForStep =
    step === 0
      ? getStep1Validation(form)
      : step === 1
      ? getStep2Validation(form)
      : [...getStep1Validation(form), ...getStep2Validation(form)];

  const passCount = validationItemsForStep.filter((i) => i.status === 'pass').length;

  const handleSubmit = async () => {
    if (!allValid) return;
    setSubmitting(true);
    try {
      let schema = {};
      try { schema = JSON.parse(form.inputSchema); } catch { /* use empty */ }

      const res = await fetch(`${SCORING_ENGINE_URL}/api/v1/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.toolName,
          description: form.description,
          inputSchema: schema,
          serverUrl: form.serverUrl,
          category: form.category,
          runLlmTest: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast('Tool submitted! Redirecting to report...', 'success');
        router.push(`/builder/report?id=${data.reportId}&name=${encodeURIComponent(form.toolName)}`);
      } else {
        toast('Submission received. Generating mock report...', 'info');
        setTimeout(() => {
          router.push(`/builder/report?name=${encodeURIComponent(form.toolName)}`);
        }, 1000);
      }
    } catch {
      toast('Scoring engine unavailable. Using mock report.', 'info');
      setTimeout(() => {
        router.push(`/builder/report?name=${encodeURIComponent(form.toolName)}`);
      }, 1000);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Step Content Renderers ──────────────────────────────── */

  const renderStep1 = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Tool Name */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <CheckMark filled={form.toolName.length > 0} />
          Tool Name
        </label>
        <input
          type="text"
          value={form.toolName}
          onChange={(e) => update('toolName', e.target.value)}
          placeholder="mcp-my-tool"
          className={`w-full bg-elevated border ${form.toolName.length > 0 ? 'border-green/30' : 'border-border'} rounded-lg px-4 py-3 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue transition-colors`}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <CheckMark filled={form.description.length >= 20} />
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Describe what your tool does, its capabilities, and expected inputs/outputs..."
          rows={3}
          className={`w-full bg-elevated border ${form.description.length >= 20 ? 'border-green/30' : form.description.length > 0 ? 'border-amber/50' : 'border-border'} rounded-lg px-4 py-3 text-white placeholder-text-dim text-sm focus:outline-none focus:border-blue transition-colors resize-none`}
        />
        {form.description.length > 0 && form.description.length < 20 && (
          <p className="text-xs text-amber">{20 - form.description.length} more characters needed</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <CheckMark filled={form.category.length > 0} />
          Category
        </label>
        <div className="relative">
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            className={`w-full bg-elevated border ${form.category.length > 0 ? 'border-green/30' : 'border-border'} rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue transition-colors appearance-none cursor-pointer`}
          >
            <option value="" className="bg-elevated text-text-dim">
              Select...
            </option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-elevated">
                {cat}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-fade-in">
      {/* MCP Server URL */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <CheckMark filled={form.serverUrl.startsWith('http')} />
          MCP Server URL
        </label>
        <input
          type="url"
          value={form.serverUrl}
          onChange={(e) => update('serverUrl', e.target.value)}
          placeholder="https://mcp.example.com/v1"
          className={`w-full bg-elevated border ${form.serverUrl.startsWith('http') ? 'border-green/30' : form.serverUrl.length > 0 ? 'border-amber/50' : 'border-border'} rounded-lg px-4 py-3 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue transition-colors`}
        />
      </div>

      {/* Input Schema */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <CheckMark
            filled={(() => {
              try {
                return form.inputSchema.trim() ? !!JSON.parse(form.inputSchema) : true;
              } catch {
                return false;
              }
            })()}
          />
          Input Schema (JSON)
        </label>
        <textarea
          value={form.inputSchema}
          onChange={(e) => update('inputSchema', e.target.value)}
          placeholder={PLACEHOLDER_SCHEMA}
          rows={10}
          className={`w-full bg-elevated border ${form.inputSchema.trim() ? (() => { try { JSON.parse(form.inputSchema); return 'border-green/30'; } catch { return 'border-amber/50'; } })() : 'border-border'} rounded-lg px-4 py-3 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue transition-colors resize-none`}
          spellCheck={false}
        />
      </div>

      {/* Test Budget */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <CheckMark filled={form.testBudget > 0} />
          Test Budget per Task
        </label>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <input
              type="range"
              min="0.10"
              max="1.00"
              step="0.05"
              value={form.testBudget}
              onChange={(e) => update('testBudget', parseFloat(e.target.value))}
              className="w-full accent-blue relative z-10"
              style={{ background: `linear-gradient(to right, #4A6CF7 ${((form.testBudget - 0.1) / 0.9) * 100}%, #2D2855 ${((form.testBudget - 0.1) / 0.9) * 100}%)`, borderRadius: '4px', height: '4px' }}
            />
          </div>
          <div className="bg-elevated border border-border rounded-lg px-4 py-2 font-mono text-sm min-w-[80px] text-center">
            ${form.testBudget.toFixed(2)}
          </div>
        </div>
        <p className="text-text-dim text-xs">
          $0.10 - $1.00. Higher budget enables deeper analysis.
        </p>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-lg font-semibold text-white">Review Your Submission</h3>

      {/* Summary Card */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Tool Name</p>
            <p className="text-sm font-mono text-lavender">{form.toolName || '---'}</p>
          </div>
          <div>
            <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Category</p>
            <p className="text-sm text-white">{form.category || '---'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-text-secondary">{form.description || '---'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Server URL</p>
            <p className="text-sm font-mono text-lavender break-all">{form.serverUrl || '---'}</p>
          </div>
          <div>
            <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Test Budget</p>
            <p className="text-sm font-mono text-white">${form.testBudget.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Schema</p>
            <p className="text-sm text-text-secondary">
              {form.inputSchema.trim()
                ? `${parsedParams.length} parameter${parsedParams.length !== 1 ? 's' : ''} defined`
                : 'No schema provided'}
            </p>
          </div>
        </div>
      </div>

      {/* Validation Checklist */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          Validation Checklist
        </h4>
        {[...getStep1Validation(form), ...getStep2Validation(form)].map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <StatusDot status={item.status} />
            <span
              className={
                item.status === 'pass'
                  ? 'text-white'
                  : item.status === 'warn'
                  ? 'text-amber'
                  : 'text-text-dim'
              }
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Parsed Params Preview */}
      {parsedParams.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3 animate-slide-up">
          <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Parsed Parameters
          </h4>
          {parsedParams.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between bg-elevated rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-lavender">{p.name}</span>
                {p.required && (
                  <span className="text-[10px] bg-red-dim text-red px-1.5 py-0.5 rounded font-medium">
                    required
                  </span>
                )}
              </div>
              <span className="text-text-dim text-xs font-mono">{p.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="p-6 lg:p-8 max-w-5xl animate-fade-in">
      {/* Header */}
      <h1 className="text-2xl sm:text-3xl font-bold text-blue-bright mb-2">Submit Your Tool</h1>
      <p className="text-text-secondary mb-8">
        Register an MCP tool for automated diagnosis and registry listing.
      </p>

      {/* Step Indicator */}
      <StepIndicator current={step} step1Done={s1Valid} step2Done={s2Valid} />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Form Area */}
        <div className="flex-1">
          {step === 0 && renderStep1()}
          {step === 1 && renderStep2()}
          {step === 2 && renderStep3()}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="btn-secondary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                <IconChevronLeft size={16} />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 2 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!currentStepValid}
                className={`btn-gradient flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                  !currentStepValid ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                Next
                <IconArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!allValid || submitting}
                className={`btn-gradient flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                  !allValid || submitting ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
                    </svg>
                    Submitting...
                  </span>
                ) : 'Submit for Diagnosis'}
              </button>
            )}
          </div>
        </div>

        {/* Sidebar: Validation + Params (desktop only) */}
        <div className="hidden lg:block w-80 shrink-0 space-y-5">
          {/* Validation Checklist for current step */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Validation
              </h3>
              <span className="text-xs font-mono text-text-dim">
                {passCount}/{validationItemsForStep.length}
              </span>
            </div>
            {validationItemsForStep.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <StatusDot status={item.status} />
                <span
                  className={
                    item.status === 'pass'
                      ? 'text-white'
                      : item.status === 'warn'
                      ? 'text-amber'
                      : 'text-text-dim'
                  }
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Parsed Params — only on step 2 when schema is entered */}
          {step === 1 && parsedParams.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5 space-y-3 animate-slide-up">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Parsed Parameters
              </h3>
              {parsedParams.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between bg-elevated rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-lavender">{p.name}</span>
                    {p.required && (
                      <span className="text-[10px] bg-red-dim text-red px-1.5 py-0.5 rounded font-medium">
                        required
                      </span>
                    )}
                  </div>
                  <span className="text-text-dim text-xs font-mono">{p.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
