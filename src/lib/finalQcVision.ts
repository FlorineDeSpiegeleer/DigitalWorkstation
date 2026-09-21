// Modulaire eindcontrole: in plaats van vaste, hardgecodeerde pixelposities
// (die zouden breken zodra de camera verplaatst wordt), vergelijkt dit
// systeem telkens de HUIDIGE foto met een REFERENTIEFOTO die de operator
// zelf vanuit de website heeft vastgelegd en ingedeeld in zones. Verhuist
// de camera? Gewoon opnieuw kalibreren — geen nieuwe versie van de site
// nodig.

export type ProductKey = 'product1' | 'product2';

export type ZoneCheckType =
  // Er MOET een bepaalde (donkere/gekleurde) vorm aanwezig zijn in deze
  // zone, zoals bij een wiel of het handvat — vergeleken met hoeveel van
  // diezelfde kleur er in de referentiezone aanwezig was.
  | 'presence'
  // De rand van het profiel (het contrast tussen metaal en achtergrond)
  // moet zich ongeveer op dezelfde plek bevinden als in de referentie —
  // gebruikt voor "staan de profielen correct uitgelijnd".
  | 'edge-position';

export interface QcZone {
  id: string;
  label: string;
  type: ZoneCheckType;
  // Positie/afmeting als fractie (0–1) van de volledige foto, dus
  // onafhankelijk van de effectieve resolutie of cameraverplaatsing
  // zolang er opnieuw gekalibreerd wordt.
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QcReference {
  product: ProductKey;
  imageDataUrl: string;
  zones: QcZone[];
  capturedAt: number;
}

export interface ZoneResult {
  zoneId: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface QcCompareResult {
  passed: boolean;
  zoneResults: ZoneResult[];
}

const REFERENCE_KEY_PREFIX = 'sirris_qc_reference_';

export function saveReference(reference: QcReference): void {
  localStorage.setItem(
    REFERENCE_KEY_PREFIX + reference.product,
    JSON.stringify(reference)
  );
}

export function loadReference(product: ProductKey): QcReference | null {
  try {
    const raw = localStorage.getItem(REFERENCE_KEY_PREFIX + product);
    if (!raw) return null;
    return JSON.parse(raw) as QcReference;
  } catch {
    return null;
  }
}

export function clearReference(product: ProductKey): void {
  localStorage.removeItem(REFERENCE_KEY_PREFIX + product);
}

// --- Interne hulpfuncties -------------------------------------------------

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Afbeelding kon niet gelezen worden.'));
    image.src = dataUrl;
  });
  return image;
}

function drawToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Beeldanalyse kon niet worden gestart.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Aandeel "donkere" pixels (lage helderheid = typisch rubber/kunststof
// onderdeel tegenover het lichte aluminium/hout op de achtergrond) binnen
// een zone. Gebruikt voor de 'presence'-check.
function darkPixelFraction(
  canvas: HTMLCanvasElement,
  zone: QcZone
): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const px = Math.round(zone.x * canvas.width);
  const py = Math.round(zone.y * canvas.height);
  const pw = Math.max(1, Math.round(zone.width * canvas.width));
  const ph = Math.max(1, Math.round(zone.height * canvas.height));

  const data = ctx.getImageData(px, py, pw, ph).data;
  let dark = 0;
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3 / 255;
    if (brightness < 0.35) dark++;
    total++;
  }

  return total > 0 ? dark / total : 0;
}

// Zoekt de sterkste verticale of horizontale rand (grootste
// helderheidssprong tussen naburige pixels) binnen een zone, en geeft de
// positie ervan terug als fractie van de zone-breedte/hoogte. Gebruikt
// voor de 'edge-position'-check (profieluitlijning).
function findEdgePosition(
  canvas: HTMLCanvasElement,
  zone: QcZone,
  direction: 'horizontal' | 'vertical'
): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const px = Math.round(zone.x * canvas.width);
  const py = Math.round(zone.y * canvas.height);
  const pw = Math.max(2, Math.round(zone.width * canvas.width));
  const ph = Math.max(2, Math.round(zone.height * canvas.height));

  const data = ctx.getImageData(px, py, pw, ph).data;

  const brightnessAt = (x: number, y: number) => {
    const i = (y * pw + x) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };

  let bestScore = -1;
  let bestPos = 0.5;

  if (direction === 'vertical') {
    // Zoek de sterkste sprong terwijl we van links naar rechts gaan
    // (gemiddeld over alle rijen), voor een rand die verticaal loopt.
    for (let x = 1; x < pw; x++) {
      let score = 0;
      for (let y = 0; y < ph; y += Math.max(1, Math.floor(ph / 30))) {
        score += Math.abs(brightnessAt(x, y) - brightnessAt(x - 1, y));
      }
      if (score > bestScore) {
        bestScore = score;
        bestPos = x / pw;
      }
    }
  } else {
    for (let y = 1; y < ph; y++) {
      let score = 0;
      for (let x = 0; x < pw; x += Math.max(1, Math.floor(pw / 30))) {
        score += Math.abs(brightnessAt(x, y) - brightnessAt(x, y - 1));
      }
      if (score > bestScore) {
        bestScore = score;
        bestPos = y / ph;
      }
    }
  }

  return bestPos;
}

// Hoeveel een zone van "vierkant" afwijkt (breed vs. hoog) bepaalt welke
// randrichting het meest zinvol is om te meten.
function edgeDirectionFor(zone: QcZone): 'horizontal' | 'vertical' {
  return zone.width >= zone.height ? 'vertical' : 'horizontal';
}

const PRESENCE_MIN_FRACTION = 0.15; // minstens dit aandeel donkere pixels = onderdeel aanwezig
const EDGE_TOLERANCE_FRACTION = 0.12; // toegelaten afwijking t.o.v. de referentiepositie

// --- Publieke vergelijkingsfunctie ----------------------------------------

export async function compareAgainstReference(
  currentDataUrl: string,
  reference: QcReference
): Promise<QcCompareResult> {
  const [refImage, curImage] = await Promise.all([
    loadImage(reference.imageDataUrl),
    loadImage(currentDataUrl),
  ]);

  const refCanvas = drawToCanvas(refImage);
  const curCanvas = drawToCanvas(curImage);

  const zoneResults: ZoneResult[] = reference.zones.map((zone) => {
    if (zone.type === 'presence') {
      const refFraction = darkPixelFraction(refCanvas, zone);
      const curFraction = darkPixelFraction(curCanvas, zone);

      // De referentie zelf toont het onderdeel aanwezig — dus vergelijken
      // we of de huidige foto ongeveer evenveel "donker" laat zien.
      const passed =
        refFraction < PRESENCE_MIN_FRACTION ||
        curFraction >= refFraction * 0.5;

      return {
        zoneId: zone.id,
        label: zone.label,
        passed,
        detail: passed
          ? 'Onderdeel aanwezig'
          : `Onderdeel lijkt te ontbreken (${(curFraction * 100).toFixed(0)}% t.o.v. ${(refFraction * 100).toFixed(0)}% in de referentie)`,
      };
    }

    // edge-position
    const direction = edgeDirectionFor(zone);
    const refPos = findEdgePosition(refCanvas, zone, direction);
    const curPos = findEdgePosition(curCanvas, zone, direction);
    const deviation = Math.abs(curPos - refPos);
    const passed = deviation <= EDGE_TOLERANCE_FRACTION;

    return {
      zoneId: zone.id,
      label: zone.label,
      passed,
      detail: passed
        ? 'Profiel correct uitgelijnd'
        : `Profielrand ${(deviation * 100).toFixed(0)}% verschoven t.o.v. de referentiepositie`,
    };
  });

  return {
    passed: zoneResults.every((z) => z.passed),
    zoneResults,
  };
}
