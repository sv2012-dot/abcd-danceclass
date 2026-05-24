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
//
// Spacing:
//   padding is symmetric (12px top + 12px bottom) so the typed text and the
//   resting-state label both sit visually centred in the input. Previously
//   we used asymmetric 17/7 padding to leave headroom for the floated chip,
//   but the chip is positioned at top:-7px (outside the border), so it
//   doesn't actually need top-padding inside. The asymmetric padding made
//   the placeholder text look biased toward the bottom of the input.

import React from 'react';

// Standard control height app-wide — Inputs, Selects and the date/time
// picker triggers all render at this height so mixed form rows line up.
// Also matches the 45px Button minHeight.
const STANDARD_CTRL_HEIGHT = 45;

const inp: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 10,
  padding: '12px 13px',
  minHeight: STANDARD_CTRL_HEIGHT,
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

// Custom select arrow — the native browser arrow sits flush against the
// right edge of the field with no breathing room and doesn't match the
// 13px left-padding of the text. We hide the native arrow with
// appearance:none and paint our own chevron via background-image, then
// position it 13px from the right edge so the visual symmetry matches the
// left text padding. Using an inline data: SVG keeps the arrow colour
// neutral grey that reads OK in both light and dark mode.
const SELECT_ARROW =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")";

export function Select({ children, ...props }: any) {
  return (
    <select
      {...props}
      style={{
        ...inp,
        // Symmetric vertical padding for the same centred look as inputs.
        // Right padding leaves room for our painted chevron (12px arrow +
        // ~13px breathing room + ~11px gap = 36px).
        paddingTop: 12,
        paddingBottom: 12,
        paddingRight: 36,
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        backgroundImage: SELECT_ARROW,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 13px center',
        ...props.style,
      }}
    >
      {children}
    </select>
  );
}

export function Textarea(props: any) {
  return (
    <textarea
      {...props}
      placeholder=" "
      // Textareas keep a slightly larger paddingTop to leave headroom for
      // the floated chip on multi-line content — without it, the chip
      // visually overlaps the first line of text.
      style={{ ...inp, minHeight: 88, paddingTop: 16, paddingBottom: 12, resize: 'vertical', ...props.style }}
    />
  );
}
