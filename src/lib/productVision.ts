// Modulaire eindcontrole: vergelijkt een live webcam-opname met een
// referentiefoto die de operator zelf in de website vastlegt (zie
// ProductCalibrationScreen). Geen enkele pixelpositie staat hardcoded in
// de code — verplaats je de camera, dan herkalibreer je gewoon opnieuw via
// de website, zonder dat hier iets moet aangepast worden.
//
// NIEUW: naast de referentiefoto legt de operator ook een vierhoekige
// AFBAKENING vast (4 hoekpunten rond het product zelf). Bij elke controle
// wordt exact dat gebied via een perspective transform "rechtgetrokken"
// en vergeleken — alles buiten die afbakening (mallen, bakken, achtergrond)
// telt niet mee. Zonder dit werd de hele foto vergeleken, wat gevoelig was
// voor alles wat toevallig ook in beeld staat.

export type ProductKey = 'product1' | 'product2';

// Een punt, genormaliseerd (0–1) t.o.v. de breedte/hoogte van het beeld
// waarin het werd aangeduid. Genormaliseerd opslaan (i.p.v. absolute
// pixels) betekent dat de afbakening correct blijft ongeacht de exacte
// resolutie van een latere foto, zolang de camera niet verplaatst is.
export interface NormalizedPoint {
  x: number;
  y: number;
}

// Linksboven, rechtsboven, rechtsonder, linksonder — in die vaste volgorde.
export type CalibrationRegion = [
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
];

const REFERENCE_PREFIX = 'sirris_product_reference_';
const REGION_PREFIX = 'sirris_product_region_';

export function getReferenceImage(product: ProductKey): string | null {
  try {
    return localStorage.getItem(REFERENCE_PREFIX + product);
  } catch {
    return null;
  }
}

export function hasReferenceImage(product: ProductKey): boolean {
  return Boolean(getReferenceImage(product));
}

export function saveReferenceImage(product: ProductKey, dataUrl: string): void {
  try {
    localStorage.setItem(REFERENCE_PREFIX + product, dataUrl);
  } catch {
    // Als lokale opslag niet beschikbaar is, blijft kalibreren onmogelijk
    // maar de rest van de app blijft gewoon werken.
  }
}

export function clearReferenceImage(product: ProductKey): void {
  try {
    localStorage.removeItem(REFERENCE_PREFIX + product);
    localStorage.removeItem(REGION_PREFIX + product);
  } catch {
    // negeren
  }
}

export function getCalibrationRegion(product: ProductKey): CalibrationRegion | null {
  try {
    const raw = localStorage.getItem(REGION_PREFIX + product);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 4) {
      return parsed as CalibrationRegion;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasCalibrationRegion(product: ProductKey): boolean {
  return Boolean(getCalibrationRegion(product));
}

export function saveCalibrationRegion(product: ProductKey, region: CalibrationRegion): void {
  try {
    localStorage.setItem(REGION_PREFIX + product, JSON.stringify(region));
  } catch {
    // negeren — zie saveReferenceImage
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

// Raster waarin het RECHTGETROKKEN gebied wordt opgedeeld om lokale
// afwijkingen te kunnen aanwijzen (bv. "een profiel dat verkeerd ligt"
// beïnvloedt maar één of twee zones, terwijl een globale vergelijking dat
// zou uitmiddelen).
const GRID_COLS = 4;
const GRID_ROWS = 3;
const ROW_LABELS = ['boven', 'midden', 'onder'];
const COL_LABELS = ['links', 'midden-links', 'midden-rechts', 'rechts'];

// Vaste vergelijkingsresolutie voor het rechtgetrokken gebied, zodat
// kleine verschillen in camera-resolutie tussen kalibratiemoment en
// latere controles geen probleem zijn.
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

// ---------- Perspective transform (homografie) ----------
//
// Lost de 3x3-homografie H op die een punt in "dst"-ruimte (het
// rechtgetrokken, rechthoekige uitvoerbeeld) afbeeldt op het
// corresponderende punt in "src"-ruimte (de originele, scheve afbakening
// in de foto). Met die matrix wordt voor élke pixel van het
// uitvoerbeeld precies berekend uit welke pixel van de bronfoto hij
// moet worden gehaald — dat is de kern van een perspective transform.
function solveHomography(
  dstPts: NormalizedPoint[],
  srcPts: NormalizedPoint[]
): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = dstPts[i];
    const { x: u, y: v } = srcPts[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  // Gauss-eliminatie met partial pivoting op het 8x8-stelsel.
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    }
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k < n; k++) A[row][k] -= factor * A[col][k];
      b[row] -= factor * b[col];
    }
  }

  const h = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) sum -= A[row][k] * h[k];
    h[row] = sum / A[row][row];
  }

  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function applyHomography(H: number[], x: number, y: number): NormalizedPoint {
  const w = H[6] * x + H[7] * y + H[8];
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

// Trekt het vierhoekige gebied "region" (genormaliseerd t.o.v. het
// volledige bronbeeld) uit "img" recht tot een vast COMPARE_WIDTH ×
// COMPARE_HEIGHT rechthoekig beeld, en geeft de ruwe pixeldata terug.
// Alles buiten de afbakening wordt hierbij automatisch weggesneden.
function warpRegionToRect(
  img: HTMLImageElement,
  region: CalibrationRegion
): Uint8ClampedArray {
  // Eerst het volledige bronbeeld op canvas zetten zodat we er pixels
  // uit kunnen lezen.
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.naturalWidth || img.width;
  srcCanvas.height = img.naturalHeight || img.height;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) throw new Error('Beeldanalyse kon niet worden gestart.');
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;

  // De afbakening is genormaliseerd (0–1) — omzetten naar absolute
  // pixelposities IN DIT SPECIFIEKE bronbeeld.
  const srcPts = region.map((p) => ({ x: p.x * srcW, y: p.y * srcH }));

  // De 4 hoeken van het rechte uitvoerbeeld.
  const dstPts: NormalizedPoint[] = [
    { x: 0, y: 0 },
    { x: COMPARE_WIDTH, y: 0 },
    { x: COMPARE_WIDTH, y: COMPARE_HEIGHT },
    { x: 0, y: COMPARE_HEIGHT },
  ];

  // We lossen de afbeelding DST -> SRC op (niet SRC -> DST), want om elke
  // pixel van het rechte uitvoerbeeld te vullen moeten we net weten uit
  // welke (scheve) brompixel hij moet komen — dat is de omgekeerde
  // richting van een "gewone" perspectief-tekening.
  const H = solveHomography(dstPts, srcPts);

  const out = new Uint8ClampedArray(COMPARE_WIDTH * COMPARE_HEIGHT * 4);

  for (let dy = 0; dy < COMPARE_HEIGHT; dy++) {
    for (let dx = 0; dx < COMPARE_WIDTH; dx++) {
      const { x: sx, y: sy } = applyHomography(H, dx, dy);

      // Bilineaire interpolatie voor een vloeiender resultaat dan gewoon
      // afronden naar de dichtstbijzijnde pixel.
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const fx = sx - x0;
      const fy = sy - y0;

      const outIdx = (dy * COMPARE_WIDTH + dx) * 4;

      if (x0 < 0 || y0 < 0 || x1 >= srcW || y1 >= srcH) {
        // Buiten het bronbeeld (kan gebeuren als de afbakening net tot de
        // rand van de foto reikt) — zwart invullen.
        out[outIdx] = 0;
        out[outIdx + 1] = 0;
        out[outIdx + 2] = 0;
        out[outIdx + 3] = 255;
        continue;
      }

      for (let channel = 0; channel < 3; channel++) {
        const p00 = srcData[(y0 * srcW + x0) * 4 + channel];
        const p10 = srcData[(y0 * srcW + x1) * 4 + channel];
        const p01 = srcData[(y1 * srcW + x0) * 4 + channel];
        const p11 = srcData[(y1 * srcW + x1) * 4 + channel];

        const top = p00 * (1 - fx) + p10 * fx;
        const bottom = p01 * (1 - fx) + p11 * fx;
        out[outIdx + channel] = top * (1 - fy) + bottom * fy;
      }
      out[outIdx + 3] = 255;
    }
  }

  return out;
}

export async function analyseProductPhoto(
  liveDataUrl: string,
  product: ProductKey
): Promise<ProductVisionResult> {
  const productLabel = product === 'product1' ? 'Product 1' : 'Product 2';

  const referenceDataUrl = getReferenceImage(product);
  if (!referenceDataUrl) {
    throw new Error(
      `Geen referentiefoto ingesteld voor ${productLabel}. Ga naar Instellingen > Kalibratie om er een vast te leggen.`
    );
  }

  const region = getCalibrationRegion(product);
  if (!region) {
    throw new Error(
      `Geen afbakening ingesteld voor ${productLabel}. Ga naar Instellingen > Kalibratie en teken eerst het te controleren gebied.`
    );
  }

  const [liveImg, refImg] = await Promise.all([
    loadImage(liveDataUrl),
    loadImage(referenceDataUrl),
  ]);

  // NIEUW: niet langer de hele foto vergelijken, maar enkel het
  // afgebakende gebied — rechtgetrokken via een perspective transform.
  // Alles buiten de afbakening (mallen, bakken, achtergrond) wordt
  // hierdoor automatisch genegeerd.
  const liveData = warpRegionToRect(liveImg, region);
  const refData = warpRegionToRect(refImg, region);

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
