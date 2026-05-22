'use client';

// Shared form primitives — floating-label fields.
//
// <Field label="X"><Input .../></Field> renders the label inside the field as
// a placeholder; it floats up to a small chip on focus / when filled. The
// float is pure CSS (see .sf-field rules in globals.css) driven by :has() —
// no JS state — so the same <Field> wrapper works for plain inputs AND for
// custom pickers (DateField/TimeField/etc.), which keep the label floated.
//
// Inputs force placeholder=" " because the :placeholder-shown selector only
// fires when a placeholder attribute exists; the floating label replaces any
// hint text the caller might have passed.

import React from 'react';

const inp: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 10,
  // Extra top padding leaves room for the floated label; small bottom
  // padding keeps the resting label vertically centred.
  padding: '17px 13px 7px',
  fontSize: 14,
  color: 'var(--text)',
  fontFamily: 'var(--font-b)',
  transition: 'border-color .15s, box-shadow .15s',
  outline: 'none',
  boxSizing: 'border-box',
};

export function Field({ label, children, style }: { label: string; children: any; style?: React.CSSProperties }) {
  return (
    <div className="sf-field" style={style}>
      {/* input first, label after — the CSS sibling/:has() selectors and the
          floated-label visual both rely on this order */}
      {children}
      <label className="sf-field-label">{label}</label>
    </div>
  );
}

export function Input(props: any) {
  // placeholder forced to " " so :placeholder-shown works and the floating
  // label is the only visible field name.
  return <input {...props} placeholder=" " style={{ ...inp, ...props.style }} />;
}

export function Select({ children, ...props }: any) {
  return (
    <select {...props} style={{ ...inp, paddingTop: 16, paddingBottom: 8, ...props.style }}>
      {children}
    </select>
  );
}

export function Textarea(props: any) {
  return (
    <textarea
      {...props}
      placeholder=" "
      style={{ ...inp, minHeight: 88, paddingTop: 20, resize: 'vertical', ...props.style }}
    />
  );
}
