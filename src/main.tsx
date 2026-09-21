import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  ArrowLeft,
  Boxes,
  Check,
  Home,
  Loader2,
  LogOut,
  Route,
  ScanLine,
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
import { ProductCalibrationScreen } from './components/ProductCalibrationScreen';
import { postNtfyJson } from './services/ntfy';

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
  | 'settings'
  | 'calibration';

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
