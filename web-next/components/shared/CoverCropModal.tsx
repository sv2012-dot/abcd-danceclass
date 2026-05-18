'use client';

// CoverCropModal — react-easy-crop wrapper for recital / batch / event
// cover images. Configurable aspect ratio + output dimensions so the
// SAME modal handles all three use cases:
//
//   - Recital poster:    3:4 portrait, 600×800   (default)
//   - Batch cover:       16:9 landscape, 1280×720
//   - Event cover:       inherits from the variant prop
//
// Replaces the previous hand-rolled canvas cropper. react-easy-crop gives us:
//   - Draggable crop box with corner / edge handles
//   - Pinch + scroll zoom
//   - Touch-friendly gestures
//   - Industry-standard UX teachers already recognize from Instagram /
//     Cloudinary / etc.
//
// Usage:
//   <CoverCropModal file={file} onConfirm={...} onCancel={...} />
//                                                ^ defaults to 'poster' (3:4)
//   <CoverCropModal variant="hero" file={file} ... />  // 16:9 landscape
//
// Or fully custom: pass aspect, outputWidth, outputHeight directly.

import { useCallback, useEffect, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';

type Variant = 'poster' | 'hero';

const VARIANTS: Record<Variant, { aspect: number; outW: number; outH: number; label: string }> = {
  poster: { aspect: 600 / 800,   outW: 600,  outH: 800,  label: '3 : 4' },   // recital poster
  hero:   { aspect: 1280 / 720,  outW: 1280, outH: 720,  label: '16 : 9' },  // batch / event cover
};

type Props = {
  file: File;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  variant?: Variant;
  // Explicit overrides — useful if a caller wants a non-standard ratio
  // without adding a new variant entry.
  aspect?: number;
  outputWidth?: number;
  outputHeight?: number;
};

// Crop the source image to the chosen Area + downscale to (outW × outH).
// Returns a JPEG data URL the existing upload pipeline accepts.
async function getCroppedDataUrl(imageSrc: string, area: Area, outW: number, outH: number): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', 0.78);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export default function CoverCropModal({
  file, onConfirm, onCancel,
  variant = 'poster',
  aspect: aspectOverride,
  outputWidth: outWOverride,
  outputHeight: outHOverride,
}: Props) {
  const preset = VARIANTS[variant];
  const ASPECT = aspectOverride ?? preset.aspect;
  const OUT_W = outWOverride ?? preset.outW;
  const OUT_H = outHOverride ?? preset.outH;
  const RATIO_LABEL = (aspectOverride || outWOverride || outHOverride) ? `${OUT_W}:${OUT_H}` : preset.label;

  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const isMob = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedDataUrl(imageSrc, croppedAreaPixels, OUT_W, OUT_H);
      onConfirm(dataUrl);
    } catch (err) {
      console.error('[CoverCropModal] crop failed', err);
      setSaving(false);
    }
  };

  // stopPropagation on the overlay so clicks inside don't bubble up to
  // parent card onClicks (was navigating away after a successful upload).
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: '#0c0c0c',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        width: isMob ? '100%' : 420, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '14px 20px', boxSizing: 'border-box', flexShrink: 0,
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Set Cover Photo</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
            Drag the box · Drag the image · {isMob ? 'Pinch to zoom' : 'Scroll to zoom'}
          </div>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0,
          }}
        >✕</button>
      </div>

      {/* Cropper viewport — react-easy-crop renders a draggable crop box
          over the image. We fix the visual width and let the height
          follow the aspect ratio. */}
      <div style={{
        position: 'relative',
        width: isMob ? '100%' : 400,
        // For aspects < 1 (portrait) the box is taller than wide.
        // For aspects > 1 (landscape) it's wider, so height shrinks.
        height: isMob ? Math.round((typeof window !== 'undefined' ? window.innerWidth : 360) / ASPECT) : Math.round(400 / ASPECT),
        background: '#000', flexShrink: 0,
      }}>
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            objectFit="contain"
          />
        )}
      </div>

      {/* Zoom slider — duplicates pinch / scroll on devices where those
          aren't ergonomic (e.g. desktop trackpads with horizontal swipe). */}
      <div style={{ width: isMob ? '90%' : 360, padding: '14px 0 4px', flexShrink: 0 }}>
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#7C3AED' }}
          aria-label="Zoom"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, justifyContent: 'center' }}>
          <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '.06em' }}>{RATIO_LABEL}</span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{OUT_W} × {OUT_H} px</span>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 10, marginTop: 16,
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))', flexShrink: 0,
      }}>
        <button onClick={onCancel} style={{
          padding: '10px 22px', background: 'rgba(255,255,255,0.1)', border: 'none',
          borderRadius: 9, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Cancel</button>
        <button
          onClick={handleConfirm}
          disabled={!croppedAreaPixels || saving}
          style={{
            padding: '10px 28px', background: '#7C3AED', border: 'none',
            borderRadius: 9, color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: croppedAreaPixels && !saving ? 'pointer' : 'not-allowed',
            opacity: croppedAreaPixels && !saving ? 1 : 0.6,
          }}
        >
          {saving ? 'Saving…' : 'Use this photo →'}
        </button>
      </div>
    </div>
  );
}
