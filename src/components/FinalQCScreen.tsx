import { useEffect, useRef, useState } from 'react';
import { Loader2, X, Check, ChevronRight } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';
import { WorkstationWebcam } from './WorkstationWebcam';
import { CameraMode, NTFY_TOPIC } from '../main';

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
}: Props) {
  const [state, setState] = useState<QCState>('waiting');

  // Kleine tijdsmarge tussen telefoon en tablet.
  const lastSeenRef = useRef<number>(Date.now() - 10000);

  const expectedProduct =
    productName === 'Product 2' ? 'product2' : 'product1';

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
                <p className="text-gray-500">Neem een vaste controlefoto van {productName}.</p>
              </div>
              <WorkstationWebcam />
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
