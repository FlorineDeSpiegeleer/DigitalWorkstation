import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  ArrowLeft,
  Boxes,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Home,
  LogOut,
  Package,
  RefreshCw,
  Route,
  ScanLine,
  Trash2,
} from 'lucide-react';


import { Product1ApprovedScreen } from './components/Product1ApprovedScreen';
import { ChangeoverCommandScreen } from './components/ChangeoverCommandScreen';
import { RemoveProduct1Screen } from './components/RemoveProduct1Screen';
import { MainDashboardScreen } from './components/MainDashboardScreen';
import { ChangeoverStep1Screen } from './components/ChangeoverStep1Screen';
import { ChangeoverStep2Screen } from './components/ChangeoverStep2Screen';
import { ChangeoverStep3Screen } from './components/ChangeoverStep3Screen';
import { ChangeoverStep4Screen } from './components/ChangeoverStep4Screen';
import { ChangeoverStep5Screen } from './components/ChangeoverStep5Screen';
import { CameraCheckScreen } from './components/CameraCheckScreen';
import { ProductionStepsScreen } from './components/ProductionStepsScreen';
import { FinalQCScreen } from './components/FinalQCScreen';
import { DeliverProductScreen } from './components/DeliverProductScreen';
import { RejectProductScreen } from './components/RejectProductScreen';
import { FinishScreen } from './components/FinishScreen';
import { WarningModal } from './components/WarningModal';
import { SettingsScreen } from './components/SettingsScreen';

/* ============================================================
   TYPES
============================================================ */

type AppMode =
  | 'home'
  | 'operator'
  | 'camera'
  | 'waterspider'
  | 'manager';

type AnalysisResult =
  | 'idle'
  | 'ok'
  | 'error';

type ProductType =
  | 'product1'
  | 'product2';

export type FlowStep =
  | 'product1-approved'
  | 'changeover-command'
  | 'remove-product1'
  | 'main-dashboard'
  | 'changeover-step1'
  | 'changeover-step2'
  | 'changeover-step3'
  | 'changeover-step4'
  | 'changeover-step5'
  | 'camera-check'
  | 'production'
  | 'final-qc'
  | 'deliver-product'
  | 'reject-product'
  | 'finish'
  | 'settings';

export type ChangeoverDirection =
  | 'P1_TO_P2'
  | 'P2_TO_P1';

/**
 * Hoe de huidige/aankomende omstelling getriggerd is:
 * - 'scheduled'             : normaal gepland (datum + tijd, via "Nieuwe productieopdracht")
 * - 'after-current-product' : gepland vanuit Settings, GEEN datum/tijd, start pas na eindcontrole huidig product
 * - 'now'                   : "Wissel nu" vanuit Settings, meteen naar dashboard met Start omstelling/productie
 */
export type ChangeoverTrigger =
  | 'scheduled'
  | 'after-current-product'
  | 'now';

/**
 * Gedeeld ntfy.sh-kanaal waarmee de Camera-interface (telefoon) een
 * controleresultaat naar de Operator-schermen (tablet) stuurt, ook al
 * draaien beide op een apart fysiek toestel. Zie CameraApp (publiceert)
 * en CameraCheckScreen / FinalQCScreen (ontvangen via SSE).
 *
 * LET OP — enkel voor demo/prototype: ntfy.sh is een gratis, PUBLIEK
 * kanaal; iedereen die deze topic-naam kent kan in theorie meelezen of
 * berichten sturen. Vervang dit voor een echte productieomgeving door
 * een eigen, beveiligde backend.
 */
export const NTFY_TOPIC =
  'sirris-mfg-demo-k7q2x9';

/** Kanaal waarop Operator en Waterspider hun huidige status publiceren,
 *  zodat de Manager-pagina live kan meekijken. */
export const NTFY_STATUS_TOPIC =
  `${NTFY_TOPIC}-status`;

/** Kanaal waarop de Manager een geplande omstelling publiceert; de
 *  Operator-app luistert hierop mee. */
export const NTFY_CHANGEOVER_TOPIC =
  `${NTFY_TOPIC}-changeover`;

/** Kanaal waarop Operator en Waterspider meldingen en berichten
 *  publiceren (probleem melden, bericht naar teamleader, "bel
 *  teamleader", voorbereiding voltooid) — de Manager-pagina toont dit
 *  als live feed. */
export const NTFY_EVENTS_TOPIC =
  `${NTFY_TOPIC}-events`;

export interface SessionData {
  changeoverStartTime?: number;
  changeoverCompleted: boolean;
  cameraCheckPassed: boolean;
  product2Assembled: boolean;
  finalQCPassed: boolean;
  firstTimeRight: boolean;

  timestamps: {
    [key: string]: number;
  };
}

export interface OperatorSettings {
  operatorName: string;
  line: string;
  station: string;
  shift: string;
}

export interface PlannedChangeover {
  fromProduct: string;
  toProduct: string;
  line: string;
  station: string;
  plannedDate: string;
  plannedTime: string;
  status: string;
  /** Aantal stuks van het nieuwe product dat geproduceerd moet worden.
   *  Optioneel voor achterwaartse compatibiliteit; valt terug op 50. */
  quantity?: number;
}

/* ============================================================
   MAIN APP
============================================================ */

/**
 * NIEUW (punt 3): eenvoudige PIN-toegangscontrole per rol.
 *
 * BELANGRIJK — dit is UITDRUKKELIJK geen echte beveiliging. Zelfs met de
 * hash hieronder (punt 6) kan iemand met de browser-devtools de PIN alsnog
 * in enkele seconden achterhalen — voor 4 cijfers zijn er maar 10.000
 * mogelijke combinaties, triviaal te doorlopen. Wat de hash wél doet: de
 * PIN staat niet meer LETTERLIJK leesbaar in de broncode voor wie
 * "Bekijk paginabron" gebruikt of vluchtig door het bestand scrolt. Er is
 * nog steeds geen server die dit afdwingt, en de ntfy.sh-kanalen blijven
 * sowieso publiek. Dit is enkel een drempel tegen per ongeluk (of
 * nieuwsgierig) de verkeerde interface openen — géén vervanging voor
 * echte authenticatie. Voor een productieomgeving hoort hier een
 * server-side login met échte accounts.
 */

// NIEUW (punt 6): eenvoudige, niet-cryptografische hash (FNV-1a) — enkel
// om de PIN niet als platte tekst in de broncode te laten staan. Geen
// vervanging voor echte beveiliging (zie kanttekening hierboven).
function simpleHash(
  input: string
): string {
  let hash = 0x811c9dc5;

  for (
    let i = 0;
    i < input.length;
    i++
  ) {
    hash ^=
      input.charCodeAt(i);

    hash =
      (hash *
        0x01000193) >>>
      0;
  }

  return hash
    .toString(16)
    .padStart(8, '0');
}

// Hashes van '1234' en '9999' — niet meer de platte PIN zelf.
const FLOOR_PIN_HASH =
  simpleHash('1234'); // Operator, Camera, Waterspider

const MANAGER_PIN_HASH =
  simpleHash('9999'); // Manager

const ROLE_PIN_HASHES: Partial<
  Record<AppMode, string>
> = {
  operator: FLOOR_PIN_HASH,
  camera: FLOOR_PIN_HASH,
  waterspider: FLOOR_PIN_HASH,
  manager: MANAGER_PIN_HASH,
};

const UNLOCKED_MODES_KEY =
  'sirris_unlocked_modes';

const APP_MODE_KEY =
  'sirris_app_mode';

export default function App() {
  // Welke rollen al ontgrendeld zijn in dit browsertabblad (voor deze
  // sessie — sluit je het tabblad, dan moet de PIN opnieuw ingevoerd
  // worden). Wordt hieronder als eerste ingelezen, zodat "appMode"
  // daarna weet of een bewaard scherm wel degelijk mag herladen.
  const [
    unlockedModes,
    setUnlockedModes,
  ] = useState<AppMode[]>(
    () => {
      try {
        return JSON.parse(
          sessionStorage.getItem(
            UNLOCKED_MODES_KEY
          ) || '["home"]'
        );
      } catch {
        return ['home'];
      }
    }
  );

  // NIEUW: onthoudt welk scherm open stond, zodat een paginaverversing
  // je automatisch terug in diezelfde interface zet i.p.v. steeds
  // opnieuw op "Operator" te moeten klikken. Enkel hersteld als die rol
  // al ontgrendeld was in dit tabblad (geen omweg rond de PIN).
  const [appMode, setAppMode] =
    useState<AppMode>(() => {
      try {
        const savedMode =
          sessionStorage.getItem(
            APP_MODE_KEY
          ) as AppMode | null;

        const savedUnlocked =
          JSON.parse(
            sessionStorage.getItem(
              UNLOCKED_MODES_KEY
            ) ||
              '["home"]'
          );

        if (
          savedMode &&
          savedUnlocked.includes(
            savedMode
          )
        ) {
          return savedMode;
        }
      } catch {
        // Geen bewaard scherm — gewoon starten op het startscherm.
      }

      return 'home';
    });

  useEffect(() => {
    try {
      sessionStorage.setItem(
        APP_MODE_KEY,
        appMode
      );
    } catch {
      // sessionStorage niet beschikbaar — een verversing start dan
      // gewoon weer op het startscherm, verder geen probleem.
    }
  }, [appMode]);

  // De rol waarvoor net een PIN gevraagd wordt (null = geen prompt actief)
  const [
    pendingMode,
    setPendingMode,
  ] =
    useState<AppMode | null>(
      null
    );

  const [
    pinInput,
    setPinInput,
  ] = useState('');

  const [
    pinError,
    setPinError,
  ] = useState(false);

  const handleSelect = (
    mode: AppMode
  ) => {
    if (
      unlockedModes.includes(
        mode
      )
    ) {
      setAppMode(mode);
      return;
    }

    setPendingMode(mode);
    setPinInput('');
    setPinError(false);
  };

  const handlePinSubmit = () => {
    if (!pendingMode) return;

    const expectedHash =
      ROLE_PIN_HASHES[
        pendingMode
      ];

    if (
      simpleHash(pinInput) ===
      expectedHash
    ) {
      const next = [
        ...unlockedModes,
        pendingMode,
      ];

      setUnlockedModes(next);

      try {
        sessionStorage.setItem(
          UNLOCKED_MODES_KEY,
          JSON.stringify(next)
        );
      } catch {
        // sessionStorage niet beschikbaar — werkt dan gewoon voor deze
        // ene keer, en vraagt de volgende keer opnieuw.
      }

      setAppMode(pendingMode);
      setPendingMode(null);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  // NIEUW (punt 1): een rol vergrendelen — verwijdert 'm uit de
  // ontgrendelde rollen (dus de volgende keer moet de PIN opnieuw
  // ingevoerd worden) en gaat terug naar het startscherm. Nuttig bij een
  // shiftwissel, zodat de volgende operator niet zomaar verdergaat op de
  // sessie van de vorige.
  const handleLockAndGoHome = (
    mode: AppMode
  ) => {
    const next =
      unlockedModes.filter(
        (m) => m !== mode
      );

    setUnlockedModes(next);

    try {
      sessionStorage.setItem(
        UNLOCKED_MODES_KEY,
        JSON.stringify(next)
      );
    } catch {
      // sessionStorage niet beschikbaar — vergrendelen lukt dan niet
      // volledig, maar we gaan wel terug naar het startscherm.
    }

    setAppMode('home');
  };

  if (appMode === 'operator') {
    return (
      <OperatorApp
        onHome={() =>
          handleLockAndGoHome(
            'operator'
          )
        }
      />
    );
  }

  if (appMode === 'camera') {
    return (
      <CameraApp
        onHome={() =>
          handleLockAndGoHome(
            'camera'
          )
        }
      />
    );
  }

  if (appMode === 'waterspider') {
    return (
      <WaterspiderApp
        onHome={() =>
          handleLockAndGoHome(
            'waterspider'
          )
        }
      />
    );
  }

  if (appMode === 'manager') {
    return (
      <ManagerApp
        onHome={() =>
          handleLockAndGoHome(
            'manager'
          )
        }
      />
    );
  }

  const roleLabels: Record<
    string,
    string
  > = {
    operator: 'Operator',
    camera: 'Camera',
    waterspider:
      'Waterspider',
    manager: 'Manager',
  };

  return (
    <>
      <HomeScreen
        onSelect={handleSelect}
      />

      {pendingMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-1">
              Toegangscode
            </p>

            <h3 className="text-xl font-bold text-slate-900 mb-4">
              {roleLabels[
                pendingMode
              ] || pendingMode}
            </h3>

            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pinInput}
              onChange={(e) => {
                setPinInput(
                  e.target.value
                );
                setPinError(
                  false
                );
              }}
              onKeyDown={(e) => {
                if (
                  e.key ===
                  'Enter'
                ) {
                  handlePinSubmit();
                }
              }}
              placeholder="PIN-code"
              className={`w-full text-center tracking-[0.4em] text-2xl py-3 rounded-lg border-2 mb-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none ${
                pinError
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-200'
              }`}
            />

            {pinError && (
              <p className="text-sm text-red-600 mb-3">
                Onjuiste code, probeer opnieuw.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() =>
                  setPendingMode(
                    null
                  )
                }
                className="py-3 rounded-lg bg-slate-100 text-slate-700 font-medium text-center"
              >
                Annuleren
              </button>
              <button
                onClick={
                  handlePinSubmit
                }
                className="py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-center"
              >
                Bevestigen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   HOME SCREEN
   AANPASSING (punt 5): buitenkant is nu h-[100dvh] + overflow-y-auto
   zodat je op telefoon altijd tot de Waterspider-kaart kan scrollen.
   Kaarten zijn ook compacter op mobiel (p-6 i.p.v. p-8, mb-8 i.p.v. mb-12).
============================================================ */

// Officieel Sirris-logo, als data-URI ingebed (geen aparte afbeeldingen-upload nodig).
const SIRRIS_LOGO =
  'data:image/png;base64,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';

function HomeScreen({
  onSelect,
}: {
  onSelect: (
    mode: AppMode
  ) => void;
}) {
  return (
    <div className="h-[100dvh] bg-[#0B1929] overflow-y-auto">
      <div className="min-h-full flex items-start md:items-center justify-center px-5 py-8 md:p-6">

        <div className="w-full max-w-[1200px]">

          <div className="text-center mb-8 md:mb-12">

            <div className="flex justify-center mb-8">

              <div className="bg-white rounded-2xl px-8 py-5 shadow-lg">

                <img
                  src={SIRRIS_LOGO}
                  alt="Sirris — innovation forward"
                  className="h-12 md:h-14 w-auto"
                />

              </div>

            </div>

            <p className="text-blue-400 text-xs uppercase tracking-[0.25em] font-bold">
              HOUSE OF MANUFACTURING
            </p>

            <h1 className="text-white text-4xl md:text-5xl font-bold mt-3">
              Digital Workstation
            </h1>

            <p className="text-slate-400 mt-4 text-lg">
              Selecteer de interface voor dit toestel
            </p>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* OPERATOR */}
            <button
              onClick={() =>
                onSelect('operator')
              }
              className="group bg-white rounded-3xl p-6 md:p-8 text-left shadow-xl hover:-translate-y-1 transition-all"
            >

              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-7">

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="w-8 h-8 text-blue-600"
                  strokeWidth="1.8"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="13"
                    rx="2"
                  />

                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                </svg>

              </div>

              <p className="text-[11px] uppercase tracking-[0.18em] text-blue-500 font-bold">
                Werkpost
              </p>

              <h2 className="text-3xl font-bold text-slate-900 mt-2">
                Operator
              </h2>

              <p className="text-slate-500 mt-3 leading-relaxed">
                Digitale werkinstructies, omstelling, productie en kwaliteitscontrole.
              </p>

              <div className="mt-8 text-blue-600 font-bold flex items-center gap-2">
                Open interface

                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>

            </button>

            {/* CAMERA */}
            <button
              onClick={() =>
                onSelect('camera')
              }
              className="group bg-white rounded-3xl p-6 md:p-8 text-left shadow-xl hover:-translate-y-1 transition-all"
            >

              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-7">

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="w-8 h-8 text-emerald-600"
                  strokeWidth="1.8"
                >
                  <path d="M3 9a2 2 0 012-2h3l1.5-2h5L16 7h3a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />

                  <circle
                    cx="12"
                    cy="13"
                    r="4"
                  />
                </svg>

              </div>

              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-500 font-bold">
                Mobiele controle
              </p>

              <h2 className="text-3xl font-bold text-slate-900 mt-2">
                Camera
              </h2>

              <p className="text-slate-500 mt-3 leading-relaxed">
                Neem een controlefoto en analyseer automatisch de malpositionering.
              </p>

              <div className="mt-8 text-emerald-600 font-bold flex items-center gap-2">
                Open camera

                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>

            </button>

            {/* WATERSPIDER */}
            <button
              onClick={() =>
                onSelect(
                  'waterspider'
                )
              }
              className="group bg-white rounded-3xl p-6 md:p-8 text-left shadow-xl hover:-translate-y-1 transition-all"
            >

              <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-7">

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="w-8 h-8 text-amber-600"
                  strokeWidth="1.8"
                >
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />

                  <circle
                    cx="7"
                    cy="6"
                    r="2"
                    fill="currentColor"
                  />

                  <circle
                    cx="15"
                    cy="12"
                    r="2"
                    fill="currentColor"
                  />

                  <circle
                    cx="10"
                    cy="18"
                    r="2"
                    fill="currentColor"
                  />
                </svg>

              </div>

              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-600 font-bold">
                Logistiek · polstablet
              </p>

              <h2 className="text-3xl font-bold text-slate-900 mt-2">
                Waterspider
              </h2>

              <p className="text-slate-500 mt-3 leading-relaxed">
                Compacte weergave voor het polstablet (48×35mm) bij de pons: voorbereiding, materiaal en malcontrole.
              </p>

              <div className="mt-8 text-amber-600 font-bold flex items-center gap-2">
                Open interface

                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>

            </button>

            {/* MANAGER */}
            <button
              onClick={() =>
                onSelect(
                  'manager'
                )
              }
              className="group bg-white rounded-3xl p-6 md:p-8 text-left shadow-xl hover:-translate-y-1 transition-all"
            >

              <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-7">

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="w-8 h-8 text-violet-600"
                  strokeWidth="1.8"
                >
                  <path d="M3 3v18h18" />
                  <path d="M7 14l4-4 3 3 5-6" />
                </svg>

              </div>

              <p className="text-[11px] uppercase tracking-[0.18em] text-violet-600 font-bold">
                Overzicht · planning
              </p>

              <h2 className="text-3xl font-bold text-slate-900 mt-2">
                Manager
              </h2>

              <p className="text-slate-500 mt-3 leading-relaxed">
                Live status van Operator en Waterspider, kwaliteitsresultaten en omstellingen plannen.
              </p>

              <div className="mt-8 text-violet-600 font-bold flex items-center gap-2">
                Open interface

                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>

            </button>

          </div>

          <p className="text-center text-slate-500 text-xs mt-10">
            Sirris · House of Manufacturing
          </p>

        </div>

      </div>
    </div>
  );
}

/* ============================================================
   CAMERA APP  (ongewijzigd)
============================================================ */

function CameraApp({
  onHome,
}: {
  onHome: () => void;
}) {
  const videoRef =
    useRef<HTMLVideoElement>(
      null
    );

  const canvasRef =
    useRef<HTMLCanvasElement>(
      null
    );

  const streamRef =
    useRef<MediaStream | null>(
      null
    );

  const [
    cameraActive,
    setCameraActive,
  ] =
    useState(false);

  const [
    photoUrl,
    setPhotoUrl,
  ] =
    useState<string | null>(
      null
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    analysisResult,
    setAnalysisResult,
  ] =
    useState<AnalysisResult>(
      'idle'
    );

  const [
    detectedPercentage,
    setDetectedPercentage,
  ] =
    useState<number | null>(
      null
    );

  const [
    activeProduct,
    setActiveProduct,
  ] =
    useState<ProductType>(
      'product1'
    );

  // NIEUW: eerste keuze bij het openen van de Camera-interface —
  // Malcontrole (bestaande functionaliteit) of Productcontrole
  // (placeholder, wordt later toegevoegd via computer vision).
  const [
    checkMode,
    setCheckMode,
  ] =
    useState<
      'waiting' | 'select' | 'mal' | 'product'
    >('waiting');

  // NIEUW: onthoudt of het product automatisch (via de operator-status)
  // gekozen is, i.p.v. handmatig — enkel om er een klein label bij te
  // tonen, verandert verder niets aan de werking.
  const [
    autoSelected,
    setAutoSelected,
  ] =
    useState(false);

  // NIEUW: onthoudt in welke context de laatste controle gebeurde
  // (malcontrole na omstelling, of eindcontrole van het afgewerkt
  // product) — wordt meegestuurd met het resultaat zodat de Manager-
  // pagina dit correct kan onderscheiden en per type/product kan tellen.
  const [
    lastKnownContext,
    setLastKnownContext,
  ] =
    useState<
      | 'camera-check'
      | 'final-qc'
      | null
    >(null);

  const COLOR_THRESHOLD_PERCENT =
    0.02;

  // NIEUW: luister live mee met de status die de Operator-tablet
  // publiceert (hetzelfde kanaal als de Manager-pagina gebruikt), en
  // selecteer automatisch het juiste product — Product 1 of Product 2,
  // net naargelang wat de operator op dat moment aan het doen is.
  // Grijpt alleen in als er nog geen foto/analyse bezig is, zodat een
  // lopende controle niet onderbroken wordt.
  //
  // BUGFIX: hiervoor luisterden we ENKEL naar nieuwe (toekomstige)
  // ntfy-berichten via SSE. Stond de operator al op "Controle omstelling"
  // vóór de telefoon-app geopend werd, dan miste de telefoon dat bericht
  // volledig — er kwam gewoonweg geen nieuw bericht meer bij zolang de
  // operator op diezelfde pagina bleef staan, dus sprong de telefoon
  // nooit automatisch door. Daarom halen we nu bij het openen EERST het
  // laatst bekende bericht op via ntfy's poll-endpoint (inhaalslag),
  // en luisteren we DAARNA pas live verder via SSE.
  useEffect(() => {
    const handleStatus = (
      status: any
    ) => {
      if (
        status.source !==
        'operator'
      )
        return;

      if (
        cameraActive ||
        photoUrl ||
        analysisResult !==
          'idle'
      )
        return;

      // Altijd het NIEUWE/doelproduct (toProduct) — zowel bij de
      // malcontrole na het plaatsen van de nieuwe mal als bij de
      // eindcontrole van het afgewerkte product.
      const relevantProductName =
        status.toProduct;

      const mapped: ProductType =
        relevantProductName ===
        'Product 2'
          ? 'product2'
          : 'product1';

      setActiveProduct(
        (current) => {
          if (
            current !==
            mapped
          ) {
            setAutoSelected(
              true
            );
          }

          return mapped;
        }
      );

      // NIEUW: malcontrole (na plaatsen mal) → Malcontrole-scherm.
      // Eindcontrole van het afgewerkt product → Productcontrole-scherm
      // (nog een placeholder met enkel camera, geen automatische
      // analyse — dat volgt later via computer vision).
      if (
        status.currentStep ===
        'camera-check'
      ) {
        setLastKnownContext(
          'camera-check'
        );

        if (
          checkMode ===
          'waiting'
        ) {
          setCheckMode('mal');
        }
      } else if (
        status.currentStep ===
        'final-qc'
      ) {
        setLastKnownContext(
          'final-qc'
        );

        if (
          checkMode ===
          'waiting'
        ) {
          setCheckMode(
            'product'
          );
        }
      }
    };

    // Inhaalslag: haal het laatst bekende statusbericht op (ntfy houdt
    // recente berichten een tijdje in cache), zodat we niet moeten
    // wachten op een NIEUW bericht dat misschien nooit komt.
    fetch(
      `https://ntfy.sh/${NTFY_STATUS_TOPIC}/json?poll=1&since=2h`
    )
      .then((res) =>
        res.text()
      )
      .then((text) => {
        const lines = text
          .trim()
          .split('\n')
          .filter(Boolean);

        for (
          let i =
            lines.length -
            1;
          i >= 0;
          i--
        ) {
          try {
            const msg =
              JSON.parse(
                lines[i]
              );

            if (
              !msg.message
            )
              continue;

            const status =
              JSON.parse(
                msg.message
              );

            if (
              status.source ===
              'operator'
            ) {
              handleStatus(
                status
              );

              break;
            }
          } catch {
            // Ongeldige regel — overslaan.
          }
        }
      })
      .catch(() => {
        // Geen internet of ntfy.sh niet bereikbaar — de inhaalslag
        // lukt dan niet, live meeluisteren hieronder blijft wel proberen.
      });

    let es: EventSource | null =
      null;

    try {
      es = new EventSource(
        `https://ntfy.sh/${NTFY_STATUS_TOPIC}/sse`
      );

      es.onmessage = (
        event
      ) => {
        try {
          const envelope =
            JSON.parse(
              event.data
            );

          if (
            !envelope?.message
          )
            return;

          const status =
            JSON.parse(
              envelope.message
            );

          handleStatus(
            status
          );
        } catch {
          // Geen geldig statusbericht — negeren.
        }
      };
    } catch {
      // ntfy.sh niet bereikbaar — productkeuze blijft dan gewoon handmatig.
    }

    return () => es?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cameraActive,
    photoUrl,
    analysisResult,
    checkMode,
  ]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );

      streamRef.current =
        null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject =
        null;
    }

    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera =
    async () => {
      try {
        setError(null);
        setPhotoUrl(null);
        setAnalysisResult(
          'idle'
        );

        setDetectedPercentage(
          null
        );

        if (
          !navigator
            .mediaDevices
            ?.getUserMedia
        ) {
          setError(
            'Deze browser ondersteunt geen cameratoegang.'
          );

          return;
        }

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                facingMode: {
                  ideal:
                    'environment',
                },

                width: {
                  ideal: 1920,
                },

                height: {
                  ideal: 1080,
                },
              },

              audio: false,
            }
          );

        streamRef.current =
          stream;

        if (
          videoRef.current
        ) {
          videoRef.current.srcObject =
            stream;

          await videoRef.current.play();

          setCameraActive(
            true
          );
        }
      } catch (err) {
        console.error(err);

        setError(
          'Camera kon niet geopend worden. Controleer of je cameratoegang hebt toegestaan.'
        );
      }
    };

  const takePhoto = () => {
    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    if (
      !video ||
      !canvas
    ) {
      return;
    }

    if (
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setError(
        'De camera is nog niet klaar. Probeer opnieuw.'
      );

      return;
    }

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const ctx =
      canvas.getContext(
        '2d'
      );

    if (!ctx) {
      return;
    }

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const image =
      canvas.toDataURL(
        'image/jpeg',
        0.92
      );

    setPhotoUrl(image);
    setAnalysisResult(
      'idle'
    );

    setDetectedPercentage(
      null
    );

    stopCamera();
  };

  const analyseImage = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx =
      canvas.getContext(
        '2d'
      );

    if (!ctx) {
      return;
    }

    const zoneX =
      Math.floor(
        canvas.width *
          0.15
      );

    const zoneY =
      Math.floor(
        canvas.height *
          0.15
      );

    const zoneWidth =
      Math.floor(
        canvas.width *
          0.70
      );

    const zoneHeight =
      Math.floor(
        canvas.height *
          0.70
      );

    const imageData =
      ctx.getImageData(
        zoneX,
        zoneY,
        zoneWidth,
        zoneHeight
      );

    const pixels =
      imageData.data;

    let detectedPixels =
      0;

    let totalPixels =
      0;

    for (
      let i = 0;
      i <
      pixels.length;
      i += 4
    ) {
      const r =
        pixels[i] /
        255;

      const g =
        pixels[i + 1] /
        255;

      const b =
        pixels[i + 2] /
        255;

      const max =
        Math.max(
          r,
          g,
          b
        );

      const min =
        Math.min(
          r,
          g,
          b
        );

      const delta =
        max - min;

      let h = 0;

      if (
        delta !== 0
      ) {
        if (max === r) {
          h =
            60 *
            (((g - b) /
              delta) %
              6);
        } else if (
          max === g
        ) {
          h =
            60 *
            ((b - r) /
              delta +
              2);
        } else {
          h =
            60 *
            ((r - g) /
              delta +
              4);
        }
      }

      if (h < 0) {
        h += 360;
      }

      const s =
        max === 0
          ? 0
          : delta /
            max;

      const v = max;

      totalPixels++;

      let isTargetColor =
        false;

      if (
        activeProduct ===
        'product1'
      ) {
        isTargetColor =
          h >= 190 &&
          h <= 250 &&
          s > 0.50 &&
          v > 0.20;
      }

      if (
        activeProduct ===
        'product2'
      ) {
        isTargetColor =
          h >= 40 &&
          h <= 70 &&
          s > 0.50 &&
          v > 0.30;
      }

      if (
        isTargetColor
      ) {
        detectedPixels++;
      }
    }

    const percentage =
      totalPixels > 0
        ? (detectedPixels /
            totalPixels) *
          100
        : 0;

    setDetectedPercentage(
      percentage
    );

    const checkStatus =
      percentage >
      COLOR_THRESHOLD_PERCENT
        ? 'error'
        : 'ok';

    // Schrijf het resultaat weg in localStorage (werkt als telefoon en
    // tablet toevallig dezelfde browser delen) EN publiceer het via
    // ntfy.sh (werkt ook tussen écht aparte fysieke toestellen, zolang
    // beide internet hebben). CameraCheckScreen / FinalQCScreen luisteren
    // hierop mee.
    try {
      localStorage.setItem(
        'camera_check_result',
        JSON.stringify({
          product: activeProduct,
          status: checkStatus,
          percentage,
          context:
            lastKnownContext,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Demo blijft werken als localStorage niet beschikbaar is.
    }

    fetch(
      `https://ntfy.sh/${NTFY_TOPIC}`,
      {
        method: 'POST',
        body: JSON.stringify({
          product: activeProduct,
          status: checkStatus,
          percentage,
          context:
            lastKnownContext,
          timestamp: Date.now(),
        }),
      }
    ).catch(() => {
      // Geen internet of ntfy.sh niet bereikbaar — de knoppen op de
      // tablet blijven dan de enige manier om verder te gaan.
    });

    if (
      percentage >
      COLOR_THRESHOLD_PERCENT
    ) {
      setAnalysisResult(
        'error'
      );
    } else {
      setAnalysisResult(
        'ok'
      );
    }
  };

  const retakePhoto =
    async () => {
      setPhotoUrl(null);

      setAnalysisResult(
        'idle'
      );

      setDetectedPercentage(
        null
      );

      await startCamera();
    };

  const resetTest =
    () => {
      stopCamera();

      setPhotoUrl(null);

      setAnalysisResult(
        'idle'
      );

      setDetectedPercentage(
        null
      );

      setError(null);
    };

  // AANPASSING (bugfix): dit stond eerst als losse setTimeout() binnen
  // analyseImage() zelf — niet betrouwbaar genoeg (geen opruiming bij
  // een nieuwe/snelle volgende analyse, en de closure kon een verouderde
  // 'checkMode' bevatten). Nu een aparte, opgeruimde useEffect: zodra er
  // een resultaat is (ok/error), start een timer van 3 seconden die
  // terugkeert naar de basiswachtpagina. Wordt er tussentijds een
  // nieuwe foto genomen (analysisResult verandert), dan wordt de oude
  // timer eerst netjes geannuleerd — zo kunnen er nooit twee
  // overlappende resets tegelijk lopen.
  useEffect(() => {
    if (
      analysisResult !==
        'ok' &&
      analysisResult !==
        'error'
    )
      return;

    const timer =
      window.setTimeout(
        () => {
          resetTest();
          setCheckMode(
            'waiting'
          );
        },
        3000
      );

    return () =>
      window.clearTimeout(
        timer
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResult]);

  const switchProduct = (
    product: ProductType
  ) => {
    stopCamera();

    setPhotoUrl(null);

    setAnalysisResult(
      'idle'
    );

    setDetectedPercentage(
      null
    );

    setError(null);

    setActiveProduct(
      product
    );

    // Handmatige keuze door de operator zelf — het "automatisch"-label
    // is dan niet meer van toepassing.
    setAutoSelected(false);
  };

  const productName =
    activeProduct ===
    'product1'
      ? 'Product 1'
      : 'Product 2';

  const targetColor =
    activeProduct ===
    'product1'
      ? 'blauw'
      : 'geel';

  const targetColorLabel =
    activeProduct ===
    'product1'
      ? 'Blauwe'
      : 'Gele';

  // NIEUW: basiswachtpagina — geopend op de telefoon voordat de operator
  // effectief een controle nodig heeft. Springt automatisch door naar
  // Malcontrole zodra de operator op "Controle omstelling" of
  // "Eindcontrole" komt (zie de status-listener hierboven). De 2 kleine
  // knopjes onderaan zijn een bewust onopvallend vangnet voor als de
  // automatische doorschakeling niet werkt (bv. geen internet).
  if (checkMode === 'waiting') {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex flex-col relative">

        <header className="bg-[#0B1929] px-5 py-5 flex items-center gap-4">
          <button
            onClick={onHome}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            ←
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-bold">
              CAMERA
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Klaar voor controle
            </h1>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Wachten op de operator…
          </h2>
          <p className="text-slate-500 max-w-sm">
            Zodra de operator een malcontrole of eindcontrole nodig heeft, opent dit scherm vanzelf de juiste controle.
          </p>
        </main>

        {/* Klein, onopvallend vangnet — enkel voor als het automatisch
            doorschakelen niet lukt. */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1">
          <button
            onClick={() => setCheckMode('mal')}
            aria-label="Handmatig naar malcontrole (fallback)"
            className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 opacity-40" />
          </button>
          <button
            onClick={() => setCheckMode('select')}
            aria-label="Handmatig scherm kiezen (fallback)"
            className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 opacity-40" />
          </button>
        </div>
      </div>
    );
  }

  // NIEUW: eerste scherm bij het openen van de Camera-interface — kies
  // tussen Malcontrole (werkt al) en Productcontrole (placeholder,
  // computer vision volgt later).
  // AANPASSING: volledig scherm i.p.v. een gecentreerde kaart met
  // donkere rand — consistent met Operator en Waterspider.
  if (checkMode === 'select') {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 overflow-y-auto">

        <header className="bg-[#0B1929] px-5 py-5 flex items-center gap-4 sticky top-0 z-10">

          <button
            onClick={onHome}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center flex-shrink-0"
          >
            ←
          </button>

          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-bold">
              CAMERA
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Wat wil je controleren?
            </h1>
          </div>

        </header>

        <main className="p-5 md:p-8 space-y-4 max-w-[640px] mx-auto">

          <button
            onClick={() =>
              setCheckMode('mal')
            }
            className="w-full text-left bg-white border-2 border-slate-200 hover:border-blue-400 rounded-2xl p-6 transition-colors"
          >
            <p className="text-[11px] uppercase tracking-[0.15em] text-blue-500 font-bold">
              Beschikbaar
            </p>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              Malcontrole
            </h2>
            <p className="text-slate-500 mt-2">
              Controleer of de mal correct gemonteerd/verwisseld is (kleurherkenning).
            </p>
          </button>

          <button
            onClick={() =>
              setCheckMode('product')
            }
            className="w-full text-left bg-white border-2 border-dashed border-amber-300 hover:border-amber-400 rounded-2xl p-6 transition-colors"
          >
            <p className="text-[11px] uppercase tracking-[0.15em] text-amber-500 font-bold">
              Binnenkort — computer vision
            </p>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              Productcontrole
            </h2>
            <p className="text-slate-500 mt-2">
              Automatische eindcontrole van het afgewerkte product. De camera werkt al; de analyse volgt later.
            </p>
          </button>

        </main>

      </div>
    );
  }

  // NIEUW: Productcontrole — voorlopig enkel de camera, nog geen
  // automatische analyse (dat volgt later via computer vision). Neemt
  // een foto en toont die, maar publiceert bewust geen resultaat — de
  // handmatige knoppen op het operator-scherm blijven voor nu de manier
  // om verder te gaan na een eindcontrole.
  if (checkMode === 'product') {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 overflow-y-auto">

        <header className="bg-[#0B1929] px-5 py-5 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => {
                stopCamera();
                setCheckMode('select');
              }}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center flex-shrink-0"
            >
              ←
            </button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold">
                CAMERA · PRODUCTCONTROLE
              </p>
              <h1 className="text-xl md:text-2xl font-bold text-white truncate">
                Eindcontrole product
              </h1>
            </div>
          </div>
        </header>

        <main className="p-5 md:p-10 max-w-[1100px] mx-auto">

          <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-5 mb-6">
            <p className="text-sm text-amber-800 font-medium">
              Deze functie is nog in ontwikkeling: de camera werkt, maar er gebeurt nog geen automatische analyse. Gebruik voorlopig de handmatige knoppen op het operator-scherm om verder te gaan.
            </p>
          </div>

          <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
            {!cameraActive && !photoUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-5">
                  <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 9a2 2 0 012-2h2l1.5-2h7L17 7h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="4" strokeWidth={1.7} />
                  </svg>
                </div>
                <p className="font-semibold text-white">Camera nog niet geopend</p>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />

            {photoUrl && (
              <img src={photoUrl} alt="Product" className="absolute inset-0 w-full h-full object-cover" />
            )}

            {cameraActive && (
              <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="mt-6">
            {!cameraActive && !photoUrl && (
              <button
                onClick={startCamera}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white text-lg py-4 px-6 rounded-lg transition-colors font-medium shadow-sm"
              >
                Camera openen
              </button>
            )}

            {cameraActive && (
              <button
                onClick={takePhoto}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-4 px-6 rounded-lg transition-colors font-medium shadow-sm"
              >
                📷 Foto nemen
              </button>
            )}

            {photoUrl && (
              <button
                onClick={resetTest}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white text-lg py-4 px-6 rounded-lg transition-colors font-medium shadow-sm"
              >
                Nieuwe foto
              </button>
            )}
          </div>

        </main>

      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-slate-50 overflow-y-auto">

      <header className="bg-[#0B1929] px-5 py-5 flex items-center justify-between gap-4 sticky top-0 z-10">

        <div className="flex items-center gap-4 min-w-0">

          <button
            onClick={() => {
              stopCamera();
              setCheckMode('select');
            }}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center flex-shrink-0"
          >
            ←
          </button>

          <div className="min-w-0">

            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-bold">
              CAMERA · MALCONTROLE
            </p>

            <h1 className="text-xl md:text-2xl font-bold text-white truncate">
              Visuele malcontrole
            </h1>

          </div>

        </div>

        <div
          className={`px-3 md:px-4 py-2 rounded-full text-[10px] md:text-xs font-bold flex-shrink-0 ${
            cameraActive
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-slate-700 text-slate-300'
          }`}
        >
          {cameraActive
            ? '● CAMERA ACTIEF'
            : 'CAMERA STAND-BY'}
        </div>

      </header>

      <main className="p-5 md:p-10 max-w-[1100px] mx-auto">
        <div className="mb-7">

            <p className="text-xs uppercase tracking-[0.15em] text-slate-400 font-bold mb-3 flex items-center gap-2">
              Selecteer product

              {autoSelected && (
                <span className="normal-case tracking-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  ● Automatisch gekozen (operator)
                </span>
              )}
            </p>

            <div className="grid grid-cols-2 gap-3 max-w-lg">

              <button
                onClick={() =>
                  switchProduct(
                    'product1'
                  )
                }
                className={`h-16 rounded-xl font-bold ${
                  activeProduct ===
                  'product1'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border-2 border-slate-200 text-slate-700'
                }`}
              >
                Product 1

                <span className="block text-xs font-normal opacity-80 mt-1">
                  controle op blauw
                </span>
              </button>

              <button
                onClick={() =>
                  switchProduct(
                    'product2'
                  )
                }
                className={`h-16 rounded-xl font-bold ${
                  activeProduct ===
                  'product2'
                    ? 'bg-yellow-400 text-slate-900'
                    : 'bg-white border-2 border-slate-200 text-slate-700'
                }`}
              >
                Product 2

                <span className="block text-xs font-normal opacity-80 mt-1">
                  controle op geel
                </span>
              </button>

            </div>

          </div>

          <div className="mb-6">

            <h2 className="text-xl md:text-2xl font-bold text-slate-900">
              Controleer mal {productName}
            </h2>

            <p className="text-slate-500 mt-2">
              Wanneer de mal correct gemonteerd is, mag binnen het witte controlevak geen {targetColor} meer zichtbaar zijn.
            </p>

          </div>

          <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">

            {!cameraActive &&
              !photoUrl && (

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">

                <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-5">

                  <svg
                    className="w-10 h-10 text-slate-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.7}
                      d="M3 9a2 2 0 012-2h2l1.5-2h7L17 7h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />

                    <circle
                      cx="12"
                      cy="13"
                      r="4"
                      strokeWidth={1.7}
                    />

                  </svg>

                </div>

                <p className="font-semibold text-white">
                  Camera nog niet geopend
                </p>

              </div>

            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${
                cameraActive
                  ? 'block'
                  : 'hidden'
              }`}
            />

            {photoUrl && (

              <img
                src={photoUrl}
                alt="Controlefoto"
                className="absolute inset-0 w-full h-full object-cover"
              />

            )}

            {(cameraActive ||
              photoUrl) && (

              <div
                className="
                  absolute
                  left-[15%]
                  top-[15%]
                  w-[70%]
                  h-[70%]
                  border-4
                  border-white
                  rounded-xl
                  pointer-events-none
                  shadow-[0_0_0_9999px_rgba(0,0,0,0.15)]
                "
              >

                <div className="absolute -top-9 left-0 bg-white text-slate-900 text-xs font-bold px-3 py-1 rounded-md">
                  CONTROLEZONE
                </div>

              </div>

            )}

            {cameraActive && (

              <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">

                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />

                LIVE

              </div>

            )}

            {analysisResult ===
              'ok' && (

              <div className="absolute inset-0 bg-emerald-950/75 flex flex-col items-center justify-center text-white text-center px-6">

                <div className="w-20 md:w-24 h-20 md:h-24 rounded-full bg-emerald-500 flex items-center justify-center text-4xl md:text-5xl font-bold mb-5">
                  ✓
                </div>

                <p className="text-3xl md:text-4xl font-bold">
                  OK
                </p>

                <p className="mt-3 text-lg md:text-xl font-semibold text-emerald-100">
                  Mal {productName} goed gemonteerd
                </p>

                <p className="mt-2 text-sm text-emerald-200">
                  Geen {targetColor} meer zichtbaar
                </p>

              </div>

            )}

            {analysisResult ===
              'error' && (

              <div className="absolute inset-0 bg-red-950/75 flex flex-col items-center justify-center text-white text-center px-6">

                <div className="w-20 md:w-24 h-20 md:h-24 rounded-full bg-red-500 flex items-center justify-center text-4xl md:text-5xl font-bold mb-5">
                  !
                </div>

                <p className="text-3xl md:text-4xl font-bold">
                  FOUT
                </p>

                <p className="mt-3 text-lg md:text-xl font-semibold text-red-100">
                  Mal {productName} niet correct gemonteerd
                </p>

                <p className="mt-2 text-sm text-red-200">
                  {targetColorLabel} referentie is nog zichtbaar
                </p>

              </div>

            )}

            <canvas
              ref={canvasRef}
              className="hidden"
            />

          </div>

          {error && (

            <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-4">

              <p className="font-semibold text-red-700">
                Camera probleem
              </p>

              <p className="text-sm text-red-600 mt-1">
                {error}
              </p>

            </div>

          )}

          {detectedPercentage !==
            null && (

            <div className="mt-5 grid grid-cols-2 gap-4">

              <div className="bg-white border border-slate-200 rounded-xl p-4">

                <p className="text-xs text-slate-400 uppercase font-bold">
                  {targetColorLabel} pixels
                </p>

                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {detectedPercentage.toFixed(
                    3
                  )}
                  %
                </p>

              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">

                <p className="text-xs text-slate-400 uppercase font-bold">
                  Foutdrempel
                </p>

                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {COLOR_THRESHOLD_PERCENT}%
                </p>

              </div>

            </div>

          )}

          <div className="mt-6">

            {!cameraActive &&
              !photoUrl && (

              <button
                onClick={
                  startCamera
                }
                className="w-full h-14 rounded-xl bg-[#3B82F6] text-white font-bold text-lg"
              >
                Camera openen
              </button>

            )}

            {cameraActive && (

              <button
                onClick={
                  takePhoto
                }
                className="w-full h-14 rounded-xl bg-[#3B82F6] text-white font-bold text-lg"
              >
                📷 Foto nemen
              </button>

            )}

            {photoUrl &&
              analysisResult ===
                'idle' && (

              <div className="grid grid-cols-2 gap-3 md:gap-4">

                <button
                  onClick={
                    retakePhoto
                  }
                  className="h-14 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-bold"
                >
                  Foto opnieuw
                </button>

                <button
                  onClick={
                    analyseImage
                  }
                  className="h-14 rounded-xl bg-[#3B82F6] text-white font-bold"
                >
                  Analyseer
                </button>

              </div>

            )}

            {analysisResult !==
              'idle' && (

              <button
                onClick={
                  resetTest
                }
                className="w-full h-14 rounded-xl bg-[#3B82F6] text-white font-bold text-lg"
              >
                Nieuwe controle
              </button>

            )}

          </div>

        </main>

    </div>
  );
}

/* ============================================================
   OPERATOR APP
   AANPASSING: geen kunstmatig tablet-frame meer — draait gewoon
   full-screen op het toestel waarop hij geopend wordt.
   Bevat de changeoverTrigger-logica voor "Omstelling na dit product"
   en "Wissel nu", en de per-product malcontrole-status
   (cameraCheckVerifiedFor).
============================================================ */

function OperatorApp({
  onHome,
}: {
  onHome: () => void;
}) {
  // NIEUW (punt 2): sessiestatus wordt bewaard in localStorage, zodat een
  // ongewenste paginaverversing of browsercrash op de tablet niet alle
  // voortgang wist. Wordt één keer per mount ingelezen; de useEffect
  // verderop schrijft wijzigingen automatisch terug weg.
  const OPERATOR_STORAGE_KEY =
    'sirris_operator_state_v1';

  const savedOperatorState = (() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          OPERATOR_STORAGE_KEY
        ) || 'null'
      );
    } catch {
      return null;
    }
  })();

  const [
    direction,
    setDirection,
  ] =
    useState<ChangeoverDirection>(
      savedOperatorState?.direction ??
        'P1_TO_P2'
    );

  const [
    currentStep,
    setCurrentStep,
  ] =
    useState<FlowStep>(
      savedOperatorState?.currentStep ??
        'product1-approved'
    );

  const [
    sessionData,
    setSessionData,
  ] =
    useState<SessionData>(
      savedOperatorState?.sessionData ?? {
        changeoverCompleted:
          false,

        cameraCheckPassed:
          false,

        product2Assembled:
          false,

        finalQCPassed:
          false,

        firstTimeRight:
          true,

        timestamps: {},
      }
    );

  const [
    showWarning,
    setShowWarning,
  ] =
    useState(false);

  const [
    elapsedTime,
    setElapsedTime,
  ] =
    useState(0);

  const [
    operatorSettings,
    setOperatorSettings,
  ] =
    useState<OperatorSettings>(
      savedOperatorState?.operatorSettings ?? {
        operatorName:
          'J. de Vries',

        line:
          'Lijn 4',

        station:
          'Stat. 2',

        shift:
          'Dagdienst',
      }
    );

  const [
    plannedChangeovers,
    setPlannedChangeovers,
  ] =
    useState<
      PlannedChangeover[]
    >(
      savedOperatorState?.plannedChangeovers ??
        []
    );

  const [
    sessionHistory,
    setSessionHistory,
  ] =
    useState<any[]>(
      savedOperatorState?.sessionHistory ??
        []
    );

  const [
    navigationHistory,
    setNavigationHistory,
  ] =
    // AANPASSING (bugfix): begint met het startscherm erin i.p.v. leeg —
    // anders werkte "terug" niet vanuit Instellingen bij een verse sessie.
    useState<FlowStep[]>(
      savedOperatorState?.navigationHistory ?? [
        'product1-approved',
      ]
    );

  // NIEUW (punt 3 & 4): hoe de eerstvolgende/huidige omstelling getriggerd is
  const [
    changeoverTrigger,
    setChangeoverTrigger,
  ] =
    useState<ChangeoverTrigger>(
      savedOperatorState?.changeoverTrigger ??
        'scheduled'
    );

  // NIEUW: onthoudt voor WELK product de malcontrole (camera) het laatst
  // goedgekeurd is. Zolang het huidige "toProduct" hetzelfde blijft, hoeft
  // de malcontrole niet opnieuw — pas bij een wissel naar het andere
  // product (toProduct verandert) is een nieuwe controle nodig.
  const [
    cameraCheckVerifiedFor,
    setCameraCheckVerifiedFor,
  ] =
    useState<
      string | null
    >(
      savedOperatorState?.cameraCheckVerifiedFor ??
        null
    );

  // NIEUW: onthoudt via welk pad de malcontrole (camera-check) bereikt
  // werd — 'guided' = ingebouwd na stap 2 van de begeleide omstelling
  // (dan gaat het bij goedkeuring verder naar stap 3, en bij afkeuring
  // terug naar stap 2 om de mal te corrigeren); 'quick' = via de
  // waarschuwing op het dashboard (het oude, snelle pad).
  const [
    cameraCheckOrigin,
    setCameraCheckOrigin,
  ] =
    useState<
      'guided' | 'quick'
    >(
      savedOperatorState?.cameraCheckOrigin ??
        'quick'
    );

  // NIEUW (punt 5): hoeveelheid-tracking voor de huidige productieopdracht.
  // orderQuantity = het aantal dat de manager heeft opgegeven bij het
  // plannen van de omstelling (standaard 50 als er niets is meegegeven).
  // producedCount = hoeveel stuks daarvan al goedgekeurd zijn. Reset bij
  // een ECHTE omstelling naar een ander product; blijft oplopen zolang
  // hetzelfde product herhaald wordt (zie handleStartNextCycle).
  const [
    orderQuantity,
    setOrderQuantity,
  ] =
    useState(
      savedOperatorState?.orderQuantity ??
        50
    );

  const [
    producedCount,
    setProducedCount,
  ] =
    useState(
      savedOperatorState?.producedCount ??
        0
    );

  // NIEUW (punt 2): schrijf de belangrijkste sessiestatus telkens terug
  // naar localStorage zodra ze wijzigt. "elapsedTime" en "showWarning"
  // bewust NIET bewaard — die horen bij het huidige moment, niet bij een
  // te herstellen sessie (de omsteltimer wordt sowieso herberekend vanuit
  // sessionData.changeoverStartTime).
  useEffect(() => {
    try {
      localStorage.setItem(
        OPERATOR_STORAGE_KEY,
        JSON.stringify({
          direction,
          currentStep,
          sessionData,
          operatorSettings,
          plannedChangeovers,
          sessionHistory,
          navigationHistory,
          changeoverTrigger,
          cameraCheckVerifiedFor,
          cameraCheckOrigin,
          orderQuantity,
          producedCount,
        })
      );
    } catch {
      // localStorage niet beschikbaar — sessie wordt dan niet hersteld
      // na een verversing, maar de app blijft verder gewoon werken.
    }
  }, [
    direction,
    currentStep,
    sessionData,
    operatorSettings,
    plannedChangeovers,
    sessionHistory,
    navigationHistory,
    changeoverTrigger,
    cameraCheckVerifiedFor,
    cameraCheckOrigin,
    orderQuantity,
    producedCount,
  ]);

  useEffect(() => {
    if (
      sessionData.changeoverStartTime &&
      currentStep !==
        'finish'
    ) {
      const interval =
        setInterval(() => {

          setElapsedTime(
            Math.floor(
              (Date.now() -
                sessionData.changeoverStartTime!) /
                1000
            )
          );

        }, 1000);

      return () =>
        clearInterval(
          interval
        );
    }
  }, [
    sessionData.changeoverStartTime,
    currentStep,
  ]);

  // NIEUW: publiceer periodiek de operator-status naar ntfy.sh zodat de
  // Manager-pagina live kan meekijken, ook op een apart fysiek toestel.
  useEffect(() => {
    const currentFromProduct =
      direction === 'P1_TO_P2'
        ? 'Product 1'
        : 'Product 2';

    const currentToProduct =
      direction === 'P1_TO_P2'
        ? 'Product 2'
        : 'Product 1';

    fetch(
      `https://ntfy.sh/${NTFY_STATUS_TOPIC}`,
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'operator',
          currentStep,
          fromProduct:
            currentFromProduct,
          toProduct:
            currentToProduct,
          operatorName:
            operatorSettings.operatorName,
          line: operatorSettings.line,
          station:
            operatorSettings.station,
          timestamp: Date.now(),
        }),
      }
    ).catch(() => {
      // Geen internet — de Manager-pagina toont dan gewoon geen live status.
    });
  }, [
    currentStep,
    direction,
    operatorSettings,
  ]);

  // NIEUW: luister live mee op geplande omstellingen die de Manager
  // publiceert. Trigger "now" onderbreekt de huidige cyclus meteen; de
  // andere triggers ("after-current-product" / "scheduled") komen in de
  // wachtrij (plannedChangeovers) en worden pas verwerkt bij het
  // volgende product (zie handleStartNextCycle).
  useEffect(() => {
    let es: EventSource | null =
      null;

    try {
      es = new EventSource(
        `https://ntfy.sh/${NTFY_CHANGEOVER_TOPIC}/sse`
      );

      es.onmessage = (
        event
      ) => {
        try {
          const envelope =
            JSON.parse(
              event.data
            );

          if (
            !envelope?.message
          )
            return;

          const plan =
            JSON.parse(
              envelope.message
            );

          if (
            plan.trigger ===
            'now'
          ) {
            const newDirection: ChangeoverDirection =
              plan.toProduct ===
              'Product 2'
                ? 'P1_TO_P2'
                : 'P2_TO_P1';

            setDirection(
              newDirection
            );

            setSessionData({
              changeoverCompleted:
                false,

              cameraCheckPassed:
                false,

              product2Assembled:
                false,

              finalQCPassed:
                false,

              firstTimeRight:
                true,

              changeoverStartTime:
                Date.now(),

              timestamps: {},
            });

            setElapsedTime(0);

            setChangeoverTrigger(
              'now'
            );

            // NIEUW (punt 5): nieuwe order, teller op 0 en de door de
            // manager opgegeven hoeveelheid overnemen.
            setProducedCount(
              0
            );

            setOrderQuantity(
              plan.quantity ||
                50
            );

            // AANPASSING: "Wissel nu" toont nu eerst de productwissel-
            // pagina (felle kleuren, duidelijk een échte omstelling),
            // niet meteen het dashboard.
            setNavigationHistory(
              [
                'main-dashboard',
                'changeover-command',
              ]
            );

            setCurrentStep(
              'changeover-command'
            );
          } else {
            setPlannedChangeovers(
              (prev) => [
                ...prev,

                {
                  fromProduct:
                    plan.fromProduct,

                  toProduct:
                    plan.toProduct,

                  line:
                    plan.line ||
                    operatorSettings.line,

                  station:
                    plan.station ||
                    operatorSettings.station,

                  plannedDate:
                    plan.plannedDate ||
                    '',

                  plannedTime:
                    plan.plannedTime ||
                    '',

                  quantity:
                    plan.quantity ||
                    50,

                  status:
                    'Gepland',
                },
              ]
            );
          }
        } catch {
          // Geen geldig bericht — negeren.
        }
      };
    } catch {
      // ntfy.sh niet bereikbaar — de operator ontvangt dan geen
      // manager-planning; die blijft in dat geval leeg.
    }

    return () =>
      es?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTimestamp = (
    key: string
  ) => {
    setSessionData(
      (prev) => ({
        ...prev,

        timestamps: {
          ...prev.timestamps,

          [key]:
            Date.now(),
        },
      })
    );
  };

  const navigateTo = (
    step: FlowStep
  ) => {
    setNavigationHistory(
      (prev) => [
        ...prev,
        step,
      ]
    );

    setCurrentStep(step);
  };

  const goBack = () => {
    if (
      navigationHistory.length >
      1
    ) {
      const newHistory = [
        ...navigationHistory,
      ];

      newHistory.pop();

      const previousStep =
        newHistory[
          newHistory.length -
            1
        ];

      setNavigationHistory(
        newHistory
      );

      setCurrentStep(
        previousStep
      );
    }
  };

  const handleStartNextCycle =
    () => {

      setSessionHistory(
        (prev) => [
          ...prev,

          {
            direction,

            sessionData,

            totalTime:
              elapsedTime,

            timestamp:
              Date.now(),
          },
        ]
      );

      // Is er een omstelling gepland die vertrekt vanaf het product dat
      // we net hebben afgewerkt? Dan die uitvoeren. Zo niet: gewoon
      // hetzelfde product opnieuw maken (geen nieuwe omstelling nodig —
      // mal en malcontrole blijven geldig).
      const dueChangeover =
        plannedChangeovers.find(
          (c) =>
            c.fromProduct ===
            toProduct
        );

      if (dueChangeover) {
        setPlannedChangeovers(
          (prev) =>
            prev.filter(
              (c) =>
                c !==
                dueChangeover
            )
        );

        const newDirection: ChangeoverDirection =
          dueChangeover.toProduct ===
          'Product 2'
            ? 'P1_TO_P2'
            : 'P2_TO_P1';

        setDirection(
          newDirection
        );

        setSessionData({
          changeoverCompleted:
            false,

          cameraCheckPassed:
            false,

          product2Assembled:
            false,

          finalQCPassed:
            false,

          firstTimeRight:
            true,

          timestamps: {},
        });

        setElapsedTime(0);

        // De kwaliteitscontrole en afvoer van het vorige product zijn
        // op dit moment al uitgevoerd. Ga daarom rechtstreeks naar
        // de oranje pagina met de nieuwe productieopdracht.
        setNavigationHistory([
          'changeover-command',
        ]);

        setChangeoverTrigger(
          'scheduled'
        );

        // Nieuwe order: teller opnieuw op 0 en de geplande hoeveelheid
        // van de manager overnemen.
        setProducedCount(0);

        setOrderQuantity(
          dueChangeover.quantity ||
            50
        );

        setCurrentStep(
          'changeover-command'
        );
      } else {
        // Zelfde product opnieuw: sla de hele omstellingsflow over en
        // ga meteen terug de productie in.
        setSessionData(
          (prev) => ({
            ...prev,

            product2Assembled:
              false,

            finalQCPassed:
              false,

            firstTimeRight:
              true,

            timestamps: {},
          })
        );

        setElapsedTime(0);

        setNavigationHistory(
          [
            'main-dashboard',
            'production',
          ]
        );

        setCurrentStep(
          'production'
        );
      }
    };

  const handleProduct1Release =
    () => {
      const now =
        Date.now();

      addTimestamp(
        'product1Released'
      );

      // AANPASSING: de omsteltijd start nu al vanaf hier, want de
      // volgorde is omgedraaid — eerst "waar naartoe" (remove-product1),
      // dan pas de productwissel-pagina (changeover-command).
      setSessionData(
        (prev) => ({
          ...prev,

          changeoverStartTime:
            now,

          timestamps: {
            ...prev.timestamps,

            changeoverStarted:
              now,
          },
        })
      );

      navigateTo(
        'remove-product1'
      );
    };

  const handleProductRemoved =
    () => {
      addTimestamp(
        'product1Removed'
      );

      navigateTo(
        'changeover-command'
      );
    };

  const handleCommandConfirm =
    () => {
      navigateTo(
        'main-dashboard'
      );
    };

  const handleStartChangeover =
    () => {
      addTimestamp(
        'changeoverGuidedStart'
      );

      navigateTo(
        'changeover-step1'
      );
    };

  const handleStartProduction =
    () => {

      if (
        !sessionData.changeoverCompleted &&
        cameraCheckVerifiedFor !==
          toProduct
      ) {
        setShowWarning(
          true
        );
      } else {

        addTimestamp(
          'productionStarted'
        );

        navigateTo(
          'production'
        );
      }
    };

  const handleWarningBack =
    () => {
      setShowWarning(
        false
      );
    };

  const handleWarningCameraCheck =
    () => {
      setShowWarning(
        false
      );

      setCameraCheckOrigin(
        'quick'
      );

      navigateTo(
        'camera-check'
      );
    };

  const handleChangeoverStep1Complete =
    () =>
      navigateTo(
        'changeover-step2'
      );

  const handleChangeoverStep2Complete =
    () => {
      // NIEUW: na het plaatsen van de mal (stap 2) gaat de flow nu eerst
      // via de fotoanalyse (malcontrole) voor er verder gegaan wordt naar
      // stap 3 — zie handleCameraCheckPass/Fail voor de afhandeling.
      setCameraCheckOrigin(
        'guided'
      );

      navigateTo(
        'camera-check'
      );
    };

  const handleChangeoverStep3Complete =
    () =>
      navigateTo(
        'changeover-step4'
      );

  const handleChangeoverStep4Complete =
    () =>
      navigateTo(
        'changeover-step5'
      );

  const handleChangeoverStep5Complete =
    () => {
      setSessionData(
        (prev) => ({
          ...prev,

          changeoverCompleted:
            true,
        })
      );

      addTimestamp(
        'changeoverCompleted'
      );

      navigateTo(
        'main-dashboard'
      );
    };

  const handleCameraCheckPass =
    () => {
      // Malcontrole geldt vanaf nu voor het huidige toProduct — pas
      // ongeldig zodra er echt naar een ander product gewisseld wordt.
      setCameraCheckVerifiedFor(
        toProduct
      );

      addTimestamp(
        'cameraCheckPassed'
      );

      if (
        cameraCheckOrigin ===
        'guided'
      ) {
        // Malcontrole zat ingebouwd na stap 2 — ga nu verder met de
        // resterende begeleide omstellingsstappen.
        navigateTo(
          'changeover-step3'
        );
      } else {
        navigateTo(
          'main-dashboard'
        );
      }
    };

  const handleCameraCheckFail =
    () => {
      setSessionData(
        (prev) => ({
          ...prev,

          firstTimeRight:
            false,
        })
      );

      if (
        cameraCheckOrigin ===
        'guided'
      ) {
        // Terug naar stap 2 om de mal te corrigeren, niet helemaal
        // terug naar het begin van de omstelling.
        navigateTo(
          'changeover-step2'
        );
      } else {
        navigateTo(
          'changeover-step1'
        );
      }
    };

  const handleProductionComplete =
    () => {
      setSessionData(
        (prev) => ({
          ...prev,

          product2Assembled:
            true,
        })
      );

      addTimestamp(
        'product2Assembled'
      );

      navigateTo(
        'final-qc'
      );
    };

  const handleFinalQCPass =
    () => {
      setSessionData(
        (prev) => ({
          ...prev,

          finalQCPassed:
            true,
        })
      );

      addTimestamp(
        'finalQCPassed'
      );

      // NIEUW (punt 5): dit stuk telt mee voor de huidige order.
      setProducedCount(
        (prev) => prev + 1
      );

      // NIEUW: na de eindcontrole eerst tonen waar het afgewerkte
      // product naartoe moet, pas daarna het Finish-scherm.
      navigateTo(
        'deliver-product'
      );
    };

  const handleProductDelivered =
    () => {
      addTimestamp(
        'productDelivered'
      );

      navigateTo(
        'finish'
      );
    };

  const handleFinalQCReject =
    () => {
      setSessionData(
        (prev) => ({
          ...prev,

          firstTimeRight:
            false,
        })
      );

      addTimestamp(
        'finalQCRejected'
      );

      navigateTo(
        'reject-product'
      );
    };

  const handleRejectHandled =
    () => {
      addTimestamp(
        'rejectedProductRemoved'
      );

      // Het afgekeurde exemplaar telt niet mee — de operator start
      // meteen een nieuw exemplaar van hetzelfde product.
      setSessionData(
        (prev) => ({
          ...prev,

          product2Assembled:
            false,

          finalQCPassed:
            false,
        })
      );

      navigateTo(
        'production'
      );
    };

  const handleOpenSettings =
    () => {
      navigateTo(
        'settings'
      );
    };

  const handleSaveSettings =
    (
      settings:
        OperatorSettings
    ) => {
      setOperatorSettings(
        settings
      );

      goBack();
    };

  // NIEUW: bewust naar het startscherm gaan wist de bewaarde sessie EN
  // vergrendelt de rol meteen (de PIN moet dan opnieuw ingevoerd worden)
  // — dit gebeurt nu automatisch via de "onHome"-prop (zie App()), dus
  // een aparte "Vergrendel"-knop is niet meer nodig.
  const handleGoHome = () => {
    try {
      localStorage.removeItem(
        OPERATOR_STORAGE_KEY
      );
    } catch {
      // localStorage niet beschikbaar — geen probleem, de app gaat
      // gewoon terug naar het startscherm.
    }

    onHome();
  };

  const fromProduct =
    direction ===
    'P1_TO_P2'
      ? 'Product 1'
      : 'Product 2';

  const toProduct =
    direction ===
    'P1_TO_P2'
      ? 'Product 2'
      : 'Product 1';

  // Afgeleide waarde: is de malcontrole al goedgekeurd voor het product
  // dat nu geproduceerd wordt? Blijft geldig tot er echt gewisseld wordt.
  const cameraCheckPassed =
    cameraCheckVerifiedFor ===
    toProduct;

  const getCurrentStepName =
    () => {
      const stepNames:
        Record<
          FlowStep,
          string
        > = {
        'product1-approved':
          'Kwaliteitscontrole',

        'changeover-command':
          'Nieuwe productieopdracht',

        'remove-product1':
          'Product afvoeren',

        'main-dashboard':
          'Omstellingsdashboard',

        'changeover-step1':
          'Werkpost vrijmaken',

        'changeover-step2':
          'Mal plaatsen',

        'changeover-step3':
          'Onderdelen controleren',

        'changeover-step4':
          'Gereedschap controleren',

        'changeover-step5':
          'Omstelling voltooid',

        'camera-check':
          'Camera controle',

        production:
          'Productie',

        'final-qc':
          'Eindcontrole',

        'deliver-product':
          'Product afleveren',

        'reject-product':
          'Afgekeurd product afvoeren',

        finish:
          'Voltooien',

        settings:
          'Instellingen',
      };

      return (
        stepNames[
          currentStep
        ] ||
        'Onbekend'
      );
    };

  // AANPASSING: geen kunstmatig tablet-frame meer — de Operator-interface
  // draait nu gewoon full-screen op het toestel waarop hij geopend wordt
  // (bv. de computer), net als een normale responsive website.
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-gray-100">

      {currentStep ===
        'product1-approved' && (

        <Product1ApprovedScreen
          onRelease={
            handleProduct1Release
          }
          productName={
            fromProduct
          }
          operatorSettings={
            operatorSettings
          }
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'changeover-command' && (

        <ChangeoverCommandScreen
          onConfirm={
            handleCommandConfirm
          }
          fromProduct={
            fromProduct
          }
          toProduct={
            toProduct
          }
          quantity={
            orderQuantity
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'remove-product1' && (

        <RemoveProduct1Screen
          onComplete={
            handleProductRemoved
          }
          elapsedTime={
            elapsedTime
          }
          productName={
            fromProduct
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'main-dashboard' && (

        <MainDashboardScreen
          changeoverCompleted={
            sessionData.changeoverCompleted
          }
          cameraCheckPassed={
            cameraCheckPassed
          }
          onStartChangeover={
            handleStartChangeover
          }
          onStartProduction={
            handleStartProduction
          }
          elapsedTime={
            elapsedTime
          }
          fromProduct={
            fromProduct
          }
          toProduct={
            toProduct
          }
          operatorSettings={
            operatorSettings
          }
          plannedChangeovers={
            plannedChangeovers
          }
          producedCount={
            producedCount
          }
          orderQuantity={
            orderQuantity
          }
          onOpenSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'changeover-step1' && (

        <ChangeoverStep1Screen
          onComplete={
            handleChangeoverStep1Complete
          }
          elapsedTime={
            elapsedTime
          }
          productName={
            fromProduct
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'changeover-step2' && (

        <ChangeoverStep2Screen
          onComplete={
            handleChangeoverStep2Complete
          }
          elapsedTime={
            elapsedTime
          }
          toProduct={
            toProduct
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'changeover-step3' && (

        <ChangeoverStep3Screen
          onComplete={
            handleChangeoverStep3Complete
          }
          elapsedTime={
            elapsedTime
          }
          toProduct={
            toProduct
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'changeover-step4' && (

        <ChangeoverStep4Screen
          onComplete={
            handleChangeoverStep4Complete
          }
          elapsedTime={
            elapsedTime
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'changeover-step5' && (

        <ChangeoverStep5Screen
          onComplete={
            handleChangeoverStep5Complete
          }
          elapsedTime={
            elapsedTime
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'camera-check' && (

        <CameraCheckScreen
          onPass={
            handleCameraCheckPass
          }
          onFail={
            handleCameraCheckFail
          }
          elapsedTime={
            elapsedTime
          }
          productName={
            toProduct
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'production' && (

        <ProductionStepsScreen
          onComplete={
            handleProductionComplete
          }
          elapsedTime={
            elapsedTime
          }
          productName={
            toProduct
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'final-qc' && (

        <FinalQCScreen
          onPass={
            handleFinalQCPass
          }
          onReject={
            handleFinalQCReject
          }
          elapsedTime={
            elapsedTime
          }
          productName={
            toProduct
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'reject-product' && (

        <RejectProductScreen
          onComplete={
            handleRejectHandled
          }
          elapsedTime={
            elapsedTime
          }
          productName={
            toProduct
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'deliver-product' && (

        <DeliverProductScreen
          onComplete={
            handleProductDelivered
          }
          elapsedTime={
            elapsedTime
          }
          productName={
            toProduct
          }
          operatorSettings={
            operatorSettings
          }
          onBack={goBack}
          onSettings={
            handleOpenSettings
          }
        />

      )}

      {currentStep ===
        'finish' && (

        <FinishScreen
          sessionData={
            sessionData
          }
          totalTime={
            elapsedTime
          }
          productName={
            toProduct
          }
          operatorSettings={
            operatorSettings
          }
          producedCount={
            producedCount
          }
          orderQuantity={
            orderQuantity
          }
          onStartNextCycle={
            handleStartNextCycle
          }
        />

      )}

      {currentStep ===
        'settings' && (

        <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden">

          {/* NIEUW: home-knop nu BOVENAAN en altijd zichtbaar (sticky),
              zodat je 'm niet meer helemaal onderaan een lange pagina
              moet gaan zoeken. Gaat altijd terug naar het startscherm
              EN vergrendelt de rol meteen — een aparte "Vergrendel"-knop
              is dus niet meer nodig. */}
          <div className="flex-shrink-0 bg-gray-100 border-b border-gray-200 px-6 py-3">
            <button
              onClick={handleGoHome}
              className="w-full max-w-[1100px] mx-auto bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-5 py-3 flex items-center justify-between transition-colors shadow-sm"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l9-9 9 9M5 10v10h14V10"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    Terug naar startscherm
                  </p>
                  <p className="text-xs text-gray-500">
                    Sluit deze sessie af (PIN opnieuw nodig)
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <SettingsScreen
              operatorSettings={
                operatorSettings
              }
              onSave={
                handleSaveSettings
              }
              onBack={goBack}
              currentProduct={
                fromProduct
              }
              currentStep={
                getCurrentStepName()
              }
              plannedChangeovers={
                plannedChangeovers
              }
            />
          </div>

        </div>

      )}

      {showWarning && (

        <WarningModal
          onBack={
            handleWarningBack
          }
          onCameraCheck={
            handleWarningCameraCheck
          }
        />

      )}

    </div>
  );
}

/* ============================================================
   MANAGER APP
   Toont live de status van Operator en Waterspider (via ntfy.sh,
   NTFY_STATUS_TOPIC), een log van goedgekeurde/afgekeurde controles
   (via NTFY_TOPIC — dezelfde berichten die de Camera-interface al
   publiceert) en laat de manager — als enige — een omstelling plannen
   (publiceert naar NTFY_CHANGEOVER_TOPIC, waar de Operator-app op
   luistert).
============================================================ */

interface DeviceStatus {
  source: 'operator' | 'waterspider';
  timestamp: number;
  [key: string]: any;
}

interface QualityLogEntry {
  product: string;
  status: 'ok' | 'error';
  percentage: number;
  context?: 'camera-check' | 'final-qc' | null;
  timestamp: number;
}

interface EventLogEntry {
  source: 'operator' | 'waterspider';
  type: 'incident' | 'message' | 'call_request' | 'prep_complete';
  message: string;
  operatorName?: string;
  line?: string;
  station?: string;
  timestamp: number;
}

function ManagerApp({
  onHome,
}: {
  onHome: () => void;
}) {
  // NIEUW (punt 3): net als bij Operator/Waterspider wordt de live data
  // die hier binnenkomt (status, kwaliteitslog, meldingen) bewaard in
  // localStorage, zodat een verversing niet alles leegmaakt — je ziet bij
  // het heropenen meteen weer de laatst bekende stand, terwijl de
  // live-verbindingen op de achtergrond gewoon verder actualiseren.
  const MANAGER_STORAGE_KEY =
    'sirris_manager_state_v1';

  const savedManagerState = (() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          MANAGER_STORAGE_KEY
        ) || 'null'
      );
    } catch {
      return null;
    }
  })();

  const [operatorStatuses, setOperatorStatuses] =
    useState<Record<string, DeviceStatus>>(
      savedManagerState?.operatorStatuses ?? {}
    );

  const [waterspiderStatus, setWaterspiderStatus] =
    useState<DeviceStatus | null>(
      savedManagerState?.waterspiderStatus ?? null
    );

  const [qualityLog, setQualityLog] =
    useState<QualityLogEntry[]>(
      savedManagerState?.qualityLog ?? []
    );

  const [eventsLog, setEventsLog] =
    useState<EventLogEntry[]>(
      savedManagerState?.eventsLog ?? []
    );

  const [planning, setPlanning] = useState({
    fromProduct: 'Product 1',
    toProduct: 'Product 2',
    trigger: 'scheduled' as 'scheduled' | 'now' | 'after-current-product',
    plannedDate: new Date().toISOString().split('T')[0],
    plannedTime: '16:30',
    line: 'Lijn 4',
    station: 'Stat. 2',
    quantity: 50,
  });

  const [justPlanned, setJustPlanned] = useState(false);

  // NIEUW (punt 3): live data terugschrijven naar localStorage bij elke
  // wijziging. Het planningsformulier zelf bewust niet bewaard — dat
  // hoort bij een lopende invoer, niet bij data om te herstellen.
  useEffect(() => {
    try {
      localStorage.setItem(
        MANAGER_STORAGE_KEY,
        JSON.stringify({
          operatorStatuses,
          waterspiderStatus,
          qualityLog,
          eventsLog,
        })
      );
    } catch {
      // localStorage niet beschikbaar — logs worden dan niet hersteld na
      // een verversing, maar de pagina blijft verder gewoon werken.
    }
  }, [
    operatorStatuses,
    waterspiderStatus,
    qualityLog,
    eventsLog,
  ]);

  // Live status van Operator + Waterspider
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`https://ntfy.sh/${NTFY_STATUS_TOPIC}/sse`);
      es.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (!envelope?.message) return;
          const data: DeviceStatus = JSON.parse(envelope.message);
          if (data.source === 'operator') {
            // NIEUW: bijhouden per lijn + werkpost, zodat de manager
            // meerdere operator-werkposten tegelijk kan zien i.p.v.
            // enkel de laatst-ontvangen status.
            const key = `${data.line || '?'}::${data.station || '?'}`;
            setOperatorStatuses((prev) => ({ ...prev, [key]: data }));
          } else if (data.source === 'waterspider') {
            setWaterspiderStatus(data);
          }
        } catch {
          // Geen geldig bericht — negeren.
        }
      };
    } catch {
      // ntfy.sh niet bereikbaar — geen live status beschikbaar.
    }
    return () => es?.close();
  }, []);

  // Live meldingen & berichten van Operator + Waterspider (probleem
  // melden, bericht naar teamleader, bel teamleader, voorbereiding klaar)
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`https://ntfy.sh/${NTFY_EVENTS_TOPIC}/sse`);
      es.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (!envelope?.message) return;
          const entry: EventLogEntry = JSON.parse(envelope.message);
          setEventsLog((prev) => [entry, ...prev].slice(0, 30));
        } catch {
          // Geen geldig bericht — negeren.
        }
      };
    } catch {
      // ntfy.sh niet bereikbaar — geen live meldingen beschikbaar.
    }
    return () => es?.close();
  }, []);

  // Live kwaliteitslog (dezelfde berichten die de Camera-interface
  // publiceert bij elke mal-/productcontrole)
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`https://ntfy.sh/${NTFY_TOPIC}/sse`);
      es.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (!envelope?.message) return;
          const entry: QualityLogEntry = JSON.parse(envelope.message);
          setQualityLog((prev) => [entry, ...prev].slice(0, 30));
        } catch {
          // Geen geldig bericht — negeren.
        }
      };
    } catch {
      // ntfy.sh niet bereikbaar — geen live log beschikbaar.
    }
    return () => es?.close();
  }, []);

  // NIEUW: bewust naar het startscherm gaan wist de bewaarde logs EN
  // vergrendelt de rol meteen (PIN opnieuw nodig) — via de "onHome"-prop
  // (zie App()), dus geen aparte "Vergrendel"-knop meer nodig.
  const handleGoHome = () => {
    try {
      localStorage.removeItem(
        MANAGER_STORAGE_KEY
      );
    } catch {
      // Geen probleem — de app gaat gewoon terug naar het startscherm.
    }

    onHome();
  };

  const handlePlan = () => {
    if (planning.fromProduct === planning.toProduct) return;

    fetch(`https://ntfy.sh/${NTFY_CHANGEOVER_TOPIC}`, {
      method: 'POST',
      body: JSON.stringify({
        fromProduct: planning.fromProduct,
        toProduct: planning.toProduct,
        trigger: planning.trigger,
        plannedDate: planning.trigger === 'scheduled' ? planning.plannedDate : '',
        plannedTime: planning.trigger === 'scheduled' ? planning.plannedTime : '',
        line: planning.line,
        station: planning.station,
        quantity: planning.quantity,
        timestamp: Date.now(),
      }),
    })
      .then(() => {
        setJustPlanned(true);
        setTimeout(() => setJustPlanned(false), 3000);
      })
      .catch(() => {
        alert('Kon de omstelling niet versturen — controleer de internetverbinding.');
      });
  };

  const formatAgo = (timestamp?: number) => {
    if (!timestamp) return '—';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'zojuist';
    if (seconds < 60) return `${seconds}s geleden`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m geleden`;
  };

  const stepLabels: Record<string, string> = {
    'product1-approved': 'Kwaliteitscontrole',
    'changeover-command': 'Nieuwe productieopdracht',
    'remove-product1': 'Product afvoeren',
    'main-dashboard': 'Omstellingsdashboard',
    'changeover-step1': 'Werkpost vrijmaken',
    'changeover-step2': 'Mal plaatsen',
    'changeover-step3': 'Onderdelen controleren',
    'changeover-step4': 'Gereedschap controleren',
    'changeover-step5': 'Omstelling voltooid',
    'camera-check': 'Wacht op malcontrole',
    production: 'Productie',
    'final-qc': 'Wacht op eindcontrole',
    'deliver-product': 'Product afleveren',
    'reject-product': 'Afgekeurd product afvoeren',
    finish: 'Voltooid',
    settings: 'Instellingen',
  };

  return (
    <div className="h-[100dvh] w-full overflow-y-auto bg-[#0B1929]">
      <header className="bg-[#0B1929] px-6 py-5 flex items-center justify-between gap-4 sticky top-0 z-10 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            onClick={handleGoHome}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center flex-shrink-0"
          >
            ←
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-violet-400 font-bold">MANAGER</p>
            <h1 className="text-xl md:text-2xl font-bold text-white">Overzicht &amp; planning</h1>
          </div>
        </div>
      </header>

      <main className="p-5 md:p-8 max-w-[1400px] mx-auto space-y-6">
        {/* LIVE STATUS */}

        {/* NIEUW: Operator-werkposten — nu één kaart per lijn/werkpost
            i.p.v. één enkele kaart, zodat de manager kan zien welke
            lijnen met welke productie bezig zijn zodra er meerdere
            operator-tablets meepubliceren. */}
        <div>
          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3">Operator-werkposten</h3>

          {Object.keys(operatorStatuses).length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <p className="text-sm text-slate-400">Nog geen status ontvangen. Open de Operator-interface om te beginnen.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Object.entries(operatorStatuses).map(([key, opStatus]) => (
                <div key={key} className="bg-white rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-slate-800">{opStatus.line} · {opStatus.station}</h4>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${opStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                      {formatAgo(opStatus.timestamp)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-bold text-slate-900">
                      {stepLabels[opStatus.currentStep] || opStatus.currentStep}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[
                        'product1-approved',
                        'changeover-command',
                        'remove-product1',
                        'changeover-step1',
                        'changeover-step2',
                        'changeover-step3',
                        'changeover-step4',
                        'changeover-step5',
                        'camera-check',
                        'main-dashboard',
                      ].includes(opStatus.currentStep)
                        ? `${opStatus.fromProduct} → ${opStatus.toProduct}`
                        : opStatus.toProduct}
                    </p>
                    <p className="text-xs text-slate-400">
                      {opStatus.operatorName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="max-w-xl">
          {/* Waterspider status */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold">Waterspider</h3>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${waterspiderStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                {waterspiderStatus ? formatAgo(waterspiderStatus.timestamp) : 'Geen data'}
              </span>
            </div>
            {waterspiderStatus ? (
              <div className="space-y-2">
                <p className="text-2xl font-bold text-slate-900 capitalize">
                  {waterspiderStatus.screen === 'route'
                    ? `Logistieke ronde ${waterspiderStatus.roundNumber ?? ''}`
                    : waterspiderStatus.screen === 'station'
                    ? `Controle — ${waterspiderStatus.station || ''}`
                    : waterspiderStatus.screen === 'pickup'
                    ? `Ophaallijst — ${waterspiderStatus.station || ''}`
                    : waterspiderStatus.screen === 'refill'
                    ? `Aanvullen — ${waterspiderStatus.station || ''}`
                    : 'Onbekend scherm'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Nog geen status ontvangen. Open de Waterspider-interface om te beginnen.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* OMSTELLING PLANNEN */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-4">Omstelling plannen</h3>

            {justPlanned && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-emerald-800 font-medium">Verstuurd naar de operator-tablet.</p>
              </div>
            )}

            {/* AANPASSING: geen hover-overlay meer (werkt niet op
                touchscreens) — gewoon een normaal, altijd zichtbaar
                formulier. Tekstkleur overal expliciet zwart gezet, zodat
                dit niet nog eens per ongeluk onzichtbaar wordt (zoals
                eerder bij de PIN-invoer). */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-medium">Van product</label>
                  <select
                    value={planning.fromProduct}
                    onChange={(e) => setPlanning({ ...planning, fromProduct: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900"
                  >
                    <option>Product 1</option>
                    <option>Product 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-medium">Naar product</label>
                  <select
                    value={planning.toProduct}
                    onChange={(e) => setPlanning({ ...planning, toProduct: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900"
                  >
                    <option>Product 1</option>
                    <option>Product 2</option>
                  </select>
                </div>
              </div>

              {planning.fromProduct === planning.toProduct && (
                <p className="text-xs text-red-600">Van en Naar product moeten verschillend zijn.</p>
              )}

              {/* NIEUW: welke werkpost moet de omstelling uitvoeren?
                  Gevuld met de lijnen/werkposten die al een live status
                  hebben doorgestuurd, plus een handmatige invoeroptie. */}
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">Werkpost</label>
                <select
                  value={`${planning.line}::${planning.station}`}
                  onChange={(e) => {
                    const [line, station] = e.target.value.split('::');
                    setPlanning({ ...planning, line, station });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900"
                >
                  {Object.keys(operatorStatuses).length === 0 ? (
                    <option value="Lijn 4::Stat. 2">Lijn 4 · Stat. 2</option>
                  ) : (
                    Object.keys(operatorStatuses).map((key) => {
                      const [line, station] = key.split('::');
                      return (
                        <option key={key} value={key}>{line} · {station}</option>
                      );
                    })
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">Aantal stuks</label>
                <input
                  type="number"
                  min={1}
                  value={planning.quantity}
                  onChange={(e) => setPlanning({ ...planning, quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">Wanneer</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPlanning({ ...planning, trigger: 'now' })}
                    className={`py-2 rounded-lg text-xs font-bold text-center ${planning.trigger === 'now' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Nu
                  </button>
                  <button
                    onClick={() => setPlanning({ ...planning, trigger: 'after-current-product' })}
                    className={`py-2 rounded-lg text-xs font-bold text-center ${planning.trigger === 'after-current-product' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Na huidig product
                  </button>
                  <button
                    onClick={() => setPlanning({ ...planning, trigger: 'scheduled' })}
                    className={`py-2 rounded-lg text-xs font-bold text-center ${planning.trigger === 'scheduled' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Op datum/tijd
                  </button>
                </div>
              </div>

              {planning.trigger === 'scheduled' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1 font-medium">Datum</label>
                    <input
                      type="date"
                      value={planning.plannedDate}
                      onChange={(e) => setPlanning({ ...planning, plannedDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1 font-medium">Tijd</label>
                    <input
                      type="time"
                      value={planning.plannedTime}
                      onChange={(e) => setPlanning({ ...planning, plannedTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handlePlan}
                disabled={planning.fromProduct === planning.toProduct}
                className="w-full min-h-[52px] bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl font-bold text-base mt-2 flex items-center justify-center text-center px-6 transition-colors"
              >
                {planning.trigger === 'now' ? 'Wissel nu doorsturen' : 'Omstelling inplannen'}
              </button>
            </div>
          </div>

          {/* KWALITEITSLOG */}
          <div className="bg-white rounded-2xl p-6 shadow-lg flex flex-col max-h-[600px]">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-4 flex-shrink-0">Kwaliteitscontroles (live)</h3>

            {/* NIEUW: samenvatting per product en per type controle —
                hoeveel goedgekeurd vs afgekeurd, over de hele historie. */}
            <div className="grid grid-cols-2 gap-2 mb-4 flex-shrink-0">
              {['product1', 'product2'].map((prodKey) => {
                const label = prodKey === 'product1' ? 'Product 1' : 'Product 2';

                const malOk = qualityLog.filter((e) => e.product === prodKey && e.context === 'camera-check' && e.status === 'ok').length;
                const malFail = qualityLog.filter((e) => e.product === prodKey && e.context === 'camera-check' && e.status === 'error').length;
                const qcOk = qualityLog.filter((e) => e.product === prodKey && e.context === 'final-qc' && e.status === 'ok').length;
                const qcFail = qualityLog.filter((e) => e.product === prodKey && e.context === 'final-qc' && e.status === 'error').length;

                return (
                  <div key={prodKey} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-bold text-slate-700 mb-2">{label}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Malcontrole</span>
                        <span className="font-mono">
                          <span className="text-emerald-600 font-bold">{malOk}</span>
                          {' / '}
                          <span className="text-red-600 font-bold">{malFail}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Eindcontrole</span>
                        <span className="font-mono">
                          <span className="text-emerald-600 font-bold">{qcOk}</span>
                          {' / '}
                          <span className="text-red-600 font-bold">{qcFail}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mb-3 flex-shrink-0">Juist / fout, per type controle</p>

            <div className="flex-1 overflow-y-auto space-y-2">
              {qualityLog.length === 0 ? (
                <p className="text-sm text-slate-400">Nog geen controles ontvangen.</p>
              ) : (
                qualityLog.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border ${entry.status === 'ok' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-slate-800 capitalize block">
                          {entry.product === 'product1' ? 'Product 1' : 'Product 2'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {entry.context === 'final-qc' ? 'Eindcontrole' : entry.context === 'camera-check' ? 'Malcontrole' : 'Onbekend type'}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold flex-shrink-0 mx-2 ${entry.status === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {entry.status === 'ok' ? 'Goedgekeurd' : 'Afgekeurd'}
                    </span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{formatAgo(entry.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* MELDINGEN & BERICHTEN */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-4">
            Meldingen &amp; berichten (live)
          </h3>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {eventsLog.length === 0 ? (
              <p className="text-sm text-slate-400">Nog geen meldingen ontvangen.</p>
            ) : (
              eventsLog.map((entry, idx) => {
                const typeLabel =
                  entry.type === 'incident'
                    ? 'Probleem'
                    : entry.type === 'message'
                    ? 'Bericht'
                    : entry.type === 'call_request'
                    ? 'Belverzoek'
                    : 'Voorbereiding klaar';

                const typeColor =
                  entry.type === 'incident'
                    ? 'bg-orange-100 text-orange-700'
                    : entry.type === 'call_request'
                    ? 'bg-red-100 text-red-700'
                    : entry.type === 'prep_complete'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700';

                return (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${typeColor}`}>
                          {typeLabel}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold capitalize">
                          {entry.source}
                        </span>
                      </div>
                      <p className="text-sm text-slate-800">{entry.message}</p>
                      {(entry.operatorName || entry.line) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[entry.operatorName, entry.line, entry.station].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{formatAgo(entry.timestamp)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   WATERSPIDER APP

   Compacte flow voor polstablet (~35 × 58 mm):
   1. Kies 1 van 4 werkplaatsen (2 × 2)
   2. Vraag: lege bakken?
   3. Zo ja: echte QR-scan
   4. Elke QR-code kan per werkpost maximaal 1 keer gescand worden
   5. Profielen controleren
   6. Volledige ophaallijst + locaties
   7. Aanvullen aan de gekozen werkpost
============================================================ */

interface Props {
  onHome: () => void;
}

interface BinDefinition {
  qrCode: string;
  material: string;
  pickupLocation: string;
  stationLocation: string;
}

const BIN_DATABASE: BinDefinition[] = [
  {
    qrCode: 'BIN-M3',
    material: 'M3 bouten',
    pickupLocation: 'Supermarkt A1',
    stationLocation: 'Poka-yoke kast · B1',
  },
  {
    qrCode: 'BIN-M4',
    material: 'M4 bouten',
    pickupLocation: 'Supermarkt A2',
    stationLocation: 'Poka-yoke kast · B2',
  },
  {
    qrCode: 'BIN-M5',
    material: 'M5 bouten',
    pickupLocation: 'Supermarkt A3',
    stationLocation: 'Poka-yoke kast · B3',
  },
  {
    qrCode: 'BIN-TNUT-M3',
    material: 'T-moeren M3',
    pickupLocation: 'Supermarkt A4',
    stationLocation: 'Poka-yoke kast · B4',
  },
  {
    qrCode: 'BIN-TNUT-M4',
    material: 'T-moeren M4',
    pickupLocation: 'Supermarkt A5',
    stationLocation: 'Poka-yoke kast · B5',
  },
  {
    qrCode: 'BIN-NUTENSTEIN',
    material: 'Nutensteinen',
    pickupLocation: 'Supermarkt A6',
    stationLocation: 'Poka-yoke kast · B6',
  },
  {
    qrCode: 'BIN-NUTENSTEIN-LONG',
    material: 'Lange nutensteinen',
    pickupLocation: 'Supermarkt A7',
    stationLocation: 'Poka-yoke kast · B7',
  },
  {
    qrCode: 'BIN-HANDLE',
    material: 'Handvatten',
    pickupLocation: 'Supermarkt A8',
    stationLocation: 'Poka-yoke kast · B8',
  },
];

interface ProfileStockItem {
  id: string;
  name: string;
  target: number;
  pickupLocation: string;
}

const PROFILE_STOCK: ProfileStockItem[] = [
  {
    id: 'profile-370',
    name: 'Profiel 370 mm',
    target: 4,
    pickupLocation: 'Profielenmagazijn · Rek P2',
  },
  {
    id: 'profile-630',
    name: 'Profiel 630 mm',
    target: 4,
    pickupLocation: 'Profielenmagazijn · Rek P1',
  },
  {
    id: 'profile-370x60',
    name: 'Profiel 370×60 mm',
    target: 2,
    pickupLocation: 'Profielenmagazijn · Rek P3',
  },
];

interface RouteStation {
  id: string;
  name: string;
  line: string;
}

const ROUTE_STATIONS: RouteStation[] = [
  { id: 'station-1', name: 'Werkpost 1', line: 'Lijn 4' },
  { id: 'station-2', name: 'Werkpost 2', line: 'Lijn 4' },
  { id: 'station-3', name: 'Werkpost 3', line: 'Lijn 4' },
  { id: 'station-4', name: 'Werkpost 4', line: 'Lijn 4' },
];

type WaterspiderScreen = 'route' | 'station' | 'pickup' | 'refill';
type StationPhase = 'empty-question' | 'scan' | 'profiles';

interface PickupOrRefillItem {
  id: string;
  label: string;
  location: string;
}

interface PendingChangeoverNote {
  station: string;
  fromProduct: string;
  toProduct: string;
}

function WaterspiderApp({ onHome }: Props) {
  const STORAGE_KEY = 'sirris_waterspider_milkrun_v4';

  const savedState = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  })();

  const [screen, setScreen] = useState<WaterspiderScreen>(
    savedState?.screen ?? 'route'
  );

  const [stationIndex, setStationIndex] = useState<number>(
    savedState?.stationIndex ?? 0
  );

  const [stationPhase, setStationPhase] = useState<StationPhase>(
    savedState?.stationPhase ?? 'empty-question'
  );

  const [profileIndex, setProfileIndex] = useState<number>(
    savedState?.profileIndex ?? 0
  );

  const [scannedBins, setScannedBins] = useState<string[]>(
    savedState?.scannedBins ?? []
  );

  const [profileCounts, setProfileCounts] = useState<Record<string, number>>(
    savedState?.profileCounts ?? {}
  );

  const [pickupChecks, setPickupChecks] = useState<Record<string, boolean>>(
    savedState?.pickupChecks ?? {}
  );

  const [refillChecks, setRefillChecks] = useState<Record<string, boolean>>(
    savedState?.refillChecks ?? {}
  );

  const [pendingChangeovers, setPendingChangeovers] = useState<
    PendingChangeoverNote[]
  >(savedState?.pendingChangeovers ?? []);

  const [scannerActive, setScannerActive] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [manualQr, setManualQr] = useState('');

  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrAnimationRef = useRef<number | null>(null);
  const qrDetectorRef = useRef<any>(null);
  const lastDetectedQrRef = useRef<{ code: string; at: number } | null>(null);

  const currentStation = ROUTE_STATIONS[stationIndex];

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          screen,
          stationIndex,
          stationPhase,
          profileIndex,
          scannedBins,
          profileCounts,
          pickupChecks,
          refillChecks,
          pendingChangeovers,
        })
      );
    } catch {
      // Zonder localStorage blijft de app werken.
    }
  }, [
    screen,
    stationIndex,
    stationPhase,
    profileIndex,
    scannedBins,
    profileCounts,
    pickupChecks,
    refillChecks,
    pendingChangeovers,
  ]);

  useEffect(() => {
    fetch(`https://ntfy.sh/${NTFY_STATUS_TOPIC}`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'waterspider',
        screen,
        stationPhase,
        station: currentStation.name,
        line: currentStation.line,
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Geen internet: manager ziet tijdelijk geen live status.
    });
  }, [screen, stationPhase, currentStation]);

  useEffect(() => {
    let es: EventSource | null = null;

    try {
      es = new EventSource(`https://ntfy.sh/${NTFY_CHANGEOVER_TOPIC}/sse`);

      es.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (!envelope?.message) return;

          const plan = JSON.parse(envelope.message);
          const stationLabel = (plan.station || 'Stat. 2')
            .replace('Stat.', 'Werkpost')
            .replace('Station', 'Werkpost');

          setPendingChangeovers((prev) => [
            ...prev,
            {
              station: stationLabel,
              fromProduct: plan.fromProduct,
              toProduct: plan.toProduct,
            },
          ]);
        } catch {
          // Ongeldig bericht negeren.
        }
      };
    } catch {
      // Geen live planning beschikbaar.
    }

    return () => es?.close();
  }, []);

  const pickupItems: PickupOrRefillItem[] = useMemo(() => {
    const items: PickupOrRefillItem[] = [];

    scannedBins.forEach((qr) => {
      const bin = BIN_DATABASE.find((b) => b.qrCode === qr);

      if (bin) {
        items.push({
          id: `bin-${bin.qrCode}`,
          label: `1 volle bak ${bin.material}`,
          location: bin.pickupLocation,
        });
      }
    });

    PROFILE_STOCK.forEach((profile) => {
      const counted = profileCounts[profile.id] ?? 0;
      const shortage = Math.max(0, profile.target - counted);

      if (shortage > 0) {
        items.push({
          id: `profile-${profile.id}`,
          label: `${shortage} × ${profile.name}`,
          location: profile.pickupLocation,
        });
      }
    });

    return items;
  }, [scannedBins, profileCounts]);

  const refillItems: PickupOrRefillItem[] = useMemo(() => {
    const items: PickupOrRefillItem[] = [];

    scannedBins.forEach((qr) => {
      const bin = BIN_DATABASE.find((b) => b.qrCode === qr);

      if (bin) {
        items.push({
          id: `bin-${bin.qrCode}`,
          label: `1 volle bak ${bin.material}`,
          location: bin.stationLocation,
        });
      }
    });

    PROFILE_STOCK.forEach((profile) => {
      const counted = profileCounts[profile.id] ?? 0;
      const shortage = Math.max(0, profile.target - counted);

      if (shortage > 0) {
        items.push({
          id: `profile-${profile.id}`,
          label: `${shortage} × ${profile.name}`,
          location: 'Profielvoorraad aan de lijn',
        });
      }
    });

    return items;
  }, [scannedBins, profileCounts]);

  const stopQrScanner = () => {
    if (qrAnimationRef.current !== null) {
      cancelAnimationFrame(qrAnimationRef.current);
      qrAnimationRef.current = null;
    }

    qrStreamRef.current?.getTracks().forEach((track) => track.stop());
    qrStreamRef.current = null;

    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }

    setScannerActive(false);
  };

  useEffect(() => {
    return () => stopQrScanner();
  }, []);

  const acceptQrCode = (rawCode: string) => {
    const qrCode = rawCode.trim().toUpperCase();
    const bin = BIN_DATABASE.find((item) => item.qrCode === qrCode);

    if (!bin) {
      setScannerMessage(`Onbekende QR: ${rawCode}`);
      return false;
    }

    // MAXIMUM 1 per QR-code per werkpostbezoek.
    if (scannedBins.includes(qrCode)) {
      setScannerMessage(`Al gescand: ${bin.material}`);
      return false;
    }

    setScannedBins((prev) => [...prev, qrCode]);
    setScannerMessage(`✓ ${bin.material}`);
    return true;
  };

  const startQrScanner = async () => {
    setScannerMessage('');

    const BarcodeDetectorClass = (window as any).BarcodeDetector;

    if (!BarcodeDetectorClass) {
      setScannerMessage('QR-herkenning niet beschikbaar. Gebruik fallback.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      qrStreamRef.current = stream;
      qrDetectorRef.current = new BarcodeDetectorClass({
        formats: ['qr_code'],
      });

      if (!qrVideoRef.current) return;

      qrVideoRef.current.srcObject = stream;
      await qrVideoRef.current.play();
      setScannerActive(true);

      const scanFrame = async () => {
        const video = qrVideoRef.current;
        const detector = qrDetectorRef.current;

        if (!video || !detector || !qrStreamRef.current) return;

        if (video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);

            if (codes?.length) {
              const rawValue = String(codes[0]?.rawValue || '');
              const now = Date.now();
              const last = lastDetectedQrRef.current;

              if (
                rawValue &&
                (!last || last.code !== rawValue || now - last.at > 1800)
              ) {
                lastDetectedQrRef.current = {
                  code: rawValue,
                  at: now,
                };

                acceptQrCode(rawValue);
              }
            }
          } catch {
            // Een mislukte frame-detectie is niet fataal.
          }
        }

        qrAnimationRef.current = requestAnimationFrame(scanFrame);
      };

      qrAnimationRef.current = requestAnimationFrame(scanFrame);
    } catch (error) {
      console.error(error);
      setScannerMessage('Camera kon niet geopend worden.');
      stopQrScanner();
    }
  };

  const resetVisit = () => {
    stopQrScanner();
    setScannedBins([]);
    setProfileCounts({});
    setPickupChecks({});
    setRefillChecks({});
    setStationPhase('empty-question');
    setProfileIndex(0);
    setScannerMessage('');
    setManualQr('');
  };

  const chooseStation = (index: number) => {
    resetVisit();
    setStationIndex(index);
    setScreen('station');
    setStationPhase('empty-question');
  };

  const finishStation = () => {
    setPendingChangeovers((prev) =>
      prev.filter((changeover) => changeover.station !== currentStation.name)
    );

    resetVisit();
    setScreen('route');
  };

  const handleGoHome = () => {
    stopQrScanner();

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Geen probleem.
    }

    onHome();
  };

  const WristHeader = ({
    eyebrow,
    title,
    onBack,
    showHome = false,
  }: {
    eyebrow: string;
    title: string;
    onBack?: () => void;
    showHome?: boolean;
  }) => (
    <header className="bg-[#0B1929] px-2 py-1.5 flex-shrink-0 border-b border-white/10">
      <div className="flex items-center gap-1.5">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center flex-shrink-0"
            aria-label="Terug"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center flex-shrink-0">
            <Route className="w-4 h-4" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[9px] uppercase tracking-[0.10em] text-blue-300 font-bold leading-none mb-0.5">
            {eyebrow}
          </p>

          <h1 className="text-[14px] leading-tight font-bold text-white truncate">
            {title}
          </h1>
        </div>

        {showHome && (
          <button
            onClick={handleGoHome}
            className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center flex-shrink-0"
            aria-label="Uitloggen"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );

  const BigAction = ({
    children,
    onClick,
    disabled = false,
    green = false,
  }: {
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    green?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-[42px] rounded-xl px-2 text-[14px] leading-tight font-bold flex items-center justify-center text-center ${
        disabled
          ? 'bg-slate-200 text-slate-400'
          : green
          ? 'bg-emerald-500 text-white'
          : 'bg-[#1A56DB] text-white'
      }`}
    >
      {children}
    </button>
  );

  /* 1. WERKPOST KIEZEN — 2 × 2 */
  if (screen === 'route') {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
        <WristHeader eyebrow="WATERSPIDER" title="Kies werkpost" showHome />

        <main className="flex-1 min-h-0 p-2">
          <div className="h-full grid grid-cols-2 grid-rows-2 gap-2">
            {ROUTE_STATIONS.map((station, index) => {
              const changeover = pendingChangeovers.find(
                (item) => item.station === station.name
              );

              return (
                <button
                  key={station.id}
                  onClick={() => chooseStation(index)}
                  className="min-h-0 rounded-xl border-2 border-slate-200 bg-white px-1.5 py-1.5 flex flex-col items-center justify-center text-center"
                >
                  <span className="text-[9px] uppercase text-slate-400 font-bold">
                    {station.line}
                  </span>

                  <span className="text-[16px] leading-tight font-black text-slate-900 mt-0.5">
                    {station.name}
                  </span>

                  {changeover && (
                    <span className="mt-1 text-[8px] leading-tight font-bold text-amber-700">
                      {changeover.fromProduct} → {changeover.toProduct}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  /* 2. LEGE BAKKEN? */
  if (screen === 'station' && stationPhase === 'empty-question') {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
        <WristHeader
          eyebrow={currentStation.name}
          title="Lege bakken?"
          onBack={() => setScreen('route')}
        />

        <main className="flex-1 min-h-0 p-2.5 flex flex-col justify-center">
          <div className="text-center mb-3">
            <Boxes className="w-10 h-10 mx-auto text-amber-600 mb-2" />
            <h2 className="text-[18px] font-black text-slate-900">
              Zijn er lege bakken?
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStationPhase('scan')}
              className="min-h-[62px] rounded-xl bg-[#1A56DB] text-white text-[17px] font-black"
            >
              JA
            </button>

            <button
              onClick={() => {
                setStationPhase('profiles');
                setProfileIndex(0);
              }}
              className="min-h-[62px] rounded-xl bg-slate-200 text-slate-800 text-[17px] font-black"
            >
              NEE
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* 3. QR SCANNER — COMPACT, CAMERA BLIJFT ZICHTBAAR */
  if (screen === 'station' && stationPhase === 'scan') {
    return (
      <div className="h-[100dvh] w-full bg-black flex flex-col overflow-hidden">
        <WristHeader
          eyebrow={currentStation.name}
          title="QR scannen"
          onBack={() => {
            stopQrScanner();
            setStationPhase('empty-question');
          }}
        />

        <main className="flex-1 min-h-0 relative bg-black">
          <video
            ref={qrVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />

          {!scannerActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-2">
              <ScanLine className="w-9 h-9 mb-1.5 text-blue-300" />
              <p className="text-[12px] font-bold">Camera starten</p>
            </div>
          )}

          {scannerActive && (
            <>
              <div className="absolute inset-[12%] border-2 border-white rounded-xl pointer-events-none" />

              <div className="absolute top-1.5 left-1.5 bg-red-600 text-white px-2 py-1 rounded-full text-[9px] font-bold">
                LIVE
              </div>
            </>
          )}

          <div className="absolute bottom-1.5 left-1.5 right-1.5">
            {scannerMessage && (
              <div className="mb-1.5 rounded-lg bg-black/75 border border-white/20 px-2 py-1.5 text-[10px] leading-tight text-white text-center">
                {scannerMessage}
              </div>
            )}

            <div className="rounded-lg bg-black/75 border border-white/20 px-2 py-1 flex items-center justify-between gap-2">
              <span className="text-[10px] text-white font-bold">
                {scannedBins.length} gescand
              </span>

              <span className="text-[9px] text-slate-300">
                max. 1 per QR
              </span>
            </div>
          </div>
        </main>

        <footer className="p-1.5 bg-slate-950 flex-shrink-0">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={scannerActive ? stopQrScanner : startQrScanner}
              className={`min-h-[38px] rounded-lg text-[11px] font-black ${
                scannerActive
                  ? 'bg-red-500 text-white'
                  : 'bg-[#1A56DB] text-white'
              }`}
            >
              {scannerActive ? 'STOP' : 'START'}
            </button>

            <button
              onClick={() => {
                stopQrScanner();
                setStationPhase('profiles');
                setProfileIndex(0);
              }}
              className="min-h-[38px] rounded-lg bg-emerald-500 text-white text-[11px] font-black"
            >
              KLAAR
            </button>
          </div>

          <details className="mt-1">
            <summary className="text-[8px] text-slate-500 text-center cursor-pointer">
              fallback
            </summary>

            <div className="mt-1 flex gap-1">
              <input
                value={manualQr}
                onChange={(e) => setManualQr(e.target.value)}
                placeholder="BIN-M3"
                className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-[9px] bg-white text-slate-900"
              />

              <button
                onClick={() => {
                  if (acceptQrCode(manualQr)) setManualQr('');
                }}
                className="rounded-md bg-slate-700 text-white px-2 text-[9px] font-bold"
              >
                OK
              </button>
            </div>
          </details>
        </footer>
      </div>
    );
  }

  /* 4. PROFIELEN */
  if (screen === 'station' && stationPhase === 'profiles') {
    const profile = PROFILE_STOCK[profileIndex];
    const counted = profileCounts[profile.id];

    const shortage =
      counted === undefined ? null : Math.max(0, profile.target - counted);

    const setCount = (value: number) => {
      setProfileCounts((prev) => ({
        ...prev,
        [profile.id]: Math.max(0, Math.min(profile.target, value)),
      }));
    };

    const goNext = () => {
      if (counted === undefined) return;

      if (profileIndex < PROFILE_STOCK.length - 1) {
        setProfileIndex((index) => index + 1);
      } else {
        setScreen('pickup');
      }
    };

    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
        <WristHeader
          eyebrow={`${currentStation.name} · ${profileIndex + 1}/${PROFILE_STOCK.length}`}
          title="Profielen"
          onBack={() => {
            if (profileIndex > 0) {
              setProfileIndex((index) => index - 1);
            } else {
              setStationPhase(scannedBins.length > 0 ? 'scan' : 'empty-question');
            }
          }}
        />

        <main className="flex-1 min-h-0 p-2.5 flex flex-col justify-center">
          <div className="bg-white border-2 border-slate-200 rounded-xl p-2.5 text-center">
            <p className="text-[10px] uppercase text-slate-400 font-bold">
              Hoeveel aanwezig?
            </p>

            <h2 className="text-[17px] font-black text-slate-900 mt-1">
              {profile.name}
            </h2>

            <p className="text-[11px] text-slate-500 mt-1">
              Doel: {profile.target}
            </p>

            <div className="mt-3 flex items-center justify-center gap-2.5">
              <button
                onClick={() => setCount((counted ?? 0) - 1)}
                className="w-11 h-11 rounded-xl bg-slate-100 text-slate-900 text-[24px] font-black"
              >
                −
              </button>

              <div className="w-14 h-14 rounded-xl bg-[#0B1929] text-white flex items-center justify-center">
                <span className="text-[28px] font-black">
                  {counted ?? '–'}
                </span>
              </div>

              <button
                onClick={() => setCount((counted ?? 0) + 1)}
                className="w-11 h-11 rounded-xl bg-slate-100 text-slate-900 text-[24px] font-black"
              >
                +
              </button>
            </div>

            <button
              onClick={() => setCount(0)}
              className="mt-2 min-h-[32px] px-3 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold"
            >
              0 aanwezig
            </button>

            {shortage !== null && (
              <div
                className={`mt-2 rounded-lg px-2 py-1.5 ${
                  shortage === 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                <p className="text-[11px] font-black">
                  {shortage === 0 ? 'Voorraad OK' : `${shortage} bijhalen`}
                </p>
              </div>
            )}
          </div>
        </main>

        <footer className="p-2 pt-1 bg-slate-50 flex-shrink-0">
          <BigAction onClick={goNext} disabled={counted === undefined}>
            {profileIndex < PROFILE_STOCK.length - 1
              ? 'VOLGENDE'
              : 'OPHAALLIJST'}
          </BigAction>
        </footer>
      </div>
    );
  }

  /* 5. OPHAALLIJST — ALLES + LOCATIE */
  if (screen === 'pickup') {
    const allPicked =
      pickupItems.length === 0 ||
      pickupItems.every((item) => Boolean(pickupChecks[item.id]));

    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
        <WristHeader
          eyebrow={currentStation.name}
          title="Alles ophalen"
          onBack={() => {
            setScreen('station');
            setStationPhase('profiles');
            setProfileIndex(PROFILE_STOCK.length - 1);
          }}
        />

        <main className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
          {pickupItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Check className="w-10 h-10 text-emerald-500 mb-1.5" />
              <h2 className="text-[16px] font-black text-slate-900">
                Niets ophalen
              </h2>
            </div>
          ) : (
            pickupItems.map((item, index) => {
              const checked = Boolean(pickupChecks[item.id]);

              return (
                <button
                  key={item.id}
                  onClick={() =>
                    setPickupChecks((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                  className={`w-full rounded-xl border-2 p-2 text-left ${
                    checked
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-black ${
                        checked
                          ? 'bg-emerald-500 text-white'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {checked ? '✓' : index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="text-[12px] leading-tight font-black text-slate-900">
                        {item.label}
                      </p>
                      <p className="text-[10px] leading-tight font-bold text-blue-700 mt-0.5">
                        {item.location}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </main>

        <footer className="p-2 pt-1 bg-slate-50 flex-shrink-0">
          <BigAction
            onClick={() => {
              if (refillItems.length === 0) {
                finishStation();
              } else {
                setScreen('refill');
              }
            }}
            disabled={!allPicked}
            green
          >
            {refillItems.length === 0 ? 'KLAAR' : 'ALLES OPGEHAALD'}
          </BigAction>
        </footer>
      </div>
    );
  }

  /* 6. AANVULLEN */
  const allRefilled =
    refillItems.length === 0 ||
    refillItems.every((item) => Boolean(refillChecks[item.id]));

  return (
    <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
      <WristHeader
        eyebrow={currentStation.name}
        title="Aanvullen"
        onBack={() => setScreen('pickup')}
      />

      <main className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {refillItems.map((item, index) => {
          const checked = Boolean(refillChecks[item.id]);

          return (
            <button
              key={item.id}
              onClick={() =>
                setRefillChecks((prev) => ({
                  ...prev,
                  [item.id]: !prev[item.id],
                }))
              }
              className={`w-full rounded-xl border-2 p-2 text-left ${
                checked
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-black ${
                    checked
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {checked ? '✓' : index + 1}
                </div>

                <div className="min-w-0">
                  <p className="text-[12px] leading-tight font-black text-slate-900">
                    {item.label}
                  </p>
                  <p className="text-[10px] leading-tight font-bold text-emerald-700 mt-0.5">
                    {item.location}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </main>

      <footer className="p-2 pt-1 bg-slate-50 flex-shrink-0">
        <BigAction onClick={finishStation} disabled={!allRefilled} green>
          WERKPOST KLAAR
        </BigAction>
      </footer>
    </div>
  );
}
