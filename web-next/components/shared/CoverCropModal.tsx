'use client';

// CoverCropModal — zero-dependency canvas cropper for recital / batch cover
// images. Enforces a 3:4 portrait crop window and exports at 600×800, 78% JPEG.
//
// Extracted from app/(dashboard)/recitals/page.tsx so the dashboard recital
// cards can use the same flow.
//
// Usage:
//   const [cropFile, setCropFile] = useState<File | null>(null);
//   <input type="file" onChange={(e) => setCropFile(e.target.files?.[0] || null)} />
//   {cropFile && (
//     <CoverCropModal
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

export default function CoverCropModal({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const stRef     = useRef({ scale: 1, ox: 0, oy: 0, dragging: false, lastX: 0, lastY: 0, lastDist: 0 });
  const [ready,  setReady]  = useState(false);
  const [saving, setSaving] = useState(false);
  const isMob = typeof window !== 'undefined' && window.innerWidth < 768;

  // Canvas / crop window — portrait 3:4
  const CW    = isMob ? Math.min(typeof window !== 'undefined' ? window.innerWidth : 420, 420) : 400;
  const PAD   = isMob ? 16 : 20;
  const CROPW = CW - PAD * 2;
  const CROPH = Math.round(CROPW * 4 / 3);
  const CH    = CROPH + PAD * 2;
  const CROPX = PAD;
  const CROPY = PAD;

  const draw = () => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { scale, ox, oy } = stRef.current;
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, ox, oy, img.naturalWidth * scale, img.naturalHeight * scale);
    // Dim outside crop window
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(0, 0, CW, CROPY);
    ctx.fillRect(0, CROPY + CROPH, CW, CH - CROPY - CROPH);
    ctx.fillRect(0, CROPY, CROPX, CROPH);
    ctx.fillRect(CROPX + CROPW, CROPY, CW - CROPX - CROPW, CROPH);
    // Crop border
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(CROPX + 0.75, CROPY + 0.75, CROPW - 1.5, CROPH - 1.5);
    // Rule-of-thirds grid
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    [1, 2].forEach(n => {
      ctx.moveTo(CROPX + CROPW * n / 3, CROPY);
      ctx.lineTo(CROPX + CROPW * n / 3, CROPY + CROPH);
      ctx.moveTo(CROPX, CROPY + CROPH * n / 3);
      ctx.lineTo(CROPX + CROPW, CROPY + CROPH * n / 3);
    });
    ctx.stroke();
    // Corner bracket handles
    const ARM = 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'square';
    ctx.beginPath();
    [
      [CROPX,          CROPY,          1,  1],
      [CROPX + CROPW,  CROPY,         -1,  1],
      [CROPX,          CROPY + CROPH,  1, -1],
      [CROPX + CROPW,  CROPY + CROPH, -1, -1],
    ].forEach(([x, y, dx, dy]) => {
      ctx.moveTo(x + dx * ARM, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * ARM);
    });
    ctx.stroke();
  };

  const clampOffset = (ox: number, oy: number, scale: number) => {
    const img = imgRef.current;
    if (!img) return { ox, oy };
    return {
      ox: Math.min(CROPX, Math.max(CROPX + CROPW - img.naturalWidth  * scale, ox)),
      oy: Math.min(CROPY, Math.max(CROPY + CROPH - img.naturalHeight * scale, oy)),
    };
  };

  const applyTransform = (newScale: number, newOx: number, newOy: number) => {
    const img = imgRef.current;
    if (!img) return;
    const minS = Math.max(CROPW / img.naturalWidth, CROPH / img.naturalHeight);
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
      const minS = Math.max(CROPW / img.naturalWidth, CROPH / img.naturalHeight);
      const ox   = CROPX + (CROPW - img.naturalWidth  * minS) / 2;
      const oy   = CROPY + (CROPH - img.naturalHeight * minS) / 2;
      Object.assign(stRef.current, { scale: minS, ox, oy });
      setReady(true);
      requestAnimationFrame(draw);
    };
    img.onerror = () => { URL.revokeObjectURL(url); onCancel(); };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mouse — desktop
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

  // Touch — mobile
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

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);
    const { scale, ox, oy } = stRef.current;
    const srcX = (CROPX - ox) / scale;
    const srcY = (CROPY - oy) / scale;
    const srcW = CROPW / scale;
    const srcH = CROPH / scale;
    const out  = document.createElement('canvas');
    out.width  = 600;
    out.height = 800;
    out.getContext('2d')!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 600, 800);
    onConfirm(out.toDataURL('image/jpeg', 0.78));
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:3000, background:'#0c0c0c', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width: isMob ? '100%' : CW, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', boxSizing:'border-box', flexShrink:0 }}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:15 }}>Set Cover Photo</div>
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
          <span style={{ background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.55)', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, letterSpacing:'.06em' }}>3 : 4</span>
          <span style={{ color:'rgba(255,255,255,0.35)', fontSize:10 }}>600 × 800 px</span>
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
