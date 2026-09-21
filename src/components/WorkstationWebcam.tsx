import { useEffect, useRef, useState } from 'react';
import { Loader2, Video, VideoOff, RefreshCw } from 'lucide-react';

interface Props {
  // Krijgt een dataURL van het automatisch genomen beeld en voert de
  // analyse uit. Zolang deze niet resolvet, blijft het live beeld gewoon
  // zichtbaar met een "analyseren"-balk eroverheen.
  onAnalyseFrame: (dataUrl: string) => Promise<void>;
  // Of er nog een (nieuwe) automatische opname mag gebeuren. Op false
  // zetten (bv. zodra er een resultaat binnen is) stopt verdere opnames.
  active: boolean;
  // Hoe lang wachten na het live worden van de camera vóór de eerste
  // automatische opname — geeft de camera de tijd om scherp te stellen.
  stabiliseMs?: number;
}

// Naam zoals de browser de Logitech C270 typisch rapporteert. Wordt enkel
// gebruikt om, als er toevallig meerdere camera's beschikbaar zijn (bv.
// een ingebouwde laptopcam naast de gemonteerde C270), automatisch de
// juiste te kiezen — geen probleem als hij niet gevonden wordt, dan blijft
// gewoon de standaardcamera actief.
const PREFERRED_CAMERA_PATTERN = /c270/i;

export function WorkstationWebcam({ onAnalyseFrame, active, stabiliseMs = 1200 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedRef = useRef(false);
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState('');
  const [analysing, setAnalysing] = useState(false);

  // NIEUW (bugfix): onAnalyseFrame krijgt bij elke render van het
  // bovenliggende scherm een nieuwe functie-referentie mee (heel normaal
  // in React, bv. omdat de omsteltimer elke seconde meetelt). Stond die
  // functie rechtstreeks in de dependency-lijst van de opname-timer
  // hieronder, dan werd die timer bij elke render herstart — waardoor de
  // automatische opname bijna nooit op tijd (of soms helemaal niet)
  // gebeurde. Door de laatste versie in een ref te bewaren, blijft de
  // timer zelf volledig stabiel en loopt hij gewoon de ingestelde
  // stabiliseMs af, ongeacht hoe vaak de ouder opnieuw rendert.
  const onAnalyseFrameRef = useRef(onAnalyseFrame);
  useEffect(() => {
    onAnalyseFrameRef.current = onAnalyseFrame;
  }, [onAnalyseFrame]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const findPreferredDeviceId = async (): Promise<string | undefined> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.find(
        (d) => d.kind === 'videoinput' && PREFERRED_CAMERA_PATTERN.test(d.label)
      )?.deviceId;
    } catch {
      return undefined;
    }
  };

  const startCamera = async () => {
    stopCamera();
    capturedRef.current = false;
    setStatus('starting');
    setErrorMessage('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Deze browser ondersteunt geen cameratoegang.');
      }

      // Tel eerst hoeveel camera's er zijn — dit kan ook al vóór
      // toestemming (enkel de namen/labels blijven dan nog leeg). Is er
      // maar één camera (het normale geval bij een vast gemonteerde
      // C270), dan hoeven we helemaal niet op zoek te gaan naar een
      // "voorkeurscamera": één simpele aanvraag volstaat, en dat scheelt
      // een volledige, overbodige heropstart van de camera.
      let videoInputCount = 2; // veilige aanname: bij twijfel wél controleren
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoInputCount = devices.filter((d) => d.kind === 'videoinput').length;
      } catch {
        // Kon niet vooraf tellen: gewoon de volledige, veilige route volgen.
      }

      let stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      if (videoInputCount > 1) {
        // Meerdere camera's aanwezig (bv. een ingebouwde laptopcam naast
        // de C270): nu pas, na toestemming, de echte namen bekijken en
        // indien nodig expliciet naar de C270 wisselen.
        const preferredId = await findPreferredDeviceId();
        const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId;

        if (preferredId && preferredId !== activeId) {
          stream.getTracks().forEach((track) => track.stop());
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: preferredId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('live');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Camera kon niet geopend worden.';

      setErrorMessage(message);
      setStatus('error');
    }
  };

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatische opname: zodra de camera live is (en nog niets is
  // vastgelegd), wachten we even zodat het beeld kan scherpstellen, en
  // nemen we dan zelf een beeld — geen knop nodig. Het live beeld blijft
  // gewoon op het scherm staan terwijl onAnalyseFrame verwerkt wordt.
  useEffect(() => {
    if (status !== 'live' || !active || capturedRef.current) return;

    const timeout = window.setTimeout(async () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      capturedRef.current = true;
      setAnalysing(true);
      try {
        await onAnalyseFrameRef.current(dataUrl);
      } finally {
        setAnalysing(false);
      }
    }, stabiliseMs);

    return () => window.clearTimeout(timeout);
    // NIEUW (bugfix): onAnalyseFrame bewust NIET in deze dependency-lijst.
    // De laatste versie ervan wordt via onAnalyseFrameRef gelezen (zie
    // hierboven), net om te voorkomen dat deze timer bij elke render van
    // de ouder herstart wordt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, active, stabiliseMs]);

  // Laat een nieuwe automatische ronde toe, bv. na een afkeuring die de
  // operator wil herstellen en opnieuw wil laten controleren.
  const retry = () => {
    capturedRef.current = false;
    void startCamera();
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-contain ${status === 'live' ? 'block' : 'hidden'}`}
        />

        {status === 'starting' && (
          <div className="text-center text-white p-8">
            <Video className="w-12 h-12 mx-auto mb-3 text-blue-400 animate-pulse" />
            <p className="font-bold">Webcam openen…</p>
            <p className="text-sm text-slate-400 mt-1">
              Sta cameratoegang toe wanneer de browser dit vraagt.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-white p-8 max-w-lg">
            <VideoOff className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <p className="font-bold">Webcam niet beschikbaar</p>
            <p className="text-sm text-slate-400 mt-2">{errorMessage}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-5 py-2.5 font-bold text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Opnieuw proberen
            </button>
          </div>
        )}

        {status === 'live' && active && (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-sm px-4 py-3 flex items-center justify-center gap-3 text-white">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-bold">
              {analysing ? 'Beeld wordt geanalyseerd…' : 'Klaarmaken voor automatische opname…'}
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
          {status === 'live' ? '● WEBCAM LIVE' : 'WEBCAM'}
        </div>
      </div>
    </div>
  );
}
