import { useEffect, useRef, useState } from 'react';
import { Smartphone, Loader2, X, Check, ChevronRight } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';
import { NTFY_TOPIC } from '../main';

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
  onBack,
  onSettings,
}: Props) {
  const [state, setState] = useState<CheckState>('waiting');

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
    setState(data.status === 'ok' ? 'result-pass' : 'result-fail');
  };

  // Lokale fallback wanneer telefoon en tablet in dezelfde browser draaien.
  useEffect(() => {
    if (state !== 'waiting') return;

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
  }, [state, expectedProduct]);

  // Live koppeling tussen echte aparte toestellen via ntfy.sh.
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
          // Geen geldig camerabericht: negeren.
        }
      };
    } catch {
      // Geen internet: de kleine demo-fallback rechtsonder blijft beschikbaar.
    }

    return () => es?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, expectedProduct]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden relative">
      <IndustrialHeader
        title="Controle omstelling"
        subtitle="De telefoon opent automatisch de juiste malcontrole"
        showTimer
        elapsedTime={elapsedTime}
        operatorSettings={operatorSettings}
        onBack={onBack}
        onSettings={onSettings}
      />

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col md:flex-row p-8 gap-8 max-w-[1280px] mx-auto w-full">
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-10 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
          <h3 className="text-2xl text-gray-800 font-bold mb-2">
            Wachten op controlefoto…
          </h3>
          <p className="text-gray-500 max-w-sm">
            Zodra de operator op dit scherm komt, schakelt de telefoon in camerastand automatisch naar de malcontrole van {productName}.
          </p>
        </div>

        <div className="w-full md:w-96 flex flex-col gap-5">
          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Smartphone className="w-6 h-6 text-blue-600" />
              <h4 className="text-sm text-blue-800 font-bold uppercase">
                Telefoon in camerastand
              </h4>
            </div>

            <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
              <li>Laat de telefoon openstaan op <strong>Camera</strong>.</li>
              <li><strong>Malcontrole</strong> opent automatisch.</li>
              <li><strong>{productName}</strong> wordt automatisch geselecteerd.</li>
              <li>Neem de foto en druk op <strong>Analyseer</strong>.</li>
            </ol>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">
              Automatische koppeling
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              De telefoon stuurt het resultaat automatisch terug naar deze tablet. Alleen een malcontrole van {productName} wordt op dit scherm aanvaard.
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
