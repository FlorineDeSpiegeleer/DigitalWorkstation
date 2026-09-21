// Modulaire eindcontrole: vergelijkt een live webcam-opname met een
// referentiefoto die de operator zelf in de website vastlegt (zie
// ProductCalibrationScreen). Geen enkele pixelpositie staat hardcoded in
// de code — verplaats je de camera, dan herkalibreer je gewoon opnieuw via
// de website, zonder dat hier iets moet aangepast worden.

export type ProductKey = 'product1' | 'product2';

const STORAGE_PREFIX = 'sirris_product_reference_';

export function getReferenceImage(product: ProductKey): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + product);
  } catch {
    return null;
  }
}

export function hasReferenceImage(product: ProductKey): boolean {
  return Boolean(getReferenceImage(product));
}

export function saveReferenceImage(product: ProductKey, dataUrl: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + product, dataUrl);
  } catch {
    // Als lokale opslag niet beschikbaar is, blijft kalibreren onmogelijk
    // maar de rest van de app blijft gewoon werken.
  }
}

export function clearReferenceImage(product: ProductKey): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + product);
  } catch {
    // negeren
  }
}

export interface RegionDeviation {
  row: number;
  col: number;
  label: string;
  diffPercent: number;
}

export interface ProductVisionResult {
  status: 'ok' | 'error';
  overallDiffPercent: number;
  // De zones die het meest afwijken van de referentie, aflopend gesorteerd.
  // Leeg bij een geslaagde controle.
  worstRegions: RegionDeviation[];
}

// Raster waarin het beeld wordt opgedeeld om lokale afwijkingen te kunnen
// aanwijzen (bv. "een profiel dat verkeerd ligt" beïnvloedt maar één of
// twee zones, terwijl een globale vergelijking dat zou uitmiddelen).
const GRID_COLS = 4;
const GRID_ROWS = 3;
const ROW_LABELS = ['boven', 'midden', 'onder'];
const COL_LABELS = ['links', 'midden-links', 'midden-rechts', 'rechts'];

// Vaste vergelijkingsresolutie, zodat kleine verschillen in camera-
// resolutie tussen kalibratiemoment en latere controles geen probleem zijn.
const COMPARE_WIDTH = 640;
const COMPARE_HEIGHT = 480;

// LET OP: deze drempelwaarde is een startpunt, geen exacte wetenschap.
// Test met echte foto's (goed gemonteerd vs. bewust verkeerd) en stel bij
// via DEVIATION_THRESHOLD_PERCENT indien nodig — te laag geeft valse
// afkeuringen door lichtverschillen, te hoog mist echte fouten.
export const DEVIATION_THRESHOLD_PERCENT = 12;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Afbeelding kon niet worden gelezen.'));
    img.src = dataUrl;
  });
}

function toComparableImageData(img: HTMLImageElement): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = COMPARE_WIDTH;
  canvas.height = COMPARE_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Beeldanalyse kon niet worden gestart.');
  ctx.drawImage(img, 0, 0, COMPARE_WIDTH, COMPARE_HEIGHT);
  return ctx.getImageData(0, 0, COMPARE_WIDTH, COMPARE_HEIGHT).data;
}

export async function analyseProductPhoto(
  liveDataUrl: string,
  product: ProductKey
): Promise<ProductVisionResult> {
  const referenceDataUrl = getReferenceImage(product);

  if (!referenceDataUrl) {
    const productLabel = product === 'product1' ? 'Product 1' : 'Product 2';
    throw new Error(
      `Geen referentiefoto ingesteld voor ${productLabel}. Ga naar Instellingen > Kalibratie om er een vast te leggen.`
    );
  }

  const [liveImg, refImg] = await Promise.all([
    loadImage(liveDataUrl),
    loadImage(referenceDataUrl),
  ]);

  const liveData = toComparableImageData(liveImg);
  const refData = toComparableImageData(refImg);

  const cellWidth = Math.floor(COMPARE_WIDTH / GRID_COLS);
  const cellHeight = Math.floor(COMPARE_HEIGHT / GRID_ROWS);

  const deviations: RegionDeviation[] = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const startX = col * cellWidth;
      const startY = row * cellHeight;
      const endX = col === GRID_COLS - 1 ? COMPARE_WIDTH : startX + cellWidth;
      const endY = row === GRID_ROWS - 1 ? COMPARE_HEIGHT : startY + cellHeight;

      let diffSum = 0;
      let pixelCount = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * COMPARE_WIDTH + x) * 4;

          // Helderheid (luma) i.p.v. losse RGB-kanalen: minder gevoelig
          // voor kleine belichtingsverschillen tussen kalibratie en
          // controle, maar reageert nog steeds duidelijk op een profiel
          // dat er wel/niet staat of verschoven is.
          const liveLuma =
            0.299 * liveData[idx] + 0.587 * liveData[idx + 1] + 0.114 * liveData[idx + 2];
          const refLuma =
            0.299 * refData[idx] + 0.587 * refData[idx + 1] + 0.114 * refData[idx + 2];

          diffSum += Math.abs(liveLuma - refLuma);
          pixelCount++;
        }
      }

      const avgDiff = pixelCount > 0 ? diffSum / pixelCount : 0;
      const diffPercent = (avgDiff / 255) * 100;

      deviations.push({
        row,
        col,
        label: `${ROW_LABELS[row]} ${COL_LABELS[col]}`,
        diffPercent,
      });
    }
  }

  const overallDiffPercent =
    deviations.reduce((sum, d) => sum + d.diffPercent, 0) / deviations.length;

  const worstRegions = [...deviations]
    .filter((d) => d.diffPercent > DEVIATION_THRESHOLD_PERCENT)
    .sort((a, b) => b.diffPercent - a.diffPercent)
    .slice(0, 3);

  return {
    status: worstRegions.length > 0 ? 'error' : 'ok',
    overallDiffPercent,
    worstRegions,
  };
}
