import { Check, Clock, Download, TrendingUp, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { IndustrialHeader } from './IndustrialHeader';
import { SessionData, StepLogEntry } from '../main';

interface Props {
  sessionData: SessionData;
  totalTime: number;
  productName: string;
  operatorSettings: {
    operatorName: string;
    line: string;
    station: string;
  };
  producedCount?: number;
  orderQuantity?: number;
  onStartNextCycle: () => void;
  // NIEUW: log van elke doorlopen voorbereidings-/montagestap, voor de
  // SMED-analyse. Dit is wat de Excel-export nu effectief bevat: één
  // tabblad per cyclus (van na het vorige goede product t.e.m. de
  // eindcontrole van het huidige product).
  stepLog?: StepLogEntry[];
}

export function FinishScreen({ sessionData, totalTime, productName, operatorSettings, producedCount = 0, orderQuantity = 50, onStartNextCycle, stepLog = [] }: Props) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const calculateChangeoverTime = () => {
    if (sessionData.timestamps.changeoverCompleted && sessionData.timestamps.changeoverGuidedStart) {
      const seconds = Math.floor((sessionData.timestamps.changeoverCompleted - sessionData.timestamps.changeoverGuidedStart) / 1000);
      return formatTime(seconds);
    }
    return 'N/A';
  };

  const calculateAssemblyTime = () => {
    if (sessionData.timestamps.product2Assembled && sessionData.timestamps.productionStarted) {
      const seconds = Math.floor((sessionData.timestamps.product2Assembled - sessionData.timestamps.productionStarted) / 1000);
      return formatTime(seconds);
    }
    return 'N/A';
  };

  // NIEUW: tijdsnotatie zoals in het SMED-registratieblad (min:sec,msec),
  // bv. 1:23,450 voor 1 minuut, 23 seconden en 450 milliseconden.
  const formatClock = (ms: number) => {
    const totalMs = Math.max(0, Math.round(ms));
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;
    return `${minutes}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  // NIEUW: exporteert nu een echt Excel-bestand (.xlsx) met één tabblad
  // per cyclus, i.p.v. één platte CSV. Een cyclus loopt van na het
  // vorige goede product tot en met de eindcontrole van het huidige
  // product (zie cycle in main.tsx). Binnen elk tabblad zijn de
  // tijden relatief t.o.v. het begin van DIE cyclus.
  const exportToExcel = () => {
    const cycles = Array.from(new Set(stepLog.map((entry) => entry.cycle))).sort(
      (a, b) => a - b
    );

    if (cycles.length === 0) return;

    const workbook = XLSX.utils.book_new();

    cycles.forEach((cycle) => {
      const entries = stepLog.filter((entry) => entry.cycle === cycle);
      const cycleStart = Math.min(...entries.map((entry) => entry.startTime));
      const cycleProduct = entries[0]?.product ?? '';

      const rows = [
        ['Stap', 'Fase', 'Activiteit', 'Start (min:sec,msec)', 'Stop (min:sec,msec)', 'Duur (min:sec,msec)'],
        ...entries.map((entry, index) => [
          index + 1,
          entry.phase,
          entry.step,
          formatClock(entry.startTime - cycleStart),
          formatClock(entry.stopTime - cycleStart),
          formatClock(entry.durationMs),
        ]),
      ];

      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 45 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];

      // Tabbladnamen mogen max. 31 tekens en geen / \ ? * [ ] bevatten.
      const sheetName = `Cyclus ${cycle} - ${cycleProduct}`
        .replace(/[/\\?*[\]]/g, '')
        .slice(0, 31);

      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    });

    XLSX.writeFile(workbook, `smed_${Date.now()}.xlsx`);
  };


  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden">
      <IndustrialHeader 
        title="Omstelling voltooid"
        subtitle={`${productName} klaar voor productie`}
        operatorSettings={operatorSettings}
      />
      
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col md:flex-row p-8 gap-8 max-w-[1280px] mx-auto w-full">
        {/* LEFT: Success Visual & Key Metrics */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-10 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-20 h-20 text-green-600" />
            </div>
            <h2 className="text-4xl text-gray-800 font-bold mb-3 uppercase">
              {productName}
            </h2>
            <p className="text-xl text-gray-600">Klaar voor productie</p>
          </div>

          {/* Key Metrics Cards */}
          <div className="w-full max-w-md space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-7 h-7 text-blue-600" />
                  <span className="text-sm text-gray-700 font-medium">Totale omsteltijd</span>
                </div>
                <span className="text-2xl text-blue-700 font-bold">{formatTime(totalTime)}</span>
              </div>
            </div>

            <div className={`border rounded-lg p-5 ${
              sessionData.finalQCPassed 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-medium">Eindcontrole</span>
                <span className={`text-2xl font-bold ${
                  sessionData.finalQCPassed ? 'text-green-700' : 'text-red-700'
                }`}>
                  {sessionData.finalQCPassed ? 'OK' : 'NOK'}
                </span>
              </div>
            </div>

            <div className={`border rounded-lg p-5 ${
              sessionData.firstTimeRight 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className={`w-6 h-6 ${
                    sessionData.firstTimeRight ? 'text-green-600' : 'text-yellow-600'
                  }`} />
                  <span className="text-sm text-gray-700 font-medium">First-Time-Right</span>
                </div>
                <span className={`text-2xl font-bold ${
                  sessionData.firstTimeRight ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {sessionData.firstTimeRight ? 'JA' : 'NEE'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Detailed Metrics */}
        <div className="w-full md:w-96 flex flex-col gap-5">
          
          {/* Time Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-medium">
              Tijdsregistratie
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Omstelling:</span>
                <span className="text-gray-900 font-medium">{calculateChangeoverTime()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Montage:</span>
                <span className="text-gray-900 font-medium">{calculateAssemblyTime()}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-200">
                <span className="text-gray-700 font-medium">Totaal:</span>
                <span className="text-gray-900 font-bold text-lg">{formatTime(totalTime)}</span>
              </div>
            </div>
          </div>

          {/* Process Checklist */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-medium">
              Procesoverzicht
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-600" />
                <span>Product vrijgegeven</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-600" />
                <span>Productieopdracht bevestigd</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-600" />
                <span>Product afgevoerd</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-600" />
                <span>Omstelling uitgevoerd</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-600" />
                <span>Product geassembleerd</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-600" />
                <span>Kwaliteitscontrole voltooid</span>
              </div>
            </div>
          </div>

          {/* Order voortgang */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Order voortgang
              </h4>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                producedCount >= orderQuantity
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {producedCount} / {orderQuantity} stuks
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  producedCount >= orderQuantity ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, (producedCount / orderQuantity) * 100)}%` }}
              />
            </div>
            {producedCount >= orderQuantity && (
              <p className="text-xs text-emerald-700 font-medium mt-2">
                Order voltooid, deze order is klaar.
              </p>
            )}
          </div>

          {/* Operator Info */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">
              Sessie informatie
            </h4>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex justify-between">
                <span>Operator:</span>
                <span className="font-medium">{operatorSettings.operatorName}</span>
              </div>
              <div className="flex justify-between">
                <span>Lijn:</span>
                <span className="font-medium">{operatorSettings.line}</span>
              </div>
              <div className="flex justify-between">
                <span>Station:</span>
                <span className="font-medium">{operatorSettings.station}</span>
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Export Button - Small secondary */}
          <button
            onClick={exportToExcel}
            disabled={stepLog.length === 0}
            className="w-full bg-slate-700 hover:bg-slate-800 disabled:bg-gray-300 disabled:text-gray-500 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Download className="w-4 h-4" />
            Excel exporteren ({stepLog.length} stappen)
          </button>

          {/* Primary: Next Product Button */}
          <button
            onClick={onStartNextCycle}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 font-medium shadow-sm"
          >
            Volgend product
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
