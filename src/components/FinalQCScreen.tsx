import { useEffect, useState } from 'react';
import { Loader2, X, Check, ChevronRight } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';

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
  onBack: () => void;
  onSettings?: () => void;
}

type QCState = 'waiting' | 'result-pass' | 'result-fail';

// TIJDELIJK: de echte automatische productanalyse is nog niet gebouwd.
// Deze eindcontrole simuleert daarom zelf een geslaagde controle na een
// korte, realistische wachttijd. Zodra de echte camera-analyse klaar is,
// vervang je dit blok door de effectieve resultaatverwerking.
const FAKE_QC_DELAY_MS = 2500;

export function FinalQCScreen({
  onPass,
  onReject,
  elapsedTime,
  productName,
  operatorSettings,
  onBack,
  onSettings,
}: Props) {
  const [state, setState] = useState<QCState>('waiting');

  useEffect(() => {
    if (state !== 'waiting') return;

    const timeout = window.setTimeout(() => {
      setState('result-pass');
    }, FAKE_QC_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [state]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden relative">
      <IndustrialHeader
        title={`${productName}, Eindcontrole`}
        subtitle="Het product wordt automatisch gecontroleerd"
        showTimer
        elapsedTime={elapsedTime}
        operatorSettings={operatorSettings}
        onBack={onBack}
        onSettings={onSettings}
      />

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-8 max-w-[1280px] mx-auto w-full">
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-10 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
          <h3 className="text-2xl text-gray-800 font-bold mb-2">
            Product wordt gecontroleerd…
          </h3>
          <p className="text-gray-500 max-w-sm">
            Even geduld, {productName} wordt vergeleken met de referentiefoto.
          </p>
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
