// src/utils/watermark.ts
export async function addWatermark(file: File, logoUrl: string): Promise<Blob> {
  // učitaj originalnu sliku
  const img = await loadImageFromFile(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  canvas.width = img.width
  canvas.height = img.height

  // nacrtaj original
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // učitaj logo
  const logo = await loadImage(logoUrl)

  // izračunaj veličinu i poziciju – ~25% širine slike, 8% margina
  const targetW = Math.floor(canvas.width * 0.25)
  const scale = targetW / logo.width
  const targetH = Math.floor(logo.height * scale)
  const margin = Math.floor(Math.min(canvas.width, canvas.height) * 0.08)
  const x = canvas.width - targetW - margin
  const y = canvas.height - targetH - margin

  // poluprovidna “podloga”
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#000'
  ctx.fillRect(x - 8, y - 8, targetW + 16, targetH + 16)

  // logo
  ctx.globalAlpha = 0.75
  ctx.drawImage(logo, x, y, targetW, targetH)
  ctx.globalAlpha = 1

  // vrati kao JPEG (manji fajl), može i image/png ako hoćeš bez kompresije
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.92)
  )
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => {
      loadImage(reader.result as string).then(res).catch(rej)
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}
