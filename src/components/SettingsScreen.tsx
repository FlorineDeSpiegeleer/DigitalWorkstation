import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Save, AlertTriangle, Camera, Send, Phone, Monitor, CheckCircle, Clock, XCircle, CalendarClock, Info, Download } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';
import { CameraMode, OperatorSettings, PlannedChangeover, StepLogEntry, NTFY_EVENTS_TOPIC } from '../main';

interface Props {
  operatorSettings: OperatorSettings;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  onSave: (settings: OperatorSettings) => void;
  onBack: () => void;
  currentProduct?: string;
  currentStep?: string;
  // Alleen-lezen: omstellingen die de MANAGER heeft ingepland (via de
  // Manager-pagina, doorgestuurd via ntfy.sh). De operator kan hier
  // zelf niets plannen — dat kan enkel de manager.
  plannedChangeovers?: PlannedChangeover[];
  // NIEUW: log van elke doorlopen voorbereidings-/montagestap, voor de
  // SMED-analyse. Downloadbaar als CSV.
  stepLog?: StepLogEntry[];
  // NIEUW: notificatie-instellingen leven nu in de operator-app zelf
  // (bewaard + gebruikt om echte meldingen te tonen), niet meer lokaal
  // hier.
  notifications: { changeover: boolean; quality: boolean; teamleader: boolean };
  onNotificationsChange: (next: { changeover: boolean; quality: boolean; teamleader: boolean }) => void;
  // Toont een melding bovenaan het scherm, maar enkel als de operator
  // "Teamleader-updates" heeft aangevinkt.
  onTeamleaderAction: (message: string) => void;
  // NIEUW: opent het kalibratiescherm waar de operator zelf de
  // referentiefoto's voor de automatische eindcontrole vastlegt.
  onOpenCalibration: () => void;
}

interface Incident {
  id: string;
  category: string;
  description: string;
  status: 'Open' | 'In behandeling' | 'Opgelost';
  timestamp: string;
}

export function SettingsScreen({
  operatorSettings,
  cameraMode,
  onCameraModeChange,
  onSave,
  onBack,
  currentProduct = 'Product 2',
  currentStep = 'Product afvoeren',
  plannedChangeovers = [],
  stepLog = [],
  notifications,
  onNotificationsChange,
  onTeamleaderAction,
  onOpenCalibration,
}: Props) {
  const [settings, setSettings] = useState(operatorSettings);

  // NIEUW: Excel-export (.xlsx) van het stepLog, met één tabblad per
  // cyclus — zelfde logica als op het "Omstelling voltooid"-scherm, zodat
  // een export hier en daar altijd identiek is. Een cyclus loopt van na
  // het vorige goede product tot en met de eindcontrole van het huidige
  // product (zie cycle in main.tsx).
  const formatClock = (ms: number) => {
    const totalMs = Math.max(0, Math.round(ms));
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;
    return `${minutes}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  // NIEUW: echte datum + uur van start en stop, naast de relatieve tijd.
  const formatDateTime = (ms: number) => {
    const d = new Date(ms);
    const date = d.toLocaleDateString('nl-BE');
    const time = d.toLocaleTimeString('nl-BE', { hour12: false });
    return { date, time };
  };

  const downloadStepLogExcel = () => {
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
        ['Stap', 'Fase', 'Activiteit', 'Startdatum', 'Starttijd', 'Stopdatum', 'Stoptijd', 'Start (min:sec,msec)', 'Stop (min:sec,msec)', 'Duur (min:sec,msec)'],
        ...entries.map((entry, index) => {
          const start = formatDateTime(entry.startTime);
          const stop = formatDateTime(entry.stopTime);

          return [
            index + 1,
            entry.phase,
            entry.step,
            start.date,
            start.time,
            stop.date,
            stop.time,
            formatClock(entry.startTime - cycleStart),
            formatClock(entry.stopTime - cycleStart),
            formatClock(entry.durationMs),
          ];
        }),
      ];

      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 45 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];

      // Tabbladnamen mogen max. 31 tekens en geen / \ ? * [ ] bevatten.
      const sheetName = `Cyclus ${cycle} - ${cycleProduct}`
        .replace(/[/\\?*[\]]/g, '')
        .slice(0, 31);

      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    });

    XLSX.writeFile(
      workbook,
      `smed-registratie-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, '-')}.xlsx`
    );
  };

  // Problem reporting
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [problemSubmitted, setproblemSubmitted] = useState(false);
  const [problemData, setProblemData] = useState({
    category: 'Materiaal',
    description: '',
    photo: null as string | null,
  });
  const [lastIncidentId, setLastIncidentId] = useState('');

  // Team leader contact
  const [showQuickMessages, setShowQuickMessages] = useState(false);

  // Recent incidents
  const [incidents, setIncidents] = useState<Incident[]>([
    { id: 'INC-2024-0154', category: 'Materiaal', description: 'Onderdelen ontbreken voor Product 1', status: 'Opgelost', timestamp: '31-08-2026 14:23' },
    { id: 'INC-2024-0153', category: 'Kwaliteit', description: 'Afwijking gedetecteerd bij controle', status: 'In behandeling', timestamp: '31-08-2026 13:45' },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onSave(settings);
  };

  const handleSubmitProblem = () => {
    const incidentId = `INC-2026-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
    const newIncident: Incident = {
      id: incidentId,
      category: problemData.category,
      description: problemData.description,
      status: 'Open',
      timestamp: new Date().toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    setIncidents([newIncident, ...incidents]);
    setLastIncidentId(incidentId);
    setproblemSubmitted(true);

    // NIEUW: publiceer deze melding live naar de Manager-pagina.
    fetch(`https://ntfy.sh/${NTFY_EVENTS_TOPIC}`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'operator',
        type: 'incident',
        message: `${problemData.category}: ${problemData.description}`,
        operatorName: operatorSettings.operatorName,
        line: operatorSettings.line,
        station: operatorSettings.station,
        incidentId,
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Geen internet — melding blijft lokaal zichtbaar bij "Recente meldingen".
    });

    setTimeout(() => {
      setproblemSubmitted(false);
      setShowProblemForm(false);
      setProblemData({ category: 'Materiaal', description: '', photo: null });
    }, 2000);
  };

  const handlePhotoCapture = () => {
    // Simulate photo capture
    setProblemData({ ...problemData, photo: 'captured-photo.jpg' });
  };

  const handleQuickMessage = (message: string) => {
    onTeamleaderAction(`Bericht verzonden naar teamleader: "${message}"`);
    setShowQuickMessages(false);

    // NIEUW: publiceer dit bericht live naar de Manager-pagina.
    fetch(`https://ntfy.sh/${NTFY_EVENTS_TOPIC}`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'operator',
        type: 'message',
        message,
        operatorName: operatorSettings.operatorName,
        line: operatorSettings.line,
        station: operatorSettings.station,
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Geen internet — de manager ziet dit bericht dan niet live.
    });
  };

  const handleCallTeamleader = () => {
    onTeamleaderAction('Teamleader wordt gebeld...');

    // NIEUW: publiceer deze oproep live naar de Manager-pagina.
    fetch(`https://ntfy.sh/${NTFY_EVENTS_TOPIC}`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'operator',
        type: 'call_request',
        message: 'Operator belt de teamleader',
        operatorName: operatorSettings.operatorName,
        line: operatorSettings.line,
        station: operatorSettings.station,
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Geen internet — de manager ziet dit dan niet live.
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'text-red-600';
      case 'In behandeling': return 'text-orange-600';
      case 'Opgelost': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open': return <XCircle className="w-4 h-4" />;
      case 'In behandeling': return <Clock className="w-4 h-4" />;
      case 'Opgelost': return <CheckCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden">
      <IndustrialHeader
        title="Instellingen"
        subtitle="Operator en ondersteuning"
        onBack={onBack}
        operatorSettings={settings}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col md:flex-row p-6 gap-6 max-w-[1280px] mx-auto w-full">

          {/* LEFT COLUMN */}
          <div className="flex-1 flex flex-col gap-5">

            {/* Operator Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-medium">
                Operator instellingen
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2 font-medium">
                    Operator naam
                  </label>
                  <input
                    type="text"
                    value={settings.operatorName}
                    onChange={(e) => setSettings({ ...settings, operatorName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2 font-medium">
                    Shift
                  </label>
                  <select
                    value={settings.shift}
                    onChange={(e) => setSettings({ ...settings, shift: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Dagdienst</option>
                    <option>Avonddienst</option>
                    <option>Nachtdienst</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2 font-medium">
                    Lijn
                  </label>
                  <input
                    type="text"
                    value={settings.line}
                    onChange={(e) => setSettings({ ...settings, line: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2 font-medium">
                    Station
                  </label>
                  <input
                    type="text"
                    value={settings.station}
                    onChange={(e) => setSettings({ ...settings, station: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
              >
                <Save className="w-4 h-4" />
                Instellingen opslaan
              </button>
            </div>

            {/* Camera Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-medium">
                Camera voor controles
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Kies welke camera wordt gebruikt voor zowel de malcontrole als de eindcontrole.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onCameraModeChange('phone')}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    cameraMode === 'phone'
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Phone className="w-5 h-5 mb-2" />
                  <span className="block font-bold text-sm">Telefoon</span>
                  <span className="block text-xs mt-1 opacity-75">Bestaande mobiele cameraflow</span>
                </button>

                <button
                  type="button"
                  onClick={() => onCameraModeChange('webcam')}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    cameraMode === 'webcam'
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Monitor className="w-5 h-5 mb-2" />
                  <span className="block font-bold text-sm">Webcam</span>
                  <span className="block text-xs mt-1 opacity-75">Vaste camera aan de werkpost</span>
                </button>
              </div>

              {cameraMode === 'webcam' && (
                <button
                  type="button"
                  onClick={onOpenCalibration}
                  className="mt-3 w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 p-4 text-left transition-colors flex items-center gap-3"
                >
                  <Camera className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="block font-bold text-sm">Kalibratie eindcontrole</span>
                    <span className="block text-xs opacity-75">
                      Referentiefoto's vastleggen voor Product 1 en Product 2
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* Problem Reporting */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-medium">
                Probleem melden
              </h3>

              {!showProblemForm && !problemSubmitted ? (
                <button
                  onClick={() => setShowProblemForm(true)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                >
                  <AlertTriangle className="w-5 h-5" />
                  Nieuw probleem melden
                </button>
              ) : problemSubmitted ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 font-bold">Melding verzonden</span>
                  </div>
                  <p className="text-sm text-green-700">Incident ID: {lastIncidentId}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">
                      Categorie
                    </label>
                    <select
                      value={problemData.category}
                      onChange={(e) => setProblemData({ ...problemData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option>Materiaal</option>
                      <option>Mal</option>
                      <option>Gereedschap</option>
                      <option>Werkinstructie</option>
                      <option>Kwaliteit</option>
                      <option>IT</option>
                      <option>Anders</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">
                      Korte omschrijving
                    </label>
                    <textarea
                      value={problemData.description}
                      onChange={(e) => setProblemData({ ...problemData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      placeholder="Beschrijf het probleem..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">
                      Foto (optioneel)
                    </label>
                    <button
                      onClick={handlePhotoCapture}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-300"
                    >
                      <Camera className="w-4 h-4" />
                      {problemData.photo ? 'Foto toegevoegd ✓' : 'Foto toevoegen'}
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded p-3 text-xs text-gray-600">
                    <p className="font-medium mb-1">Automatisch bijgevoegd:</p>
                    <p>• Operator: {operatorSettings.operatorName}</p>
                    <p>• Lijn: {operatorSettings.line} · Station: {operatorSettings.station}</p>
                    <p>• Huidig product: {currentProduct}</p>
                    <p>• Processtap: {currentStep}</p>
                    <p>• Tijdstip: {new Date().toLocaleString('nl-NL')}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowProblemForm(false);
                        setProblemData({ category: 'Materiaal', description: '', photo: null });
                      }}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-sm py-2 px-4 rounded-lg transition-colors font-medium"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={handleSubmitProblem}
                      disabled={!problemData.description.trim()}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm py-2 px-4 rounded-lg transition-colors font-medium shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Probleem melden
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Team Leader Contact */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-medium">
                Teamleader
              </h3>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">M. Jansen</span>
                  <span className="flex items-center gap-2 text-xs text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Beschikbaar
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => setShowQuickMessages(!showQuickMessages)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Send className="w-4 h-4" />
                  Bericht sturen
                </button>
                <button
                  onClick={handleCallTeamleader}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Phone className="w-4 h-4" />
                  Bel teamleader
                </button>
              </div>

              {showQuickMessages && (
                <div className="space-y-2 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-2">Snelle berichten:</p>
                  {[
                    'Onderdelen ontbreken',
                    'Probleem met mal',
                    'Kwaliteitsprobleem',
                    'Omstelling geblokkeerd',
                    'Hulp nodig aan werkpost'
                  ].map((msg, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickMessage(msg)}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 px-3 rounded text-left transition-colors"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="w-full md:w-96 flex flex-col gap-5">

            {/* Omstelling — enkel nog alleen-lezen, manager plant dit */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1 font-medium">
                Omstelling
              </h3>

              <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-4 mb-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Omstellingen worden ingepland door de manager. Zodra er iets gepland is, verschijnt dat hieronder — en automatisch op het dashboard wanneer het huidige product klaar is.
                </p>
              </div>

              {plannedChangeovers.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <CalendarClock className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    Geen omstelling gepland
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {plannedChangeovers.map((c, idx) => (
                    <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm font-bold text-blue-900">
                        {c.fromProduct} → {c.toProduct}
                      </p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        {c.plannedDate && c.plannedTime
                          ? `${c.plannedDate} om ${c.plannedTime}`
                          : 'Zodra huidig product klaar is'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NIEUW: SMED-registratie downloaden */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1 font-medium">
                SMED-registratie
              </h3>

              <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-4 mb-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Elke voorbereidings- en montagestap wordt automatisch geregistreerd (start, stop, duur). Download dit als Excel-bestand voor de SMED-analyse — één tabblad per cyclus, van na het vorige goede product t.e.m. de eindcontrole van het huidige product.
                </p>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                {stepLog.length === 0
                  ? 'Nog geen stappen geregistreerd.'
                  : `${stepLog.length} stappen geregistreerd, over ${new Set(stepLog.map((e) => e.cycle)).size} cyclus/cycli.`}
              </p>

              <button
                onClick={downloadStepLogExcel}
                disabled={stepLog.length === 0}
                className="w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white"
              >
                <Download className="w-4 h-4" />
                Excel downloaden
              </button>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-medium">
                Notificaties
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Omstelmeldingen</span>
                  <button
                    onClick={() => onNotificationsChange({ ...notifications, changeover: !notifications.changeover })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      notifications.changeover ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        notifications.changeover ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Kwaliteitswaarschuwingen</span>
                  <button
                    onClick={() => onNotificationsChange({ ...notifications, quality: !notifications.quality })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      notifications.quality ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        notifications.quality ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Teamleader-updates</span>
                  <button
                    onClick={() => onNotificationsChange({ ...notifications, teamleader: !notifications.teamleader })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      notifications.teamleader ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        notifications.teamleader ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Incidents */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-medium">
                Recente meldingen
              </h3>

              <div className="space-y-3">
                {incidents.slice(0, 3).map((incident) => (
                  <div key={incident.id} className="border-l-4 border-gray-300 pl-3 py-2">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs text-gray-500 font-mono">{incident.id}</span>
                      <span className={`flex items-center gap-1 text-xs font-medium ${getStatusColor(incident.status)}`}>
                        {getStatusIcon(incident.status)}
                        {incident.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{incident.category}</p>
                    <p className="text-xs text-gray-600 mt-1">{incident.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{incident.timestamp}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
