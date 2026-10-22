import { useEffect, useRef, useState } from 'react';
import { Modal } from './dialogs';
import { t } from '../i18n';

const STAGE = 280;
const OUT = 512;

/** Square photo cropper: drag to pan, slider to zoom. Produces a 512×512 JPEG. */
export function CropDialog(props: { file: File; onDone: (blob: Blob) => void; onCancel: () => void }) {
  const [url] = useState(() => URL.createObjectURL(props.file));
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setError(t('badImage'));
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const base = img ? STAGE / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : 0;
  const h = img ? img.naturalHeight * scale : 0;
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(STAGE - w, o.x)),
    y: Math.min(0, Math.max(STAGE - h, o.y)),
  });
  useEffect(() => {
    if (img) setOff((o) => (o.x === 0 && o.y === 0 ? clamp({ x: (STAGE - w) / 2, y: (STAGE - h) / 2 }) : clamp(o)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, zoom]);

  const apply = () => {
    if (!img) return;
    const c = document.createElement('canvas');
    c.width = OUT;
    c.height = OUT;
    const ctx = c.getContext('2d')!;
    const k = OUT / STAGE;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, off.x * k, off.y * k, w * k, h * k);
    c.toBlob((b) => b && props.onDone(b), 'image/jpeg', 0.9);
  };

  return (
    <Modal title={t('cropTitle')} onClose={props.onCancel} testId="crop-dialog">
      {error ? (
        <p className="error-text">{error}</p>
      ) : (
        <>
          <div
            className="crop-stage"
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (d) setOff(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }));
            }}
            onPointerUp={() => (drag.current = null)}
          >
            {img && <img src={url} alt="" style={{ width: w, height: h, transform: `translate(${off.x}px, ${off.y}px)` }} />}
          </div>
          <label className="field">
            {t('zoom')}
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
          </label>
          <p className="note">{t('cropNote')}</p>
        </>
      )}
      <div className="actions">
        <button className="btn ghost" onClick={props.onCancel}>{t('cancel')}</button>
        <button className="btn primary" onClick={apply} disabled={!img} data-testid="crop-apply">{t('usePhoto')}</button>
      </div>
    </Modal>
  );
}
