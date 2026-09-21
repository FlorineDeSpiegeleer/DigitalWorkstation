import { useEffect, useRef, useState } from 'react';
import { Smartphone, Camera, Loader2, X, Check, ChevronRight } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';
import { WorkstationWebcam } from './WorkstationWebcam';
import { CameraMode, NTFY_TOPIC } from '../main';
import { analyseMalPhoto } from '../lib/malVision';
import { postNtfyJson } from '../services/ntfy';

interface Props {
  onPass: () => void;
  onFail: () => void;
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
}

type CheckState = 'waiting' | 'result-pass' | 'result-fail';

interface CheckResult {
  product: string;
  status: 'ok' | 'error';
  percentage: number;
  context?: 'camera-check' | 'final-qc' | null;
  timestamp: number;
}

export function CameraCheckScreen({
  onPass,
  onFail,
  elapsedTime,
  productName,
  operatorSettings,
  cameraMode,
  onBack,
  onSettings,
}: Props) {
  const [state, setState] = useState<CheckState>('waiting');
  const [webcamError, setWebcamError] = useState('');
  // NIEUW: percentage van de referentiekleur die nog zichtbaar was, om te
  // tonen bij een afkeuring — zowel bij de webcam- als de telefooncontrole.
  const [detectedPercentage, setDetectedPercentage] = useState<number | null>(null);

  // Kleine tijdsmarge tussen telefoon en tablet, zodat een paar seconden
  // verschil tussen beide toestelklokken geen geldig resultaat blokkeert.
  const lastSeenRef = useRef<number>(Date.now() - 10000);

  const expectedProduct =
    productName === 'Product 2' ? 'product2' : 'product1';

  const handleResult = (data: CheckResult) => {
    if (!data?.timestamp) return;

    // Dit scherm mag alleen resultaten van de MALCONTROLE verwerken.
    if (data.context !== 'camera-check') return;

    // En alleen van het product dat nu effectief gecontroleerd wordt.
    if (data.product !== expectedProduct) return;

    if (data.timestamp <= lastSeenRef.current) return;

    lastSeenRef.current = data.timestamp;
    setDetectedPercentage(data.percentage);
    setState(data.status === 'ok' ? 'result-pass' : 'result-fail');
  };

  // NIEUW: automatische analyse — wordt door WorkstationWebcam zelf
  // aangeroepen zodra het beeld gestabiliseerd is, geen knop nodig. Het
  // live camerabeeld blijft gewoon zichtbaar terwijl dit loopt.
  const handleAnalyseFrame = async (dataUrl: string) => {
    setWebcamError('');

    try {
      const result = await analyseMalPhoto(dataUrl, expectedProduct);
      const payload: CheckResult = {
        product: expectedProduct,
        status: result.status,
        percentage: result.percentage,
        context: 'camera-check',
        timestamp: Date.now(),
      };

      // Zelfde resultaatformaat als de bestaande telefooncontrole. Dit houdt
      // de kwaliteitslog en eventuele lokale koppelingen compatibel.
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
      setDetectedPercentage(result.percentage);
      setState(result.status === 'ok' ? 'result-pass' : 'result-fail');
    } catch (error) {
      setWebcamError(
        error instanceof Error ? error.message : 'De webcamfoto kon niet worden geanalyseerd.'
      );
    }
  };


  // Lokale fallback wanneer telefoon en tablet in dezelfde browser draaien.
  useEffect(() => {
    if (state !== 'waiting' || cameraMode !== 'phone') return;

    const interval = window.setInterval(() => {
      try {
        const raw = localStorage.getItem('camera_check_result');
        if (!raw) return;
        handleResult(JSON.parse(raw));
      } catch {
        // Ongeldige data: gewoon blijven wachten.
      }
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, expectedProduct, cameraMode]);

  // Live koppeling tussen echte aparte toestellen via ntfy.sh.
  useEffect(() => {
    if (state !== 'waiting' || cameraMode !== 'phone') return;

    let es: EventSource | null = null;

    try {
      es = new EventSource(`https://ntfy.sh/${NTFY_TOPIC}/sse`);

      es.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (!envelope?.message) return;
          handleResult(JSON.parse(envelope.message));
        } catch {
          // Geen geldig camerabericht: negeren.
        }
      };
    } catch {
      // Geen internet: de kleine demo-fallback rechtsonder blijft beschikbaar.
    }

    return () => es?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, expectedProduct, cameraMode]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden relative">
      <IndustrialHeader
        title="Controle omstelling"
        subtitle={cameraMode === 'webcam' ? 'Controle via vaste webcam' : 'De telefoon opent automatisch de juiste malcontrole'}
        showTimer
        elapsedTime={elapsedTime}
        operatorSettings={operatorSettings}
        onBack={onBack}
        onSettings={onSettings}
      />

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col md:flex-row p-8 gap-8 max-w-[1280px] mx-auto w-full">
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-10 flex flex-col items-center justify-center text-center">
          {cameraMode === 'webcam' ? (
            <div className="w-full">
              <WorkstationWebcam
                onAnalyseFrame={handleAnalyseFrame}
                active={state === 'waiting'}
              />
              {webcamError && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm font-medium text-red-700">
                  {webcamError}
                </div>
              )}
            </div>
          ) : (
            <>
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
              <h3 className="text-2xl text-gray-800 font-bold mb-2">
                Wachten op controlefoto…
              </h3>
              <p className="text-gray-500 max-w-sm">
                Zodra de operator op dit scherm komt, schakelt de telefoon in camerastand automatisch naar de malcontrole van {productName}.
              </p>
            </>
          )}
        </div>

        <div className="w-full md:w-96 flex flex-col gap-5">
          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              {cameraMode === 'webcam' ? <Camera className="w-6 h-6 text-blue-600" /> : <Smartphone className="w-6 h-6 text-blue-600" />}
              <h4 className="text-sm text-blue-800 font-bold uppercase">
                {cameraMode === 'webcam' ? 'Webcam geselecteerd' : 'Telefoon in camerastand'}
              </h4>
            </div>

            {cameraMode === 'webcam' ? (
              <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                <li>Sta cameratoegang toe als de browser dit vraagt.</li>
                <li>Controleer het live beeld van de werkpost.</li>
                <li>Zorg dat de mal volledig zichtbaar is in beeld.</li>
                <li>De opname en analyse gebeuren automatisch.</li>
              </ol>
            ) : (
              <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                <li>Laat de telefoon openstaan op <strong>Camera</strong>.</li>
                <li><strong>Malcontrole</strong> opent automatisch.</li>
                <li><strong>{productName}</strong> wordt automatisch geselecteerd.</li>
                <li>Neem de foto en druk op <strong>Analyseer</strong>.</li>
              </ol>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">
              Automatische koppeling
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              {cameraMode === 'webcam'
                ? `De webcam wordt rechtstreeks door deze browser gebruikt voor de malcontrole van ${productName}.`
                : `De telefoon stuurt het resultaat automatisch terug naar deze tablet. Alleen een malcontrole van ${productName} wordt op dit scherm aanvaard.`}
            </p>
          </div>

          <div className="flex-1" />
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
                  ? 'Mal correct gemonteerd'
                  : 'Mal niet correct gemonteerd'}
              </h3>

              <p
                className={`text-sm mt-2 ${
                  state === 'result-pass' ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {state === 'result-pass'
                  ? 'De omstelling is goedgekeurd. Je kan doorgaan.'
                  : 'Corrigeer de mal en voer de controle opnieuw uit.'}
              </p>

              {state === 'result-fail' && detectedPercentage !== null && (
                <p className="text-xs mt-2 text-red-600 font-medium">
                  {detectedPercentage.toFixed(1)}% referentiekleur nog zichtbaar in de controlezone.
                </p>
              )}
            </div>

            <div className="p-5">
              <button
                onClick={state === 'result-pass' ? onPass : onFail}
                className={`w-full py-4 rounded-lg text-lg font-medium text-white flex items-center justify-center gap-3 ${
                  state === 'result-pass'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Doorgaan
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
