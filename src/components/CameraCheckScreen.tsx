import { useEffect, useRef, useState } from 'react';
import { Smartphone, Camera, Loader2, X, Check, ChevronRight } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';
import { WorkstationWebcam } from './WorkstationWebcam';
import { CameraMode, NTFY_TOPIC } from '../main';
import { analyseMalPhoto } from '../lib/malVision';
import { postNtfyJson } from '../services/ntfy';

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
  cameraMode: CameraMode;
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
  cameraMode,
  onBack,
  onSettings,
}: Props) {
  const [state, setState] = useState<CheckState>('waiting');
  const [webcamError, setWebcamError] = useState('');
  // NIEUW: percentage van de referentiekleur die nog zichtbaar was, om te
  // tonen bij een afkeuring — zowel bij de webcam- als de telefooncontrole.
  const [detectedPercentage, setDetectedPercentage] = useState<number | null>(null);

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
    setDetectedPercentage(data.percentage);
    setState(data.status === 'ok' ? 'result-pass' : 'result-fail');
  };

  // NIEUW: automatische analyse — wordt door WorkstationWebcam zelf
  // aangeroepen zodra het beeld gestabiliseerd is, geen knop nodig. Het
  // live camerabeeld blijft gewoon zichtbaar terwijl dit loopt.
  const handleAnalyseFrame = async (dataUrl: string) => {
    setWebcamError('');

    try {
      const result = await analyseMalPhoto(dataUrl, expectedProduct);
      const payload: CheckResult = {
        product: expectedProduct,
        status: result.status,
        percentage: result.percentage,
        context: 'camera-check',
        timestamp: Date.now(),
      };

      // Zelfde resultaatformaat als de bestaande telefooncontrole. Dit houdt
      // de kwaliteitslog en eventuele lokale koppelingen compatibel.
      try {
        localStorage.setItem('camera_check_result', JSON.stringify(payload));
      } catch {
        // De lokale beoordeling blijft werken als opslag niet beschikbaar is.
      }
