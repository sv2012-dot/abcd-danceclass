'use client';

// ProfileCropModal — react-easy-crop wrapper for student profile photos.
// Circular 1:1 crop, exports 240×240 JPEG @ 0.78 quality.
//
// Same external API as before:
//   <ProfileCropModal
//     file={file}
//     onConfirm={(dataUrl) => upload(dataUrl)}
//     onCancel={() => setCropFile(null)}
//   />

import { useCallback, useEffect, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';

type Props = {
  file: File;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
};

const OUTPUT_SIZE = 240;
const JPEG_QUALITY = 0.78;

// Crop + downscale to OUTPUT_SIZE × OUTPUT_SIZE, then clip to a circle
// so the avatar can render at any size without a square hint at the edge.
async function getCroppedCircularDataUrl(imageSrc: string, area: Area): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Pre-clip to a circle so the resulting JPEG has soft edges baked in.
  ctx.save();
  ctx.beginPath();
  ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.restore();
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export default function ProfileCropModal({ file, onConfirm, onCancel }: Props) {
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
      const dataUrl = await getCroppedCircularDataUrl(imageSrc, croppedAreaPixels);
      onConfirm(dataUrl);
    } catch (err) {
      console.error('[ProfileCropModal] crop failed', err);
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: '#0c0c0c',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        width: isMob ? '100%' : 380, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '14px 20px', boxSizing: 'border-box', flexShrink: 0,
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Set Profile Photo</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
            Drag the circle · Drag the image · {isMob ? 'Pinch to zoom' : 'Scroll to zoom'}
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

      {/* Cropper viewport — react-easy-crop draws a round crop region
          since cropShape='round' is enabled. Aspect 1:1 keeps it true
          to a circle regardless of source image dimensions. */}
      <div style={{
        position: 'relative',
        width: isMob ? '100%' : 360,
        height: isMob ? Math.min(window.innerWidth, 360) : 360,
        background: '#000', flexShrink: 0,
      }}>
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
            objectFit="contain"
          />
        )}
      </div>

      <div style={{ width: isMob ? '90%' : 320, padding: '14px 0 4px', flexShrink: 0 }}>
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
          <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '.06em' }}>1 : 1</span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{OUTPUT_SIZE} × {OUTPUT_SIZE} px</span>
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
