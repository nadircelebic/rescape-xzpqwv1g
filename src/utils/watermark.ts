// src/utils/watermark.ts
export async function applyWatermark(file: File, logoUrl: string, opacity = 0.9): Promise<Blob> {
  const baseImg = await readAsImage(file);
  const logoImg = await loadImage(logoUrl); // /watermark.png ili import iz src/assets

  // Smanji veliku fotku da upload bude brži/stabilniji
  const MAX = 1600; // duža stranica max 1600px
  const k = Math.min(MAX / baseImg.width, MAX / baseImg.height, 1);
  const W = Math.round(baseImg.width * k);
  const H = Math.round(baseImg.height * k);

  const canv = document.createElement('canvas');
  canv.width = W; canv.height = H;
  const ctx = canv.getContext('2d')!;
  ctx.drawImage(baseImg, 0, 0, W, H);

  // logo ~25% širine, padding 2%
  const targetW = Math.round(W * 0.25);
  const ratio = targetW / logoImg.width;
  const targetH = Math.round(logoImg.height * ratio);
  const pad = Math.round(Math.min(W, H) * 0.02);
  const x = W - targetW - pad;
  const y = H - targetH - pad;

  // blaga podloga
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 10, y - 10, targetW + 20, targetH + 20);

  // logo
  ctx.globalAlpha = opacity;
  ctx.drawImage(logoImg, x, y, targetW, targetH);
  ctx.globalAlpha = 1;

  // JPEG 0.85 → još manji fajl
  return await new Promise<Blob>((resolve) =>
    canv.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
  );
}

function readAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => loadImage(fr.result as string).then(resolve).catch(reject);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
