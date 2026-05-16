'use client';

// ProfileCropModal — circular-crop variant of CoverCropModal, used for
// student profile pictures. 1:1 aspect, exports 240×240 JPEG @ 0.78 quality
// (small file size, good enough for an avatar that's never rendered larger
// than ~80px).
//
// Usage:
//   const [cropFile, setCropFile] = useState<File | null>(null);
//   <input type="file" onChange={(e) => setCropFile(e.target.files?.[0] || null)} />
//   {cropFile && (
//     <ProfileCropModal
//       file={cropFile}
//       onConfirm={(dataUrl) => { setCropFile(null); upload(dataUrl); }}
//       onCancel={() => setCropFile(null)}
//     />
//   )}

import { useEffect, useRef, useState } from 'react';

type Props = {
  file: File;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
};

const OUTPUT_SIZE = 240;   // final exported avatar pixels
const JPEG_QUALITY = 0.78; // small file size

export default function ProfileCropModal({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const stRef     = useRef({ scale: 1, ox: 0, oy: 0, dragging: false, lastX: 0, lastY: 0, lastDist: 0 });
  const [ready,  setReady]  = useState(false);
  const [saving, setSaving] = useState(false);
  const isMob = typeof window !== 'undefined' && window.innerWidth < 768;

  // Square crop window — large enough for the user to position comfortably
  const PAD   = isMob ? 16 : 20;
  const CW    = isMob ? Math.min(typeof window !== 'undefined' ? window.innerWidth : 360, 360) : 380;
  const CROPSIZE = CW - PAD * 2;
  const CH    = CROPSIZE + PAD * 2;
  const CROPX = PAD;
  const CROPY = PAD;
  const CROPCX = CROPX + CROPSIZE / 2;
  const CROPCY = CROPY + CROPSIZE / 2;
  const CROPR = CROPSIZE / 2;

  const draw = () => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { scale, ox, oy } = stRef.current;
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, ox, oy, img.naturalWidth * scale, img.naturalHeight * scale);

    // Dim everything outside the circle. Use 'evenodd' fill rule with a
    // rectangle minus a circle subpath.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.beginPath();
    ctx.rect(0, 0, CW, CH);
    ctx.arc(CROPCX, CROPCY, CROPR, 0, Math.PI * 2, true); // counter-clockwise carves out
    ctx.fill('evenodd');
    ctx.restore();

    // Circle border
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.arc(CROPCX, CROPCY, CROPR - 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle cross-hair guides through center (optional, helps centering)
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(CROPCX, CROPY);
    ctx.lineTo(CROPCX, CROPY + CROPSIZE);
    ctx.moveTo(CROPX, CROPCY);
    ctx.lineTo(CROPX + CROPSIZE, CROPCY);
    ctx.stroke();
  };

  const clampOffset = (ox: number, oy: number, scale: number) => {
    const img = imgRef.current;
    if (!img) return { ox, oy };
    return {
      ox: Math.min(CROPX, Math.max(CROPX + CROPSIZE - img.naturalWidth  * scale, ox)),
      oy: Math.min(CROPY, Math.max(CROPY + CROPSIZE - img.naturalHeight * scale, oy)),
    };
  };

  const applyTransform = (newScale: number, newOx: number, newOy: number) => {
    const img = imgRef.current;
    if (!img) return;
    const minS = Math.max(CROPSIZE / img.naturalWidth, CROPSIZE / img.naturalHeight);
    const s    = Math.min(Math.max(newScale, minS), minS * 5);
    const { ox, oy } = clampOffset(newOx, newOy, s);
    Object.assign(stRef.current, { scale: s, ox, oy });
    draw();
  };

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      URL.revokeObjectURL(url);
      const minS = Math.max(CROPSIZE / img.naturalWidth, CROPSIZE / img.naturalHeight);
      const ox   = CROPX + (CROPSIZE - img.naturalWidth  * minS) / 2;
      const oy   = CROPY + (CROPSIZE - img.naturalHeight * minS) / 2;
      Object.assign(stRef.current, { scale: minS, ox, oy });
      setReady(true);
      requestAnimationFrame(draw);
    };
    img.onerror = () => { URL.revokeObjectURL(url); onCancel(); };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mouse (desktop)
  const onMD = (e: React.MouseEvent) => { stRef.current.dragging = true; stRef.current.lastX = e.clientX; stRef.current.lastY = e.clientY; };
  const onMM = (e: React.MouseEvent) => {
    if (!stRef.current.dragging) return;
    const { lastX, lastY, scale, ox, oy } = stRef.current;
    stRef.current.lastX = e.clientX; stRef.current.lastY = e.clientY;
    applyTransform(scale, ox + e.clientX - lastX, oy + e.clientY - lastY);
  };
  const onMU = () => { stRef.current.dragging = false; };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const f    = e.deltaY > 0 ? 0.92 : 1.09;
    const ns   = stRef.current.scale * f;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    applyTransform(ns,
      mx - (mx - stRef.current.ox) * (ns / stRef.current.scale),
      my - (my - stRef.current.oy) * (ns / stRef.current.scale),
    );
  };

  // Touch (mobile)
  const onTS = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      stRef.current.dragging = true;
      stRef.current.lastX = e.touches[0].clientX;
      stRef.current.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      stRef.current.dragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      stRef.current.lastDist = Math.sqrt(dx * dx + dy * dy);
    }
  };
  const onTM = (e: React.TouchEvent) => {
    e.preventDefault();
    const { scale, ox, oy, lastX, lastY } = stRef.current;
    if (e.touches.length === 1 && stRef.current.dragging) {
      stRef.current.lastX = e.touches[0].clientX;
      stRef.current.lastY = e.touches[0].clientY;
      applyTransform(scale, ox + e.touches[0].clientX - lastX, oy + e.touches[0].clientY - lastY);
    } else if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const f    = dist / stRef.current.lastDist;
      stRef.current.lastDist = dist;
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx   = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const my   = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const ns   = scale * f;
      applyTransform(ns,
        mx - (mx - ox) * (ns / scale),
        my - (my - oy) * (ns / scale),
      );
    }
  };
  const onTE = () => { stRef.current.dragging = false; };

  // Export: draw the cropped circular region onto a small offscreen canvas.
  // We mask the output to a circle so the final image is round when displayed
  // on backgrounds that don't clip it.
  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);
    const { scale, ox, oy } = stRef.current;
    const srcX = (CROPX - ox) / scale;
    const srcY = (CROPY - oy) / scale;
    const srcW = CROPSIZE / scale;
    const srcH = CROPSIZE / scale;
    const out  = document.createElement('canvas');
    out.width  = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const octx = out.getContext('2d')!;
    // Clip to circle so the exported JPEG renders round even on
    // square <img> backgrounds.
    octx.save();
    octx.beginPath();
    octx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    octx.closePath();
    octx.clip();
    octx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    octx.restore();
    // JPEG fills the circle's transparent corners with white. That's fine —
    // consumers always render the avatar inside a border-radius:50% wrapper.
    onConfirm(out.toDataURL('image/jpeg', JPEG_QUALITY));
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ position:'fixed', inset:0, zIndex:3000, background:'#0c0c0c', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}
    >
      <div style={{ width: isMob ? '100%' : CW, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', boxSizing:'border-box', flexShrink:0 }}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:15 }}>Set Profile Picture</div>
          <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:2 }}>
            {isMob ? 'Drag to reposition · Pinch to zoom' : 'Drag to reposition · Scroll to zoom'}
          </div>
        </div>
        <button onClick={onCancel} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:18, lineHeight:1, flexShrink:0 }}>✕</button>
      </div>

      {!ready && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:13, padding:60 }}>Loading image…</div>}
      <canvas
        ref={canvasRef}
        width={CW} height={CH}
        style={{ display: ready ? 'block' : 'none', cursor:'grab', touchAction:'none', borderRadius: isMob ? 0 : 12, flexShrink:0 }}
        onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
        onWheel={onWheel}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
      />

      {ready && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10 }}>
          <span style={{ background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.55)', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, letterSpacing:'.06em' }}>CIRCLE</span>
          <span style={{ color:'rgba(255,255,255,0.35)', fontSize:10 }}>{OUTPUT_SIZE} × {OUTPUT_SIZE} px</span>
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginTop:16, paddingBottom:'max(20px, env(safe-area-inset-bottom))', flexShrink:0 }}>
        <button onClick={onCancel} style={{ padding:'10px 22px', background:'rgba(255,255,255,0.1)', border:'none', borderRadius:9, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
          Cancel
        </button>
        <button onClick={handleConfirm} disabled={!ready || saving}
          style={{ padding:'10px 28px', background:'#7C3AED', border:'none', borderRadius:9, color:'#fff', fontSize:14, fontWeight:700, cursor: ready && !saving ? 'pointer' : 'not-allowed', opacity: ready && !saving ? 1 : 0.6 }}>
          {saving ? 'Saving…' : 'Use this photo →'}
        </button>
      </div>
    </div>
  );
}
