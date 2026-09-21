export type MalProduct = 'product1' | 'product2';

export interface MalVisionResult {
  status: 'ok' | 'error';
  percentage: number;
}

// Zelfde grenswaarde en kleurregels als de bestaande CameraApp, zodat
// telefoon en vaste webcam dezelfde malcontrole uitvoeren.
export const MAL_COLOR_THRESHOLD_PERCENT = 0.02;

export async function analyseMalPhoto(
  dataUrl: string,
  product: MalProduct
): Promise<MalVisionResult> {
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('De controlefoto kon niet worden gelezen.'));
    image.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  if (!canvas.width || !canvas.height) {
    throw new Error('De controlefoto heeft geen geldige afmetingen.');
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Beeldanalyse kon niet worden gestart.');

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const zoneX = Math.floor(canvas.width * 0.15);
  const zoneY = Math.floor(canvas.height * 0.15);
  const zoneWidth = Math.max(1, Math.floor(canvas.width * 0.7));
  const zoneHeight = Math.max(1, Math.floor(canvas.height * 0.7));
  const pixels = ctx.getImageData(zoneX, zoneY, zoneWidth, zoneHeight).data;

  let detectedPixels = 0;
  let totalPixels = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] / 255;
    const g = pixels[i + 1] / 255;
    const b = pixels[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;

    if (delta !== 0) {
      if (max === r) {
        h = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        h = 60 * ((b - r) / delta + 2);
      } else {
        h = 60 * ((r - g) / delta + 4);
      }
    }

    if (h < 0) h += 360;

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    let isTargetColor = false;
    if (product === 'product1') {
      isTargetColor = h >= 190 && h <= 250 && s > 0.5 && v > 0.2;
    } else {
      isTargetColor = h >= 40 && h <= 70 && s > 0.5 && v > 0.3;
    }

    if (isTargetColor) detectedPixels++;
    totalPixels++;
  }

  const percentage = totalPixels > 0 ? (detectedPixels / totalPixels) * 100 : 0;

  return {
    status: percentage > MAL_COLOR_THRESHOLD_PERCENT ? 'error' : 'ok',
    percentage,
  };
}
