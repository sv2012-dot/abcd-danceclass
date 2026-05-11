'use client';

// Smart Announce — drafts a parent-facing announcement message with a rich
// preview (intent headline + event card matching the dashboard look + body).
// Renamed from "Smart Reply" — semantically these are announcements, not
// replies to a thread.

import React, { useState } from 'react';
import SmartModal from './SmartModal';
import SmartButton from './SmartButton';
import SmartUsageFooter from './SmartUsageFooter';
import { smart, type SmartReplyContext, type SmartReplyTone } from '@/lib/api/smart';

function friendlyError(e: any): string {
  if (e?.message?.includes('429') || e?.error === 'rate_limit_exceeded' || e?.status === 429) {
    return "You've hit today's Smart ManchQ limit (30/day). Resets in ~24h.";
  }
  return e?.error || e?.detail || e?.message || 'Smart ManchQ ran into a hiccup. Try again.';
}

// ── Context the modal needs to render the rich event card ──────────────────
// Frontend already knows these from the page that opened the modal, so we
// pass them as props instead of fetching again.
export type AnnounceContextData = {
  contextType: SmartReplyContext;    // 'event' | 'recital' | 'batch' | 'student'
  contextId: number;
  title: string;                     // e.g. "Sunday Test Batch"
  subtitle?: string;                 // e.g. "Class"
  dateLabel?: string;                // e.g. "Thu, May 21"
  timeLabel?: string;                // e.g. "8:00 – 9:00 PM"
  location?: string;
  color?: string;                    // accent color (purple, magenta, etc.)
};

type Props = {
  open: boolean;
  onClose: () => void;
  ctx: AnnounceContextData | null;
};

const PURPLE = '#7C3AED';
const MAGENTA = '#DC4EFF';

// Purpose presets — each maps to a HEADLINE shown above the message body
const PURPOSE_PRESETS: { id: string; label: string; headline: string; purpose: string; tone: SmartReplyTone }[] = [
  { id: 'confirm',  label: 'Confirm — class is on as scheduled', headline: 'Class confirmed',    purpose: 'Confirm the class is on as scheduled and reassure parents.',                       tone: 'friendly'   },
  { id: 'cancel',   label: 'Cancel / reschedule',                headline: 'Class cancelled',    purpose: 'Cancel or reschedule this. Briefly explain without private details.',             tone: 'apologetic' },
  { id: 'reminder', label: 'Reminder day-before',                headline: 'Reminder',           purpose: 'Friendly reminder the day before. Mention any prep or items to bring.',           tone: 'friendly'   },
  { id: 'rsvp',     label: 'Ask for RSVP',                       headline: 'Please RSVP',        purpose: 'Politely ask parents to RSVP via the public page so we can plan accordingly.',    tone: 'friendly'   },
  { id: 'custom',   label: 'Custom (write yourself)',            headline: 'Announcement',       purpose: '',                                                                                  tone: 'friendly'   },
];

const TONE_OPTIONS: { id: SmartReplyTone; label: string }[] = [
  { id: 'friendly',   label: 'Friendly' },
  { id: 'formal',     label: 'Formal' },
  { id: 'apologetic', label: 'Apologetic' },
];

// ── Calendar / clock / pin SVG icons (matches dashboard event card) ────────
const CalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const PinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

function EventCard({ ctx, color }: { ctx: AnnounceContextData; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      gap: 12,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{ width: 4, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.title}</span>
          {ctx.subtitle && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: color + '22', color, whiteSpace: 'nowrap' }}>
              {ctx.subtitle}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
          {ctx.dateLabel && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CalIcon /> {ctx.dateLabel}</div>}
          {ctx.timeLabel && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ClockIcon /> {ctx.timeLabel}</div>}
          {ctx.location  && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PinIcon /> {ctx.location}</div>}
        </div>
      </div>
    </div>
  );
}

export default function SmartAnnounceModal({ open, onClose, ctx }: Props) {
  const [presetId, setPresetId] = useState('reminder');
  const [tone, setTone] = useState<SmartReplyTone>('friendly');
  const [custom, setCustom] = useState('');
  const [generating, setGenerating] = useState(false);
  const [body, setBody] = useState<string>('');
  const [schoolName, setSchoolName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setBody('');
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

  // Sync tone with preset when preset changes (UX: cancellations default to apologetic)
  const pickPreset = (id: string) => {
    setPresetId(id);
    const p = PURPOSE_PRESETS.find((x) => x.id === id);
    if (p) setTone(p.tone);
    if (error) setError(null);
  };

  const preset = PURPOSE_PRESETS.find((p) => p.id === presetId);
  const headline = preset?.headline || 'Announcement';

  const doGenerate = async () => {
    if (!ctx) {
      setError('No event selected');
      return;
    }
    const purpose = preset?.id === 'custom' ? custom.trim() : preset?.purpose || '';
    if (!purpose) {
      setError('Pick a purpose or write a custom one');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await smart.draftMessage(ctx.contextType, ctx.contextId, purpose, tone);
      setBody(res.message);
      setSchoolName(res.school_name || '');
      setCopied(false);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setGenerating(false);
    }
  };

  // Build the plain-text payload for copy/share
  const fullText = (() => {
    const parts: string[] = [];
    parts.push(headline.toUpperCase());
    parts.push('');
    if (ctx?.title) parts.push(ctx.title);
    if (ctx?.dateLabel) parts.push(`📅 ${ctx.dateLabel}`);
    if (ctx?.timeLabel) parts.push(`🕐 ${ctx.timeLabel}`);
    if (ctx?.location)  parts.push(`📍 ${ctx.location}`);
    parts.push('');
    if (body) parts.push(body);
    if (schoolName) parts.push(`\n— ${schoolName}`);
    return parts.join('\n');
  })();

  const doCopy = () => {
    if (!body) return;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const doShareWhatsApp = () => {
    if (!body) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank', 'noopener,noreferrer');
  };

  const color = ctx?.color || PURPLE;

  return (
    <SmartModal
      open={open}
      onClose={handleClose}
      title="Smart Announce"
      subtitle={ctx ? `About: ${ctx.title}` : 'Draft a parent-facing announcement.'}
      maxWidth={620}
    >
      {!body ? (
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
                    border: presetId === p.id ? `1.5px solid ${PURPLE}` : '1px solid var(--border)',
                    background: presetId === p.id ? 'rgba(124,58,237,0.08)' : 'var(--card)',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text)',
                  }}
                >
                  <input
                    type="radio"
                    checked={presetId === p.id}
                    onChange={() => pickPreset(p.id)}
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
                    border: tone === t.id ? `1.5px solid ${PURPLE}` : '1px solid var(--border)',
                    background: tone === t.id ? 'rgba(124,58,237,0.08)' : 'var(--card)',
                    color: tone === t.id ? PURPLE : 'var(--text)',
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
              {generating ? 'Drafting…' : 'Draft Message'}
            </SmartButton>
          </div>
        </>
      ) : (
        // ── Rich preview ──
        <>
          {/* Intent headline */}
          <div style={{
            fontFamily: 'var(--font-d)',
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.3px',
            marginBottom: 14,
            lineHeight: 1.15,
          }}>
            {headline}
          </div>

          {/* Event card */}
          {ctx && <EventCard ctx={ctx} color={color} />}

          {/* Body */}
          <div style={{ marginTop: 16, fontSize: 14, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
            {body}
          </div>

          {/* Signature */}
          {schoolName && (
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
              — {schoolName}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
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
              onClick={() => setBody('')}
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
      <SmartUsageFooter />
    </SmartModal>
  );
}
