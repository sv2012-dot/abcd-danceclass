'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import SmartModal from './SmartModal';
import SmartButton from './SmartButton';
import { smart, type SmartReplyContext, type SmartReplyTone } from '@/lib/api/smart';

function friendlyError(e: any): string {
  if (e?.message?.includes('429') || e?.error === 'rate_limit_exceeded' || e?.status === 429) {
    return "You've hit today's Smart ManchQ limit (30/day). Resets in ~24h.";
  }
  return e?.error || e?.detail || e?.message || 'Smart ManchQ ran into a hiccup. Try again.';
}

type Props = {
  open: boolean;
  onClose: () => void;
  context: SmartReplyContext;
  contextId: number;
  contextLabel?: string;          // e.g. "Hip Hop Beg — Mon May 18 5:00 PM"
};

const PURPOSE_PRESETS = [
  { id: 'confirm',  label: 'Confirm — class is on as scheduled', purpose: 'Confirm the class is on as scheduled and remind them of the date/time/location.' },
  { id: 'cancel',   label: 'Cancel / reschedule',                purpose: 'Cancel or reschedule this. Apologise for short notice and explain briefly without going into private details.' },
  { id: 'reminder', label: 'Reminder day-before',                purpose: 'Friendly reminder the day before. Mention what to bring or wear if relevant.' },
  { id: 'rsvp',     label: 'Ask for RSVP',                       purpose: 'Politely ask parents to RSVP via the public page so we can plan accordingly.' },
  { id: 'custom',   label: 'Custom (write yourself)',            purpose: '' },
];

const TONE_OPTIONS: { id: SmartReplyTone; label: string }[] = [
  { id: 'friendly',   label: 'Friendly' },
  { id: 'formal',     label: 'Formal' },
  { id: 'apologetic', label: 'Apologetic' },
];

export default function SmartReplyModal({ open, onClose, context, contextId, contextLabel }: Props) {
  const [presetId, setPresetId] = useState('reminder');
  const [tone, setTone] = useState<SmartReplyTone>('friendly');
  const [custom, setCustom] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDraft('');
    setCopied(false);
    setCustom('');
    setPresetId('reminder');
    setError(null);
  };

  const handleClose = () => {
    if (generating) return;
    reset();
    onClose();
  };

  const doGenerate = async () => {
    const preset = PURPOSE_PRESETS.find((p) => p.id === presetId);
    const purpose = preset?.id === 'custom' ? custom.trim() : preset?.purpose || '';
    if (!purpose) {
      setError('Pick a purpose or write a custom one');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await smart.draftMessage(context, contextId, purpose, tone);
      setDraft(res.message);
      setCopied(false);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setGenerating(false);
    }
  };

  const doCopy = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const doShareWhatsApp = () => {
    if (!draft) return;
    const url = `https://wa.me/?text=${encodeURIComponent(draft)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <SmartModal
      open={open}
      onClose={handleClose}
      title="Smart Reply"
      subtitle={contextLabel ? `About: ${contextLabel}` : `Draft a message about this ${context}.`}
      maxWidth={600}
    >
      {!draft ? (
        <>
          {error && (
            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#DC2626', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
          {/* Purpose */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Purpose
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PURPOSE_PRESETS.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: presetId === p.id ? '1.5px solid #7C3AED' : '1px solid var(--border)',
                    background: presetId === p.id ? 'rgba(124,58,237,0.08)' : 'var(--card)',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text)',
                  }}
                >
                  <input
                    type="radio"
                    checked={presetId === p.id}
                    onChange={() => setPresetId(p.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            {presetId === 'custom' && (
              <textarea
                placeholder="Describe what you want to say…"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  marginTop: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            )}
          </div>

          {/* Tone */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Tone
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: tone === t.id ? '1.5px solid #7C3AED' : '1px solid var(--border)',
                    background: tone === t.id ? 'rgba(124,58,237,0.08)' : 'var(--card)',
                    color: tone === t.id ? '#7C3AED' : 'var(--text)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SmartButton onClick={doGenerate} loading={generating} size="md">
              {generating ? 'Drafting…' : 'Draft'}
            </SmartButton>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
            }}
          >
            {draft}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              onClick={doCopy}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: copied ? 'rgba(16,185,129,0.15)' : 'var(--card)',
                color: copied ? '#10B981' : 'var(--text)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            <button
              onClick={doShareWhatsApp}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#25D366',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              💬 Share via WhatsApp
            </button>
            <button
              onClick={() => { setDraft(''); }}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'none',
                color: 'var(--muted)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              ← Try again
            </button>
          </div>
        </>
      )}
    </SmartModal>
  );
}
