import { Clock, ArrowLeft, Settings } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  showTimer?: boolean;
  elapsedTime?: number;
  onBack?: () => void;
  onSettings?: () => void;
  operatorSettings?: {
    operatorName: string;
    line: string;
    station: string;
  };
}

export function IndustrialHeader({ title, subtitle, showTimer, elapsedTime = 0, onBack, onSettings, operatorSettings }: Props) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  const line = operatorSettings?.line || 'Lijn 4';
  const station = operatorSettings?.station || 'Stat. 2';
  const operator = operatorSettings?.operatorName || 'J. de Vries';
  return (
    <div className="bg-slate-800 text-white py-5 px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg transition-colors" aria-label="Terug"><ArrowLeft className="w-6 h-6" /></button>}
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase">{title}</h1>
            {subtitle && <p className="text-sm text-gray-300 mt-1">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{line} · {station}</p>
            <p className="text-sm text-white mt-1">Operator {operator}</p>
          </div>
          {showTimer && <div className="bg-slate-700 px-5 py-3 rounded-lg flex items-center gap-3"><Clock className="w-5 h-5 text-gray-300" /><div><p className="text-xs text-gray-400 uppercase">Omsteltijd</p><p className="text-xl font-mono tabular-nums">{formatTime(elapsedTime)}</p></div></div>}
          {onSettings && <button onClick={onSettings} className="p-2 hover:bg-slate-700 rounded-lg transition-colors" aria-label="Instellingen"><Settings className="w-6 h-6" /></button>}
        </div>
      </div>
    </div>
  );
}
