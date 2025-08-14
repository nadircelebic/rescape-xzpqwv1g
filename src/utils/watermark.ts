// src/utils/watermark.ts
export async function applyWatermark(file: File, logoUrl: string, opacity = 0.85): Promise<Blob> {
  const baseImg = await readAsImage(file);
  const logoImg = await loadImage(logoUrl); // mora biti sa istog domena (npr. /watermark.png)

  // (opciono) smanji ogromne fotke da fajl bude razuman
  const MAX_W = 2800;
  const scale = baseImg.width > MAX_W ? MAX_W / baseImg.width : 1;
  const W = Math.round(baseImg.width * scale);
  const H = Math.round(baseImg.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(baseImg, 0, 0, W, H);

  // logo ~25% širine fotke, padding 2%
  const targetW = Math.round(W * 0.25);
  const ratio = targetW / logoImg.width;
  const targetH = Math.round(logoImg.height * ratio);
  const pad = Math.round(Math.min(W, H) * 0.02);
  const x = W - targetW - pad;
  const y = H - targetH - pad;

  ctx.globalAlpha = 0.28;           // tamna “podloga” da logo bude čitljiv
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 10, y - 10, targetW + 20, targetH + 20);

  ctx.globalAlpha = opacity;        // sam logo
  ctx.drawImage(logoImg, x, y, targetW, targetH);
  ctx.globalAlpha = 1;

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92) // vraćamo JPEG
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
