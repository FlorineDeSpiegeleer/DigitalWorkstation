import { useEffect, useRef, useState } from 'react';
import { Loader2, X, Check, ChevronRight, Camera as CameraIcon } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';
import { WorkstationWebcam } from './WorkstationWebcam';
import { CameraMode, NTFY_TOPIC } from '../main';
import {
  analyseProductPhoto,
  hasReferenceImage,
  hasCalibrationRegion,
  type ProductVisionResult,
} from '../lib/productVision';
import { postNtfyJson } from '../services/ntfy';

interface Props {
  onPass: () => void;
  onReject: () => void;
  elapsedTime: number;
  productName: string;
  operatorSettings: {
    operatorName: string;
    line: string;
    station: string;
  };
  cameraMode: CameraMode;
  onBack: () => void;
  onSettings?: () => void;
  // NIEUW: laat de operator, als er nog geen referentiefoto is, meteen
  // doorklikken naar het kalibratiescherm in plaats van vast te lopen.
  onOpenCalibration?: () => void;
}

type QCState = 'waiting' | 'result-pass' | 'result-fail';

interface CheckResult {
  product: string;
  status: 'ok' | 'error';
  percentage: number;
  context?: 'camera-check' | 'final-qc' | null;
  timestamp: number;
}

export function FinalQCScreen({
  onPass,
  onReject,
  elapsedTime,
  productName,
  operatorSettings,
  cameraMode,
  onBack,
  onSettings,
  onOpenCalibration,
}: Props) {
  const [state, setState] = useState<QCState>('waiting');
  const [webcamError, setWebcamError] = useState('');
  const [visionResult, setVisionResult] = useState<ProductVisionResult | null>(null);

  // Kleine tijdsmarge tussen telefoon en tablet.
  const lastSeenRef = useRef<number>(Date.now() - 10000);

  const expectedProduct =
    productName === 'Product 2' ? 'product2' : 'product1';

  const referenceMissing =
    cameraMode === 'webcam' &&
    (!hasReferenceImage(expectedProduct) || !hasCalibrationRegion(expectedProduct));

  // NIEUW: echte productcontrole — vergelijkt de automatisch genomen foto
  // met de referentiefoto die de operator zelf vastlegde in het
  // kalibratiescherm (zie ProductCalibrationScreen / lib/productVision).
  // Geen vaste pixelcoördinaten in de code: verplaats je de camera, dan
  // herkalibreer je gewoon opnieuw via Instellingen.
  const handleAnalyseFrame = async (dataUrl: string) => {
    setWebcamError('');

    try {
      const result = await analyseProductPhoto(dataUrl, expectedProduct);
      setVisionResult(result);

      const payload: CheckResult = {
        product: expectedProduct,
        status: result.status,
        percentage: result.overallDiffPercent,
        context: 'final-qc',
        timestamp: Date.now(),
      };

      try {
        localStorage.setItem('camera_check_result', JSON.stringify(payload));
      } catch {
        // De lokale beoordeling blijft werken als opslag niet beschikbaar is.
      }

      void postNtfyJson(NTFY_TOPIC, payload, {
        key: `qc:${payload.context}:${payload.product}`,
        dedupeMs: 3000,
      });

      lastSeenRef.current = payload.timestamp;
      setState(result.status === 'ok' ? 'result-pass' : 'result-fail');
    } catch (error) {
      setWebcamError(
        error instanceof Error ? error.message : 'De foto kon niet worden geanalyseerd.'
      );
    }
  };

  const handleResult = (data: CheckResult) => {
    if (!data?.timestamp) return;

    // Dit scherm mag alleen resultaten van de PRODUCTCONTROLE verwerken.
    if (data.context !== 'final-qc') return;

    if (data.product !== expectedProduct) return;

    if (data.timestamp <= lastSeenRef.current) return;

    lastSeenRef.current = data.timestamp;
    setState(data.status === 'ok' ? 'result-pass' : 'result-fail');
  };


  useEffect(() => {
    if (state !== 'waiting') return;

    const interval = window.setInterval(() => {
      try {
        const raw = localStorage.getItem('camera_check_result');
        if (!raw) return;
        handleResult(JSON.parse(raw));
      } catch {
        // Ongeldige data: blijven wachten.
      }
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, expectedProduct]);

  useEffect(() => {
    if (state !== 'waiting') return;

    let es: EventSource | null = null;

    try {
      es = new EventSource(`https://ntfy.sh/${NTFY_TOPIC}/sse`);

      es.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (!envelope?.message) return;
          handleResult(JSON.parse(envelope.message));
        } catch {
          // Ongeldig bericht: negeren.
        }
      };
    } catch {
      // Geen internet: de tablet blijft dan gewoon wachten.
    }

    return () => es?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, expectedProduct]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden relative">
      <IndustrialHeader
        title={`${productName}, Eindcontrole`}
        subtitle={cameraMode === 'webcam' ? 'Eindcontrole via vaste webcam' : 'De telefoon opent automatisch de productcontrole'}
        showTimer
        timerLabel="Cyclustijd"
        elapsedTime={elapsedTime}
        operatorSettings={operatorSettings}
        onBack={onBack}
        onSettings={onSettings}
      />

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-8 max-w-[1280px] mx-auto w-full">
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-10 flex flex-col items-center justify-center text-center">
          {cameraMode === 'webcam' ? (
            <div className="w-full">
              <div className="mb-5">
                <h3 className="text-2xl text-gray-800 font-bold mb-2">Eindcontrole met webcam</h3>
                <p className="text-gray-500">
                  Er wordt automatisch een controlefoto van {productName} genomen.
                </p>
              </div>

              {referenceMissing ? (
                <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-8 text-center">
                  <CameraIcon className="w-10 h-10 mx-auto mb-3 text-amber-600" />
                  <p className="font-bold text-amber-800 mb-1">
                    Nog geen kalibratie ingesteld voor {productName}
                  </p>
                  <p className="text-sm text-amber-700 mb-4">
                    Leg eerst een afbakening en referentiefoto vast in Instellingen &gt; Kalibratie
                    voor deze controle automatisch kan werken.
                  </p>
                  {onOpenCalibration && (
                    <button
                      onClick={onOpenCalibration}
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-5 py-2.5 text-sm font-bold"
                    >
                      Naar kalibratie
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <WorkstationWebcam
                    onAnalyseFrame={handleAnalyseFrame}
                    active={state === 'waiting'}
                  />
                  {webcamError && (
                    <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm font-medium text-red-700">
                      {webcamError}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
              <h3 className="text-2xl text-gray-800 font-bold mb-2">
                Wachten op controlefoto…
              </h3>
              <p className="text-gray-500 max-w-sm">
                Neem de controlefoto van {productName} op de telefoon. Het resultaat verschijnt hier automatisch.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        <button
          onClick={() => setState('result-pass')}
          aria-label="Handmatig goedkeuren (demo-fallback)"
          className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 opacity-40" />
        </button>
        <button
          onClick={() => setState('result-fail')}
          aria-label="Handmatig afkeuren (demo-fallback)"
          className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-40" />
        </button>
      </div>

      {(state === 'result-pass' || state === 'result-fail') && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div
              className={`p-8 flex flex-col items-center text-center ${
                state === 'result-pass' ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  state === 'result-pass' ? 'bg-green-600' : 'bg-red-600'
                }`}
              >
                {state === 'result-pass' ? (
                  <Check className="w-9 h-9 text-white" />
                ) : (
                  <X className="w-9 h-9 text-white" />
                )}
              </div>

              <h3
                className={`text-2xl font-bold uppercase ${
                  state === 'result-pass' ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {state === 'result-pass'
                  ? `${productName} goedgekeurd`
                  : 'Afwijking gedetecteerd'}
              </h3>

              <p
                className={`text-sm mt-2 ${
                  state === 'result-pass' ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {state === 'result-pass'
                  ? 'Geen afwijkingen gedetecteerd. Het product kan worden vrijgegeven.'
                  : 'Breng het afgekeurde product naar de voorziene afkeurlocatie.'}
              </p>

              {state === 'result-fail' && visionResult && visionResult.worstRegions.length > 0 && (
                <div className="mt-3 text-xs text-red-600 font-medium space-y-1">
                  {visionResult.worstRegions.map((region) => (
                    <p key={region.label}>
                      Afwijking {region.label}: {region.diffPercent.toFixed(1)}%
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5">
              <button
                onClick={state === 'result-pass' ? onPass : onReject}
                className={`w-full py-4 rounded-lg text-lg font-medium text-white flex items-center justify-center gap-3 ${
                  state === 'result-pass'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {state === 'result-pass' ? 'Product vrijgeven' : 'Naar afkeurlocatie'}
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
