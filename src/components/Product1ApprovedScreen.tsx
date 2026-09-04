import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';

interface Props {
  onRelease: () => void;
  productName: string;
  operatorSettings: {
    operatorName: string;
    line: string;
    station: string;
  };
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

export function Product1ApprovedScreen({
  onRelease,
  productName,
  operatorSettings,
  onSettings,
}: Props) {
  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden">
      <IndustrialHeader
        title="Kwaliteitscontrole"
        subtitle={`${productName} – Eindcontrole`}
        operatorSettings={operatorSettings}
        onSettings={onSettings}
      />

      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] gap-6 items-stretch">
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 min-h-[560px]">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1717386255773-a456c611dc4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080"
              alt={productName}
              className="w-full h-full min-h-[520px] object-cover rounded-lg border-4 border-green-500"
            />
          </section>

          <aside className="w-full min-w-0 flex flex-col gap-5">
            <div className="bg-green-50 border-l-4 border-green-600 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl text-green-900 font-bold uppercase leading-tight">
                    {productName} goedgekeurd
                  </h2>
                  <p className="text-sm text-green-700 mt-1">
                    Geen afwijkingen gedetecteerd
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-semibold">
                Inspectieresultaten
              </h3>

              <div className="divide-y divide-gray-100">
                {[
                  'Productconfiguratie',
                  'Positie onderdelen',
                  'Montage',
                  'Visuele controle',
                ].map((label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm text-gray-700">{label}</span>
                    <span className="text-sm text-green-700 font-bold flex items-center gap-2 flex-shrink-0">
                      <Check className="w-4 h-4" />
                      OK
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            <button
              onClick={onRelease}
              className="w-full min-h-[58px] bg-blue-600 hover:bg-blue-700 text-white text-lg px-6 rounded-xl transition-colors flex items-center justify-center gap-3 font-semibold shadow-sm"
            >
              {productName} vrijgeven
              <ChevronRight className="w-6 h-6" />
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}
