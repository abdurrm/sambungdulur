/** Adaptive threshold and long table-rule removal. The original source is never modified. */
export function prepareScan(canvas: HTMLCanvasElement, deskew = true): HTMLCanvasElement {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.getImageData(0, 0, w, h);
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(image.data[i*4]*.299 + image.data[i*4+1]*.587 + image.data[i*4+2]*.114);
  const stride = w + 1;
  const integral = new Float64Array((w+1)*(h+1));
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) { sum += gray[y*w+x]; integral[(y+1)*stride+x+1] = integral[y*stride+x+1]+sum; }
  }
  const ink = new Uint8Array(w*h);
  const radius = 17;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0,x-radius), x1 = Math.min(w,x+radius+1), y0 = Math.max(0,y-radius), y1 = Math.min(h,y+radius+1);
    const mean = (integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0])/((x1-x0)*(y1-y0));
    ink[y*w+x] = gray[y*w+x] < mean-15 ? 1 : 0;
  }
  if (deskew) {
    const points: number[] = [];
    for (let y = Math.floor(h*.15); y < h*.8; y += 3) for (let x = Math.floor(w*.03); x < w*.97; x += 3) if (ink[y*w+x]) points.push(x,y);
    let best = 0, bestScore = -1;
    for (let step = -12; step <= 12; step++) {
      const angle = step * Math.PI / 720; // quarter-degree steps, at most three degrees
      const histogram = new Uint32Array(Math.ceil(h+w*.12));
      for (let i = 0; i < points.length; i += 2) {
        const bin = Math.floor((points[i+1] + Math.tan(angle)*(points[i]-w/2)+w*.06)/2);
        if (bin >= 0 && bin < histogram.length) histogram[bin]++;
      }
      let score = 0;
      for (const n of histogram) score += n*n;
      if (score > bestScore) { best = angle; bestScore = score; }
    }
    if (Math.abs(best) > .002) {
      const out = document.createElement('canvas'); out.width = w; out.height = h;
      const context = out.getContext('2d')!;
      context.fillStyle = 'white'; context.fillRect(0,0,w,h);
      context.translate(w/2,h/2); context.rotate(best); context.drawImage(canvas,-w/2,-h/2);
      return prepareScan(out,false);
    }
  }
  const rules = new Uint8Array(w*h);
  const horizontal = Math.max(60, Math.round(w/40)), vertical = Math.max(30,Math.round(h/50));
  for (let y = 0; y < h; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      if (x < w && ink[y*w+x]) { if (start < 0) start = x; }
      else if (start >= 0) { if (x-start >= horizontal) rules.fill(1,y*w+start,y*w+x); start = -1; }
    }
  }
  for (let x = 0; x < w; x++) {
    let start = -1;
    for (let y = 0; y <= h; y++) {
      if (y < h && ink[y*w+x]) { if (start < 0) start = y; }
      else if (start >= 0) { if (y-start >= vertical) for (let p = start; p < y; p++) rules[p*w+x] = 1; start = -1; }
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let rule = false;
    for (let dy = -1; dy <= 1 && !rule; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (y+dy >= 0 && y+dy < h && x+dx >= 0 && x+dx < w && rules[(y+dy)*w+x+dx]) { rule = true; break; }
    }
    const value = ink[y*w+x] && !rule ? 0 : 255;
    const i = (y*w+x)*4; image.data[i] = image.data[i+1] = image.data[i+2] = value; image.data[i+3] = 255;
  }
  ctx.putImageData(image,0,0);
  return canvas;
}
