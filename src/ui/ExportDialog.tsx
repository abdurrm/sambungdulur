import { useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
import type { TreeDoc } from '../model/types';
import type { Density } from '../layout/metrics';
import { exportGedcom } from '../gedcom/gedcom';
import { exportGenealogyText } from '../io/textExport';
import { buildExportSvg, downloadBlob, rasterize, safeFileName, type ImageBackground } from '../io/imageExport';
import { Modal } from './dialogs';
import { t, type Key } from '../i18n';

type Kind = 'png' | 'jpeg' | 'svg' | 'ged' | 'txt';

const KINDS: { kind: Kind; label: Key; desc: Key; color: string }[] = [
  { kind: 'png', label: 'kPng', desc: 'kPngDesc', color: '#4338ca' },
  { kind: 'jpeg', label: 'kJpeg', desc: 'kJpegDesc', color: '#0369a1' },
  { kind: 'svg', label: 'kSvg', desc: 'kSvgDesc', color: '#b45309' },
  { kind: 'ged', label: 'kGed', desc: 'kGedDesc', color: '#0f766e' },
  { kind: 'txt', label: 'kTxt', desc: 'kTxtDesc', color: '#57534e' },
];

const DENSITY_LABEL: Record<Density, Key> = { compact: 'compact', normal: 'normal', detailed: 'detailed' };
const BG_LABEL: Record<ImageBackground, Key> = { canvas: 'bgFollowCanvas', white: 'white', transparent: 'transparent' };

export function ExportDialog(props: {
  doc: TreeDoc;
  focusId: string;
  getMediaBlob: (id: string) => Promise<Blob | undefined>;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { doc } = props;
  const [kind, setKind] = useState<Kind>('png');
  const [density, setDensity] = useState<Density>('normal');
  const [background, setBackground] = useState<ImageBackground>('canvas');
  const [scale, setScale] = useState(2);
  const [scope, setScope] = useState<'view' | 'all'>('view');
  const [legend, setLegend] = useState(true);
  const [gedZip, setGedZip] = useState(false);
  const [rewritePaths, setRewritePaths] = useState(false);
  const [txtFacts, setTxtFacts] = useState(true);
  const [txtIndex, setTxtIndex] = useState(true);
  const [txtAll, setTxtAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = safeFileName(doc.title);
  const up = scope === 'all' ? -1 : doc.settings.ancestorGenerations;
  const down = scope === 'all' ? -1 : doc.settings.descendantGenerations;
  const gen = (v: number) => (v < 0 ? t('all') : String(v));

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      if (kind === 'png' || kind === 'jpeg' || kind === 'svg') {
        const bg: ImageBackground = kind === 'jpeg' && background === 'transparent' ? 'white' : background;
        const { svg, width, height, backdrop } = await buildExportSvg(
          doc,
          { density, background: bg, scale, legend, focusId: props.focusId, ancestors: up, descendants: down },
          props.getMediaBlob,
        );
        if (kind === 'svg') {
          downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${base}.svg`);
          props.onDone(t('exportedImage', { file: `${base}.svg`, w: width, h: height, reduced: '' }));
        } else {
          const jpegBg = bg === 'white' ? '#ffffff' : backdrop.color;
          const { blob, scale: used } = await rasterize(svg, width, height, scale, kind === 'png' ? 'image/png' : 'image/jpeg', jpegBg);
          const name = `${base}-${density}.${kind === 'png' ? 'png' : 'jpeg'}`;
          downloadBlob(blob, name);
          props.onDone(
            t('exportedImage', {
              file: name,
              w: Math.round(width * used),
              h: Math.round(height * used),
              reduced: used < scale ? t('scaleReduced') : '',
            }),
          );
        }
      } else if (kind === 'ged') {
        const mediaPath = (id: string) => `media/${doc.media[id]?.fileName ?? id}`;
        let source = doc;
        if (gedZip && rewritePaths) {
          const media = Object.fromEntries(
            Object.entries(doc.media).map(([id, m]) => [id, m.available ? { ...m, sourcePath: mediaPath(id) } : m]),
          );
          source = { ...doc, media };
        }
        const text = exportGedcom(source, { mediaPath });
        if (!gedZip) {
          downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${base}.ged`);
          props.onDone(t('exportedGed', { file: `${base}.ged`, n: doc.order.length, f: doc.familyOrder.length }));
        } else {
          const files: Record<string, Uint8Array> = { [`${base}.ged`]: strToU8(text) };
          let n = 0;
          for (const [id, m] of Object.entries(doc.media)) {
            if (!m.available || m.background) continue;
            const blob = await props.getMediaBlob(id);
            if (!blob) continue;
            files[mediaPath(id)] = new Uint8Array(await blob.arrayBuffer());
            n++;
          }
          downloadBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `${base}-gedcom.zip`);
          props.onDone(t('exportedZip', { file: `${base}-gedcom.zip`, n }));
        }
      } else {
        const text = exportGenealogyText(doc, {
          focusId: props.focusId,
          ancestors: up,
          descendants: down,
          includeFacts: txtFacts,
          includeIndex: txtIndex,
          includeAllFamilies: txtAll,
        });
        downloadBlob(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }), `${base}-genealogy.txt`);
        props.onDone(t('exported', { file: `${base}-genealogy.txt` }));
      }
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const image = kind === 'png' || kind === 'jpeg' || kind === 'svg';
  return (
    <Modal title={t('exportTitle')} onClose={() => !busy && props.onClose()} wide testId="export-dialog">
      <div className="choice-list">
        {KINDS.map((k) => (
          <button key={k.kind} className={`choice${kind === k.kind ? ' selected' : ''}`} onClick={() => setKind(k.kind)} data-testid={`export-kind-${k.kind}`}>
            <span className="badge" style={{ color: '#fff', background: k.color }}>{k.kind.toUpperCase()}</span>
            <span>
              <div className="t">{t(k.label)}</div>
              <div className="d">{t(k.desc)}</div>
            </span>
          </button>
        ))}
      </div>
      {(image || kind === 'txt') && (
        <div className="field">
          {t('peopleToInclude')}
          <div className="seg">
            <button className={scope === 'view' ? 'on' : ''} onClick={() => setScope('view')} data-testid="export-scope-view">
              {t('currentView', { up: gen(doc.settings.ancestorGenerations), down: gen(doc.settings.descendantGenerations) })}
            </button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')} data-testid="export-scope-all">
              {t('wholeFamily')}
            </button>
          </div>
        </div>
      )}
      {image && (
        <>
          <div className="field">
            {t('cardDetail')}
            <div className="seg">
              {(['compact', 'normal', 'detailed'] as Density[]).map((d) => (
                <button key={d} className={density === d ? 'on' : ''} onClick={() => setDensity(d)} data-testid={`export-density-${d}`}>
                  {t(DENSITY_LABEL[d])}
                </button>
              ))}
            </div>
            <span className="note">{t('densityHelp')}</span>
          </div>
          <div className="row">
            <div className="field">
              {t('background')}
              <div className="seg">
                {(['canvas', 'white', 'transparent'] as ImageBackground[]).map((b) => (
                  <button key={b} className={background === b ? 'on' : ''} disabled={b === 'transparent' && kind === 'jpeg'} onClick={() => setBackground(b)} data-testid={`export-bg-${b}`}>
                    {t(BG_LABEL[b])}
                  </button>
                ))}
              </div>
            </div>
            {kind !== 'svg' && (
              <div className="field">
                {t('resolution')}
                <div className="seg">
                  {[1, 2, 3].map((s) => (
                    <button key={s} className={scale === s ? 'on' : ''} onClick={() => setScale(s)}>{s}×</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <label className="check" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={legend} onChange={() => setLegend(!legend)} /> {t('includeLegend')}
          </label>
        </>
      )}
      {kind === 'ged' && (
        <div className="form">
          <label className="check" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={gedZip} onChange={() => setGedZip(!gedZip)} data-testid="export-ged-zip" /> {t('bundlePhotos')}
          </label>
          {gedZip && (
            <label className="check" style={{ fontSize: 14 }}>
              <input type="checkbox" checked={rewritePaths} onChange={() => setRewritePaths(!rewritePaths)} /> {t('rewritePaths')}
            </label>
          )}
          <p className="note">{doc.gedcomSource ? t('gedFromSource') : t('gedFresh')}</p>
        </div>
      )}
      {kind === 'txt' && (
        <div className="form">
          <label className="check" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={txtFacts} onChange={() => setTxtFacts(!txtFacts)} /> {t('txtFacts')}
          </label>
          <label className="check" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={txtIndex} onChange={() => setTxtIndex(!txtIndex)} /> {t('txtIndex')}
          </label>
          <label className="check" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={txtAll} onChange={() => setTxtAll(!txtAll)} /> {t('txtAll')}
          </label>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      <div className="actions">
        <button className="btn ghost" onClick={props.onClose} disabled={busy}>{t('cancel')}</button>
        <button className="btn primary" onClick={run} disabled={busy} data-testid="export-run">
          {busy ? t('exporting') : t('export')}
        </button>
      </div>
    </Modal>
  );
}
