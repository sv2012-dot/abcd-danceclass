'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import SmartModal from './SmartModal';
import SmartButton from './SmartButton';
import { smart, type SmartPlanTodo } from '@/lib/api/smart';
import { recitals as recitalsApi } from '@/lib/api';

function friendlyError(e: any): string {
  if (e?.message?.includes('429') || e?.error === 'rate_limit_exceeded' || e?.status === 429) {
    return "You've hit today's Smart ManchQ limit (30/day). Resets in ~24h.";
  }
  return e?.error || e?.detail || e?.message || 'Smart ManchQ ran into a hiccup. Try again.';
}

type Props = {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  recitalId: number;
  recitalTitle?: string;
  recitalDate?: string;
  onCreated?: () => void;
};

const CATEGORY_COLOR: Record<string, string> = {
  Venue: '#7C3AED',
  Costumes: '#DC4EFF',
  Music: '#0EA5E9',
  Communications: '#10B981',
  Rehearsal: '#F59E0B',
  Tech: '#6366F1',
  'Day-of': '#EF4444',
  Other: '#9CA3AF',
};

type Row = SmartPlanTodo & { _selected: boolean; _editText: string };

export default function SmartPlanModal({ open, onClose, schoolId, recitalId, recitalTitle, recitalDate, onCreated }: Props) {
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setRows([]);
    setSummary('');
    setError(null);
  };

  const handleClose = () => {
    if (creating || generating) return;
    reset();
    onClose();
  };

  const doGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await smart.generateRecitalPlan(recitalId);
      if (!res.todos || res.todos.length === 0) {
        setError('No todos generated. Try again or add manually below.');
        return;
      }
      setRows(res.todos.map((t) => ({ ...t, _selected: true, _editText: t.task_text })));
      setSummary(res.summary || '');
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setGenerating(false);
    }
  };

  const doCreate = async () => {
    const selected = rows.filter((r) => r._selected && r._editText.trim());
    if (selected.length === 0) {
      toast.error('Nothing selected');
      return;
    }
    setCreating(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const r of selected) {
        try {
          await recitalsApi.addTask(schoolId, String(recitalId), r._editText.trim());
          ok++;
        } catch {
          failed++;
        }
      }
      if (ok > 0) toast.success(`Added ${ok} todo${ok > 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}`);
      if (ok > 0 && failed === 0) {
        onCreated?.();
        reset();
        onClose();
      }
    } finally {
      setCreating(false);
    }
  };

  const selectedCount = rows.filter((r) => r._selected).length;

  return (
    <SmartModal
      open={open}
      onClose={handleClose}
      title="Smart Plan"
      subtitle={recitalTitle ? `Generate a tailored countdown plan for "${recitalTitle}".` : 'Generate a tailored countdown plan for this recital.'}
      maxWidth={720}
      footer={
        rows.length > 0 ? (
          <>
            <button
              onClick={handleClose}
              disabled={creating}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <SmartButton onClick={doCreate} loading={creating} disabled={selectedCount === 0} size="md">
              {creating ? 'Adding…' : `Add ${selectedCount} todo${selectedCount !== 1 ? 's' : ''}`}
            </SmartButton>
          </>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <>
          {error && (
            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#DC2626', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
            ManchQ will read your recital details (date, venue, dance style, participants) and propose a complete weekly countdown checklist — venue booking, costume orders, rehearsal milestones, day-of prep, and more.
          </p>
          {recitalDate && (
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, fontSize: 12 }}>
              <strong>Event date:</strong> {recitalDate}
            </div>
          )}
          <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
            <SmartButton onClick={doGenerate} loading={generating} size="md">
              {generating ? 'Thinking…' : error ? 'Try again' : 'Generate Plan'}
            </SmartButton>
          </div>
        </>
      ) : (
        <>
          {summary && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.5, fontStyle: 'italic' }}>{summary}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map((r, i) => {
              const color = CATEGORY_COLOR[r.category] || '#9CA3AF';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    background: r._selected ? 'var(--card)' : 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    opacity: r._selected ? 1 : 0.55,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={r._selected}
                    onChange={(e) =>
                      setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _selected: e.target.checked } : row)))
                    }
                    style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <input
                    type="text"
                    value={r._editText}
                    onChange={(e) =>
                      setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _editText: e.target.value } : row)))
                    }
                    style={{ flex: 1, padding: '6px 8px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                  />
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 12, background: color + '22', color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {r.category}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 70, textAlign: 'right' }}>
                    {r.days_before_event === 0 ? 'Day-of' : `${r.days_before_event}d before`}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setRows([])}
            disabled={creating}
            style={{ marginTop: 12, fontSize: 12, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            ← regenerate
          </button>
        </>
      )}
    </SmartModal>
  );
}
