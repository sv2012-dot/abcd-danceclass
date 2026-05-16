// @ts-nocheck
'use client';

// ── Universal student avatar ────────────────────────────────────────────
// Use this component anywhere a student is shown with name + picture.
// Reads the canonical `student.avatar` field and renders:
//
//   photo:<URL>   → the uploaded Cloudinary picture
//   sprite:<N>    → the picked dance sticker (#N)
//   (empty / legacy emoji / anything else) → a deterministic sticker
//                                            derived from student.id
//
// Previously empty avatars showed a gray line-art silhouette, which felt
// generic and out-of-design. Now every student has a colorful default
// even before they've picked one.

import React from 'react';

const TOTAL_STICKERS = 72;

const STICKER_SRCS = Array.from({ length: TOTAL_STICKERS }, (_, i) => {
  const row = Math.floor(i / 12) + 1;
  const col = (i % 12) + 1;
  return `/stickers/sticker_${String(row).padStart(2, '0')}_${String(col).padStart(2, '0')}.png`;
});

export function parseAvatar(val) {
  if (!val) return { type: 'none' };
  if (val.startsWith('photo:'))  return { type: 'photo',  url: val.slice(6) };
  if (val.startsWith('sprite:')) return { type: 'sprite', index: parseInt(val.slice(7), 10) };
  return { type: 'none' };
}

// Deterministic sticker index from student.id so the "default" avatar
// is stable per student and doesn't reshuffle on every render.
function defaultStickerIndex(student) {
  const id = Number(student?.id) || 0;
  const name = student?.name || '';
  const hash = id * 31 + (name.charCodeAt(0) || 0) * 7 + (name.charCodeAt(1) || 0);
  return Math.abs(hash) % TOTAL_STICKERS;
}

function StickerImg({ index, size }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      <img
        src={STICKER_SRCS[index] || STICKER_SRCS[0]}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }}
      />
    </div>
  );
}

function PhotoImg({ url, size }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      <img
        src={url}
        alt=""
        draggable={false}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none', display: 'block' }}
      />
    </div>
  );
}

export default function StudentAvatar({ student, size = 44, border = undefined, active = false, onClick = undefined }: any) {
  const av = parseAvatar(student?.avatar);
  // For "none", fall back to a deterministic sticker so empty profiles
  // still feel personalised. The picker/upload flows still let teachers
  // pick a specific sticker or upload a photo.
  const effectiveIndex = av.type === 'sprite' ? av.index : defaultStickerIndex(student);
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        overflow: 'hidden',
        background: 'transparent',
        border: border || `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        lineHeight: 1,
        transition: 'border-color .15s, box-shadow .15s',
        userSelect: 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={onClick ? e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,.25)'; } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.boxShadow = '0 0 0 0 transparent'; } : undefined}
    >
      {av.type === 'photo'
        ? <PhotoImg url={av.url} size={size} />
        : <StickerImg index={effectiveIndex} size={size} />}
    </div>
  );
}
