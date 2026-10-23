// Muxes the screen recording with the Andika narration (each scene's audio placed at the
// scene start recorded in temp/video/timeline.json) into docs/video/sambungdulur-demo.mp4,
// writes the subtitle file and a poster image.
//
//   node scripts/video/mux.mjs        (record.mjs runs this automatically at the end)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const TMP = path.join(root, 'temp/video');
const AUDIO = path.join(TMP, 'audio');
const REC = path.join(TMP, 'rec');
const OUT = path.join(root, 'docs/video');
fs.mkdirSync(OUT, { recursive: true });

const probe = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
const timeline = JSON.parse(fs.readFileSync(path.join(TMP, 'timeline.json'), 'utf8'));

// Edge opens a transient tab for file downloads, which Playwright records as a second, short
// video. The main page is the longest recording.
const webm = fs
  .readdirSync(REC)
  .filter((f) => f.endsWith('.webm'))
  .map((f) => path.join(REC, f))
  .map((f) => ({ f, d: probe(f) }))
  .sort((a, b) => b.d - a.d)[0];
if (!webm) throw new Error('no recording found in ' + REC);
const videoDur = webm.d;
console.log(`using ${path.basename(webm.f)} (${videoDur.toFixed(1)}s)`);

const sentenceSplit = (s) => s.split(/(?<=[.?!])\s+/).filter(Boolean);
const srtTime = (sec) => {
  const ms = Math.round(sec * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

let srt = '';
let n = 1;
for (const t of timeline) {
  const textSents = sentenceSplit(t.text);
  if (textSents.length !== t.sents) throw new Error(`subtitle sentence mismatch in ${t.id}`);
  textSents.forEach((s, i) => {
    const a = t.start + t.startsFrac[i] * t.dur;
    const b = i + 1 < t.sents ? t.start + t.startsFrac[i + 1] * t.dur : t.start + t.dur;
    srt += `${n++}\n${srtTime(a)} --> ${srtTime(b - 0.05)}\n${s}\n\n`;
  });
}
const srtPath = path.join(OUT, 'sambungdulur-demo.id.srt');
fs.writeFileSync(srtPath, srt);

const inputs = ['-i', webm.f];
const filters = [];
timeline.forEach((t, i) => {
  inputs.push('-i', path.join(AUDIO, `${t.id}.wav`));
  const ms = Math.round(t.start * 1000);
  filters.push(`[${i + 1}:a]aresample=44100,adelay=${ms}|${ms}[a${i}]`);
});
const mix = `${timeline.map((_, i) => `[a${i}]`).join('')}amix=inputs=${timeline.length}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=11,apad[aout]`;
const mp4 = path.join(OUT, 'sambungdulur-demo.mp4');
execFileSync(
  'ffmpeg',
  [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...inputs,
    '-i', srtPath,
    '-filter_complex', [...filters, mix].join(';'),
    '-map', '0:v', '-map', '[aout]', '-map', `${timeline.length + 1}:s`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'aac', '-b:a', '160k', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=ind',
    '-t', String(videoDur),
    '-movflags', '+faststart',
    mp4,
  ],
  { stdio: 'inherit' },
);
console.log('wrote', mp4, (fs.statSync(mp4).size / 1e6).toFixed(1) + ' MB');

// Poster: a frame from the import scene (full tree on screen), downscaled for the README.
const poster = timeline.find((t) => t.id === '05-impor') ?? timeline[0];
const at = poster.start + poster.dur - 2.5;
execFileSync(
  'ffmpeg',
  ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(at), '-i', mp4, '-frames:v', '1', '-vf', 'scale=1280:-1', '-q:v', '3', path.join(OUT, 'poster.jpg')],
  { stdio: 'inherit' },
);
console.log('wrote poster.jpg');
