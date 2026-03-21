'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SCORING_ENGINE_URL } from '@/lib/contracts';
import { useToast } from '@/components/Toast';
import SubNav, { BUILDER_NAV } from '@/components/SubNav';
import { IconCheck } from '@/components/Icons';

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

interface FormState {
  toolName: string;
  description: string;
  category: string;
  serverUrl: string;
  inputSchema: string;
  testBudget: number;
}

function getValidationItems(form: FormState) {
  const items: { label: string; status: 'pass' | 'warn' | 'fail' }[] = [];

  items.push({
    label: 'Tool name provided',
    status: form.toolName.length > 0 ? 'pass' : 'fail',
  });
  items.push({
    label: 'Description (20+ chars)',
    status:
      form.description.length >= 20
        ? 'pass'
        : form.description.length > 0
        ? 'warn'
        : 'fail',
  });
  items.push({
    label: 'Category selected',
    status: form.category ? 'pass' : 'fail',
  });
  items.push({
    label: 'MCP Server URL',
    status: form.serverUrl.startsWith('http') ? 'pass' : form.serverUrl.length > 0 ? 'warn' : 'fail',
  });

  let schemaValid = false;
  try {
    if (form.inputSchema.trim()) {
      JSON.parse(form.inputSchema);
      schemaValid = true;
    }
  } catch {
    // invalid
  }
  items.push({
    label: 'Input schema (valid JSON)',
    status: schemaValid ? 'pass' : form.inputSchema.trim() ? 'warn' : 'fail',
  });
  items.push({
    label: 'Test budget set',
    status: form.testBudget > 0 ? 'pass' : 'fail',
  });

  return items;
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

export default function SubmitPage() {
  const [form, setForm] = useState<FormState>({
    toolName: '',
    description: '',
    category: '',
    serverUrl: '',
    inputSchema: '',
    testBudget: 0.25,
  });
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const update = useCallback(
    (field: keyof FormState, value: string | number) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const validationItems = getValidationItems(form);
  const allValid = validationItems.every((i) => i.status === 'pass');
  const passCount = validationItems.filter((i) => i.status === 'pass').length;
  const parsedParams = getParsedParams(form.inputSchema);

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

  return (
    <div className="p-6 lg:p-8 max-w-5xl animate-fade-in">
      <SubNav items={BUILDER_NAV} />

      {/* Header */}
      <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-2">Submit Your Tool</h1>
      <p className="text-text-secondary mb-8">
        Register an MCP tool for automated diagnosis and registry listing.
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Form */}
        <div className="flex-1 space-y-6">
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
              className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue transition-colors"
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
              className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder-text-dim text-sm focus:outline-none focus:border-blue transition-colors resize-none"
            />
            {form.description.length > 0 && form.description.length < 20 && (
              <p className="text-xs text-amber">{20 - form.description.length} more characters needed</p>
            )}
          </div>

          {/* Category + URL row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                <CheckMark filled={form.category.length > 0} />
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue transition-colors appearance-none cursor-pointer"
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
            </div>

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
                className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue transition-colors"
              />
            </div>
          </div>

          {/* Input Schema */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <CheckMark
                filled={(() => {
                  try {
                    return form.inputSchema.trim() ? !!JSON.parse(form.inputSchema) : false;
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
              className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue transition-colors resize-none"
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
              <input
                type="range"
                min="0.10"
                max="1.00"
                step="0.05"
                value={form.testBudget}
                onChange={(e) => update('testBudget', parseFloat(e.target.value))}
                className="flex-1 accent-blue"
              />
              <div className="bg-elevated border border-border rounded-lg px-4 py-2 font-mono text-sm min-w-[80px] text-center">
                ${form.testBudget.toFixed(2)}
              </div>
            </div>
            <p className="text-text-dim text-xs">
              $0.10 - $1.00. Higher budget enables deeper analysis.
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!allValid || submitting}
            className={`btn-gradient px-8 py-3 rounded-xl text-sm font-semibold transition-all ${
              !allValid || submitting ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? 'Submitting...' : 'Submit for Diagnosis'}
          </button>
        </div>

        {/* Sidebar: Validation + Params */}
        <div className="w-full lg:w-80 shrink-0 space-y-5">
          {/* Validation Checklist */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Validation
              </h3>
              <span className="text-xs font-mono text-text-dim">
                {passCount}/{validationItems.length}
              </span>
            </div>
            {validationItems.map((item, i) => (
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

          {/* Parsed Params */}
          {parsedParams.length > 0 && (
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
