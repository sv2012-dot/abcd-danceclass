// @ts-nocheck
'use client';

// /batches/new — mobile-only full-page route for creating a batch.
//
// Why this exists: the existing slide-in panel on /batches works fine on
// desktop but on mobile it had the classic modal pitfalls — dual scroll
// (modal body + page behind), thin gap between modal header and the top
// nav, calendar/picker popovers overflowing the panel. This route is the
// mobile escape hatch. The trigger on /batches detects mobile via
// isMobile (windowWidth < 768) and navigates here instead of opening the
// panel. Desktop continues to use the panel exactly as before.
//
// The save logic is duplicated from /batches openAdd/handleSave. Keeping
// it duplicated rather than extracting a shared component for now —
// touching the desktop panel is the high-risk change the user explicitly
// asked us NOT to make. If both stay in sync over time we can refactor.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/context/AuthContext';
import { batches as api, schedules as schedulesApi } from '@/lib/api';
import { Field, Input, Select, Textarea } from '@/components/shared/Field';
import { TimeField, DurationField, DayOfWeekField } from '@/components/shared/date/Picker';
import { dowIndexToCode, addMinutesToTime } from '@/lib/date';
import SvgIcon from '@/components/shared/SvgIcon';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Mixed'];
const EMPTY = { name: '', dance_style: '', level: 'Beginner', teacher_name: '', max_size: '', notes: '' };
const EMPTY_BLOCK = { daysOfWeek: [1], start_time: '17:00', duration: 60, room: '' };

export default function NewBatchPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const sid = user?.school_id;

  const [form, setForm] = useState(EMPTY);
  const [formBlocks, setFormBlocks] = useState([]);
  const [saving, setSaving] = useState(false);

  // Same save logic as /batches handleSave but only handles the "create"
  // path — never update.
  const handleSave = async () => {
    if (!form.name || !sid) return;
    setSaving(true);
    try {
      const c = await api.create(sid, form);
      const batchId = c.id;

      // Expand blocks → per-day schedule rows. Each "block" is one weekly
      // time slot that meets on N days; we explode it into N rows.
      const ops = [];
      for (const block of formBlocks) {
        const end_time = addMinutesToTime(block.start_time, block.duration);
        for (const dowIdx of block.daysOfWeek) {
          const day_of_week = dowIndexToCode(dowIdx);
          ops.push(
            schedulesApi.create(sid, {
              batch_id: batchId,
              day_of_week,
              start_time: block.start_time,
              end_time,
              room: block.room || null,
            })
          );
        }
      }
      await Promise.all(ops);
      qc.invalidateQueries({ queryKey: ['batches', sid] });
      qc.invalidateQueries({ queryKey: ['schedules', sid] });
      toast.success('Batch created');
      router.replace(`/batches?openBatchId=${batchId}`);
    } catch (err) {
      toast.error(err?.error || 'Failed to save');
      setSaving(false);
    }
  };

  // Section header — bigger top-margin than desktop's panel to feel like a
  // page section rather than a tight panel chunk.
  const SectionHeader = ({ title, action }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</div>
      {action}
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: 32 }}>
      {/* Page header — replaces the modal/panel chrome. Sticky so Cancel /
          Create stay reachable while the form scrolls. */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          zIndex: 10,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <button
          // router.push instead of router.back — back() would fail if the
          // user lands here via a deep link or page refresh (no history
          // entry to go back to). Always returns to the batches list.
          onClick={() => router.push('/batches')}
          aria-label="Cancel"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '8px 4px',
            minHeight: 44,
            touchAction: 'manipulation',
          }}
        >
          Cancel
        </button>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>New Batch</h1>
        <button
          onClick={handleSave}
          disabled={!form.name || saving}
          style={{
            background: !form.name || saving ? 'var(--muted)' : 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 700,
            cursor: !form.name || saving ? 'default' : 'pointer',
            minHeight: 44,
            opacity: !form.name || saving ? 0.6 : 1,
            touchAction: 'manipulation',
          }}
        >
          {saving ? 'Saving…' : 'Create'}
        </button>
      </header>

      <div style={{ padding: '8px 18px 32px', maxWidth: 560, margin: '0 auto' }}>
        {/* Batch Details */}
        <SectionHeader title="Batch Details" />
        <Field label="Batch Name *">
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Junior Ballet" />
        </Field>
        <Field label="Dance Style">
          <Input value={form.dance_style} onChange={e => setForm({ ...form, dance_style: e.target.value })} placeholder="e.g. Ballet" />
        </Field>
        <Field label="Level">
          <Select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Instructor Name">
          <Input value={form.teacher_name} onChange={e => setForm({ ...form, teacher_name: e.target.value })} placeholder="e.g. Swapna Varma" />
        </Field>
        <Field label="Max Capacity">
          <Input type="number" value={form.max_size} onChange={e => setForm({ ...form, max_size: e.target.value })} placeholder="e.g. 12" />
        </Field>

        {/* Class Schedule */}
        <SectionHeader
          title="Class Schedule"
          action={
            <button
              onClick={() => setFormBlocks([...formBlocks, { ...EMPTY_BLOCK }])}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 38,
                touchAction: 'manipulation',
              }}
            >
              + Add Time Slot
            </button>
          }
        />
        {formBlocks.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.55 }}>
            No classes added yet. Tap “+ Add Time Slot” above to schedule one.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {formBlocks.map((block, idx) => {
              const update = patch => {
                const u = [...formBlocks];
                u[idx] = { ...u[idx], ...patch };
                setFormBlocks(u);
              };
              return (
                <div
                  key={idx}
                  style={{
                    padding: '16px 16px 18px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button
                      onClick={() => setFormBlocks(formBlocks.filter((_, i) => i !== idx))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        fontSize: 13,
                        padding: '6px 8px',
                        borderRadius: 6,
                        minHeight: 36,
                        touchAction: 'manipulation',
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                  {/* DayOfWeekField keeps its built-in "Meets on" label since it
                      isn't wrapped in a <Field>. */}
                  <div style={{ marginBottom: 18 }}>
                    <DayOfWeekField value={block.daysOfWeek} onChange={v => update({ daysOfWeek: v })} />
                  </div>
                  <Field label="Start time">
                    <TimeField value={block.start_time} onChange={v => update({ start_time: v })} />
                  </Field>
                  <Field label="Duration">
                    {/* label={null} — Field provides the floating label;
                        without this DurationField's default "Duration"
                        rendered on top, producing the doubled label. */}
                    <DurationField label={null} value={block.duration} onChange={d => update({ duration: d })} startTime={block.start_time} />
                  </Field>
                  <Field label="Studio / Location" style={{ marginBottom: 0 }}>
                    <Input value={block.room} onChange={e => update({ room: e.target.value })} placeholder="e.g. Studio A, Hall 2" />
                  </Field>
                </div>
              );
            })}
          </div>
        )}

        {/* Notes */}
        <SectionHeader title="Notes" />
        <Field label="Notes" style={{ marginBottom: 0 }}>
          <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes about this batch…" />
        </Field>
      </div>
    </div>
  );
}
