'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SCORING_ENGINE_URL } from '@/lib/contracts';

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

function CheckMark({ filled }: { filled: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs transition-all duration-300 ${
        filled
          ? 'bg-green-dim text-green'
          : 'bg-elevated text-text-dim'
      }`}
    >
      {filled ? '\u2713' : '\u00B7'}
    </span>
  );
}

function syntaxHighlightJSON(json: string): string {
  return json
    .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span style="color:#9B8EC8">$1</span>:')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span style="color:#18DC7E">$1</span>')
    .replace(/:\s*(\d+)/g, ': <span style="color:#F5A623">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span style="color:#5B7FFF">$1</span>')
    .replace(/[{}[\]]/g, '<span style="color:#6B6590">$&</span>');
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

export default function SubmitPage() {
  const [mode, setMode] = useState<'simple' | 'editor'>('simple');
  const [form, setForm] = useState<FormState>({
    toolName: '',
    description: '',
    category: '',
    serverUrl: '',
    inputSchema: '',
    testBudget: 0.25,
  });
  const [submitted, setSubmitted] = useState(false);

  const update = useCallback(
    (field: keyof FormState, value: string | number) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const validationItems = getValidationItems(form);
  const allValid = validationItems.every((i) => i.status === 'pass');
  const parsedParams = getParsedParams(form.inputSchema);

  const editorContent = form.inputSchema || PLACEHOLDER_SCHEMA;
  const editorLines = editorContent.split('\n');

  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

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
        router.push(`/builder/report?id=${data.reportId}`);
      } else {
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
      }
    } catch {
      // Fallback to mock report if scoring engine not reachable
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        router.push('/builder/report');
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = (s: 'pass' | 'warn' | 'fail') => {
    if (s === 'pass') return <span className="text-green">{'\u2705'}</span>;
    if (s === 'warn') return <span className="text-amber">{'\u26A0\uFE0F'}</span>;
    return <span className="text-red">{'\u274C'}</span>;
  };

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <h1 className="text-3xl font-bold gradient-text mb-2">Submit Your Tool</h1>
      <p className="text-text-secondary mb-8">
        Register your MCP tool for automated diagnosis, scoring, and registry listing.
      </p>

      {/* Mode Toggle */}
      <div className="inline-flex bg-elevated rounded-xl p-1 mb-8 border border-border">
        <button
          onClick={() => setMode('simple')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'simple'
              ? 'bg-surface text-white shadow-md border border-border-hi'
              : 'text-text-secondary hover:text-white'
          }`}
        >
          Simple
        </button>
        <button
          onClick={() => setMode('editor')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'editor'
              ? 'bg-surface text-white shadow-md border border-border-hi'
              : 'text-text-secondary hover:text-white'
          }`}
        >
          Editor
        </button>
      </div>

      {/* Success Toast */}
      {submitted && (
        <div className="fixed top-6 right-6 bg-green-dim border border-green/30 text-green px-6 py-3 rounded-xl text-sm font-medium z-50 animate-pulse">
          Tool submitted for diagnosis!
        </div>
      )}

      {mode === 'simple' ? (
        /* ---- SIMPLE MODE ---- */
        <div className="space-y-6">
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
          </div>

          {/* Category */}
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
                Select a category...
              </option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-elevated">
                  {cat}
                </option>
              ))}
            </select>
          </div>

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
              className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue transition-colors"
            />
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
              <div className="bg-elevated border border-border rounded-lg px-4 py-2 font-mono text-sm min-w-[100px] text-center">
                ${form.testBudget.toFixed(2)}
              </div>
            </div>
            <p className="text-text-dim text-xs">
              Budget per diagnosis task ($0.10 - $1.00). Higher budget enables deeper analysis.
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!allValid}
            className={`btn-gradient px-8 py-3 rounded-xl text-sm font-semibold transition-all ${
              !allValid ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            Submit for Diagnosis
          </button>
        </div>
      ) : (
        /* ---- EDITOR MODE ---- */
        <div className="flex gap-6 min-h-[600px]">
          {/* Left: Code Editor */}
          <div className="w-[55%] bg-[#0A0820] border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
              <span className="w-3 h-3 rounded-full bg-red/60" />
              <span className="w-3 h-3 rounded-full bg-amber/60" />
              <span className="w-3 h-3 rounded-full bg-green/60" />
              <span className="ml-3 text-text-dim text-xs font-mono">input-schema.json</span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="flex font-mono text-sm">
                <div className="select-none text-text-dim pr-4 text-right min-w-[40px]">
                  {editorLines.map((_, i) => (
                    <div key={i} className="leading-6">
                      {i + 1}
                    </div>
                  ))}
                </div>
                <textarea
                  value={form.inputSchema}
                  onChange={(e) => update('inputSchema', e.target.value)}
                  placeholder={PLACEHOLDER_SCHEMA}
                  className="flex-1 bg-transparent text-white leading-6 resize-none focus:outline-none placeholder-text-dim"
                  style={{ minHeight: editorLines.length * 24 + 100 }}
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          {/* Right: Validation Panel */}
          <div className="w-[45%] space-y-6">
            {/* Quick Fields */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Tool Details
              </h3>
              <input
                type="text"
                value={form.toolName}
                onChange={(e) => update('toolName', e.target.value)}
                placeholder="Tool Name"
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue"
              />
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Description..."
                rows={2}
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-white placeholder-text-dim text-sm focus:outline-none focus:border-blue resize-none"
              />
              <div className="flex gap-3">
                <select
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                  className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue appearance-none"
                >
                  <option value="">Category...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={form.serverUrl}
                  onChange={(e) => update('serverUrl', e.target.value)}
                  placeholder="Server URL"
                  className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue"
                />
              </div>
            </div>

            {/* Validation Checklist */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Validation
              </h3>
              {validationItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  {statusIcon(item.status)}
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
              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
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

            {/* Budget + Submit */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.10"
                  max="1.00"
                  step="0.05"
                  value={form.testBudget}
                  onChange={(e) => update('testBudget', parseFloat(e.target.value))}
                  className="flex-1 accent-blue"
                />
                <span className="font-mono text-sm text-white min-w-[60px] text-right">
                  ${form.testBudget.toFixed(2)}
                </span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!allValid}
                className={`w-full btn-gradient px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                  !allValid ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                Submit for Diagnosis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
