import { useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, Trash2, VideoOff, RotateCcw, Crop } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';
import {
  getReferenceImage,
  saveReferenceImage,
  clearReferenceImage,
  getCalibrationRegion,
  saveCalibrationRegion,
  type ProductKey,
  type NormalizedPoint,
  type CalibrationRegion,
} from '../lib/productVision';

interface Props {
  operatorSettings: {
    operatorName: string;
    line: string;
    station: string;
  };
  onBack: () => void;
}

// Zelfde voorkeurscamera als de andere controles, zodat kalibreren en
// effectief controleren altijd via dezelfde, vast gemonteerde camera
// gebeurt.
const PREFERRED_CAMERA_PATTERN = /c270/i;

const CORNER_LABELS = ['linksboven', 'rechtsboven', 'rechtsonder', 'linksonder'];

// Berekent, gegeven een klik/tik op het scherm en het element waarop
// object-contain toegepast wordt (video of foto), de genormaliseerde
// (0–1) positie t.o.v. de ECHTE inhoud — dus met eventuele zwarte
// randen (letterboxing) er correct uitgerekend. Zonder dit zouden
// aangeduide punten verschuiven telkens de camera-verhouding niet exact
// het kader vult.
function toNormalizedPoint(
  event: { clientX: number; clientY: number },
  container: HTMLElement,
  contentWidth: number,
  contentHeight: number
): NormalizedPoint | null {
  const rect = container.getBoundingClientRect();
  const containerAspect = rect.width / rect.height;
  const contentAspect = contentWidth / contentHeight;

  let renderedWidth = rect.width;
  let renderedHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (contentAspect > containerAspect) {
    // Inhoud is relatief breder dan het kader: vult de volledige
    // breedte, zwarte balken boven/onder.
    renderedHeight = rect.width / contentAspect;
    offsetY = (rect.height - renderedHeight) / 2;
  } else {
    // Inhoud is relatief hoger: vult de volledige hoogte, zwarte balken
    // links/rechts.
    renderedWidth = rect.height * contentAspect;
    offsetX = (rect.width - renderedWidth) / 2;
  }

  const clickX = event.clientX - rect.left - offsetX;
  const clickY = event.clientY - rect.top - offsetY;

  if (clickX < 0 || clickY < 0 || clickX > renderedWidth || clickY > renderedHeight) {
    // Geklikt in de zwarte rand, niet op de eigenlijke inhoud.
    return null;
  }

  return {
    x: clickX / renderedWidth,
    y: clickY / renderedHeight,
  };
}

// Zet een reeks genormaliseerde punten om naar een SVG-polygon-string
// (in procenten van een 0–100 viewBox).
function pointsToPolygon(points: NormalizedPoint[]): string {
  return points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
}

export function ProductCalibrationScreen({ operatorSettings, onBack }: Props) {
  const [product, setProduct] = useState<ProductKey>('product1');
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState('');
  const [referencePreview, setReferencePreview] = useState<string | null>(
    getReferenceImage('product1')
  );
  const [savedRegion, setSavedRegion] = useState<CalibrationRegion | null>(
    getCalibrationRegion('product1')
  );
  const [justSaved, setJustSaved] = useState(false);

  // NIEUW: de 4 hoekpunten die de operator nu aan het aanduiden is (nog
  // niet bevestigd/opgeslagen). Leeg = nog niets aangeduid.
  const [draftPoints, setDraftPoints] = useState<NormalizedPoint[]>([]);
  const [regionConfirmed, setRegionConfirmed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    stopCamera();
    setStatus('starting');
    setErrorMessage('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Deze browser ondersteunt geen cameratoegang.');
      }

      let videoInputCount = 2;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoInputCount = devices.filter((d) => d.kind === 'videoinput').length;
      } catch {
        // Kon niet vooraf tellen: gewoon de volledige, veilige route volgen.
      }

      let stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      if (videoInputCount > 1) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const preferred = devices.find(
            (d) => d.kind === 'videoinput' && PREFERRED_CAMERA_PATTERN.test(d.label)
          );
          const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId;

          if (preferred && preferred.deviceId !== activeId) {
            stream.getTracks().forEach((track) => track.stop());
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: preferred.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
              audio: false,
            });
          }
        } catch {
          // Voorkeurscamera niet gevonden: gewoon de al actieve camera gebruiken.
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('live');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Camera kon niet geopend worden.';
      setErrorMessage(message);
      setStatus('error');
    }
  };

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setReferencePreview(getReferenceImage(product));
    setSavedRegion(getCalibrationRegion(product));
    setJustSaved(false);
    setDraftPoints([]);
    setRegionConfirmed(false);
  }, [product]);

  // NIEUW: klik/tik op het live camerabeeld voegt een hoekpunt toe (in
  // vaste volgorde: linksboven, rechtsboven, rechtsonder, linksonder).
  const handleVideoClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (status !== 'live' || regionConfirmed || draftPoints.length >= 4) return;
    const video = videoRef.current;
    const container = videoContainerRef.current;
    if (!video || !container || video.videoWidth === 0) return;

    const point = toNormalizedPoint(event, container, video.videoWidth, video.videoHeight);
    if (!point) return;

    setDraftPoints((prev) => [...prev, point]);
  };

  const handleResetPoints = () => {
    setDraftPoints([]);
    setRegionConfirmed(false);
  };

  const handleConfirmRegion = () => {
    if (draftPoints.length !== 4) return;
    setRegionConfirmed(true);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    if (!regionConfirmed || draftPoints.length !== 4) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    const region = draftPoints as CalibrationRegion;
    saveReferenceImage(product, dataUrl);
    saveCalibrationRegion(product, region);

    setReferencePreview(dataUrl);
    setSavedRegion(region);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 3000);
  };

  const handleClear = () => {
    clearReferenceImage(product);
    setReferencePreview(null);
    setSavedRegion(null);
    setDraftPoints([]);
    setRegionConfirmed(false);
  };

  // "Afbakening wijzigen": laat toe om, met behoud van de bestaande
  // referentiefoto, enkel de afbakening opnieuw te tekenen op het live
  // beeld. Pas bij "Vastleggen als referentie" wordt alles (foto + regio)
  // effectief overschreven.
  const handleRedrawRegion = () => {
    setDraftPoints([]);
    setRegionConfirmed(false);
  };

  const productLabel = product === 'product1' ? 'Product 1' : 'Product 2';

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden">
      <IndustrialHeader
        title="Kalibratie eindcontrole"
        subtitle="Afbakening en referentiefoto's voor de automatische productcontrole"
        operatorSettings={operatorSettings}
        onBack={onBack}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-8">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-5">
            <p className="text-sm text-blue-800 leading-relaxed">
              Duid eerst met <strong>4 klikken</strong> het gebied aan dat gecontroleerd moet
              worden — linksboven, rechtsboven, rechtsonder, linksonder, rond het product zelf
              (niet de mallen, bakken of achtergrond erachter). Bevestig die afbakening, en leg
              dan pas de referentiefoto van een <strong>correct en volledig afgewerkt
              exemplaar</strong> vast. Bij elke controle wordt voortaan enkel dat exacte gebied
              bekeken — alles erbuiten telt niet mee.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProduct('product1')}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                product === 'product1'
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="block font-bold text-sm">Product 1</span>
            </button>
            <button
              type="button"
              onClick={() => setProduct('product2')}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                product === 'product2'
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="block font-bold text-sm">Product 2</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                  Live camerabeeld
                </h3>
                {status === 'live' && !regionConfirmed && (
                  <span className="text-xs font-bold text-blue-700">
                    {draftPoints.length < 4
                      ? `Klik: ${CORNER_LABELS[draftPoints.length]} (${draftPoints.length}/4)`
                      : 'Klaar om te bevestigen'}
                  </span>
                )}
              </div>

              <div
                ref={videoContainerRef}
                onClick={handleVideoClick}
                className={`relative overflow-hidden rounded-xl bg-slate-950 aspect-video flex items-center justify-center ${
                  status === 'live' && !regionConfirmed ? 'cursor-crosshair' : ''
                }`}
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-contain ${
                    status === 'live' ? 'block' : 'hidden'
                  }`}
                />

                {status === 'live' && draftPoints.length > 0 && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {draftPoints.length >= 2 && (
                      <polygon
                        points={pointsToPolygon(draftPoints)}
                        fill="rgba(37, 99, 235, 0.2)"
                        stroke="#2563EB"
                        strokeWidth="0.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {draftPoints.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x * 100}
                        cy={p.y * 100}
                        r="1.2"
                        fill="#2563EB"
                        stroke="white"
                        strokeWidth="0.4"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                )}

                {status === 'starting' && (
                  <div className="text-center text-white p-6">
                    <Camera className="w-10 h-10 mx-auto mb-2 text-blue-400 animate-pulse" />
                    <p className="text-sm font-bold">Webcam openen…</p>
                  </div>
                )}

                {status === 'error' && (
                  <div className="text-center text-white p-6">
                    <VideoOff className="w-10 h-10 mx-auto mb-2 text-red-400" />
                    <p className="text-sm font-bold mb-3">{errorMessage}</p>
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="bg-white text-slate-800 rounded-lg px-4 py-2 text-xs font-bold inline-flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Opnieuw proberen
                    </button>
                  </div>
                )}
              </div>

              {status === 'live' && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetPoints}
                    disabled={draftPoints.length === 0}
                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Opnieuw tekenen
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRegion}
                    disabled={draftPoints.length !== 4 || regionConfirmed}
                    className="flex-1 py-2.5 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 disabled:opacity-40 disabled:bg-gray-100 disabled:text-gray-400 font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    {regionConfirmed ? 'Afbakening bevestigd' : 'Afbakening bevestigen'}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleCapture}
                disabled={status !== 'live' || !regionConfirmed}
                className="mt-2 w-full py-3.5 rounded-lg text-white font-bold text-sm flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
              >
                <Camera className="w-4 h-4" />
                Vastleggen als referentie voor {productLabel}
              </button>

              {justSaved && (
                <div className="mt-3 flex items-center gap-2 text-green-700 text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Afbakening en referentiefoto opgeslagen.
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">
                Huidige referentie — {productLabel}
              </h3>

              {referencePreview ? (
                <>
                  <div className="relative rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={referencePreview}
                      alt={`Referentie ${product}`}
                      className="w-full h-auto block"
                    />
                    {savedRegion && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <polygon
                          points={pointsToPolygon(savedRegion)}
                          fill="rgba(37, 99, 235, 0.15)"
                          stroke="#2563EB"
                          strokeWidth="0.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )}
                  </div>

                  {!savedRegion && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Deze referentiefoto heeft nog geen afbakening — leg opnieuw vast.
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRedrawRegion}
                      className="flex-1 py-2.5 rounded-lg text-blue-700 border border-blue-200 hover:bg-blue-50 font-medium text-sm flex items-center justify-center gap-2"
                    >
                      <Crop className="w-4 h-4" />
                      Afbakening wijzigen
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="flex-1 py-2.5 rounded-lg text-red-700 border border-red-200 hover:bg-red-50 font-medium text-sm flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Wissen
                    </button>
                  </div>
                </>
              ) : (
                <div className="aspect-video rounded-lg bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center text-center text-gray-400 text-sm p-6">
                  Nog geen referentiefoto ingesteld voor {productLabel}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
