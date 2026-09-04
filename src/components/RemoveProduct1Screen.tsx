import { useState } from 'react';
import { MapPin, ChevronRight } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';

interface Props {
  onComplete: () => void;
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

function ImageWithFallback(props: any) {
  const [didError, setDidError] = useState(false);
  const { src, alt, style, className, ...rest } = props;

  return didError ? (
    <div
      className={`bg-gray-100 flex items-center justify-center ${className ?? ''}`}
      style={style}
    >
      <span className="text-sm text-gray-400">Afbeelding niet beschikbaar</span>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      {...rest}
      onError={() => setDidError(true)}
    />
  );
}

export function RemoveProduct1Screen({
  onComplete,
  elapsedTime,
  productName,
  operatorSettings,
  onBack,
  onSettings,
}: Props) {
  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden">
      <IndustrialHeader
        title="Product afvoeren"
        subtitle={`${productName} – Naar opslag`}
        showTimer
        elapsedTime={elapsedTime}
        operatorSettings={operatorSettings}
        onBack={onBack}
        onSettings={onSettings}
      />

      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] gap-6 items-stretch">
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 min-h-[560px] flex flex-col">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-semibold">
              Opslaglocatie
            </h2>

            <ImageWithFallback
              src="https://images.unsplash.com/photo-1714650601435-67a4d51a0798?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Opslaglocatie"
              className="w-full flex-1 min-h-[500px] object-cover rounded-lg"
            />
          </section>

          <aside className="w-full min-w-0 flex flex-col gap-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl text-gray-900 font-bold mb-3">
                {productName} is klaar
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                Breng het afgewerkte product naar de aangeduide opslaglocatie.
              </p>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-600 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <MapPin className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <h3 className="text-lg text-blue-900 font-bold uppercase">
                  Bestemming
                </h3>
              </div>

              <div className="grid grid-cols-[90px_1fr] gap-y-3 items-center">
                <span className="text-sm text-blue-700 font-medium">Zone</span>
                <span className="text-lg text-blue-950 font-bold">C</span>

                <span className="text-sm text-blue-700 font-medium">Rek</span>
                <span className="text-lg text-blue-950 font-bold">04</span>

                <span className="text-sm text-blue-700 font-medium">Niveau</span>
                <span className="text-lg text-blue-950 font-bold">2</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-semibold">
                Route
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Volg de blauwe markeringen naar Zone C. Gebruik de hefwagen
                indien nodig.
              </p>
            </div>

            <div className="flex-1" />

            <button
              onClick={onComplete}
              className="w-full min-h-[58px] bg-blue-600 hover:bg-blue-700 text-white text-lg px-6 rounded-xl transition-colors flex items-center justify-center gap-3 font-semibold shadow-sm"
            >
              Product afgevoerd
              <ChevronRight className="w-6 h-6" />
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}
