import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Video, VideoOff } from 'lucide-react';

interface Props {
  onPhotoCaptured?: (dataUrl: string) => void;
}

export function WorkstationWebcam({ onPhotoCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    stopCamera();
    setPhotoUrl(null);
    setStatus('starting');
    setErrorMessage('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Deze browser ondersteunt geen cameratoegang.');
      }

      // Geen facingMode forceren: op een pc kiest de browser zo de USB-
      // webcam, en op iPad kan Safari een beschikbare externe camera kiezen.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('live');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Camera kon niet geopend worden.';
      setErrorMessage(message);
      setStatus('error');
    }
  };

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
    // Alleen starten bij mount; herstarten gebeurt bewust via de knop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPhotoUrl(dataUrl);
    onPhotoCaptured?.(dataUrl);
    stopCamera();
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
        {!photoUrl && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-contain ${status === 'live' ? 'block' : 'hidden'}`}
          />
        )}

        {photoUrl && (
          <img src={photoUrl} alt="Controlefoto webcam" className="w-full h-full object-contain" />
        )}

        {status === 'starting' && !photoUrl && (
          <div className="text-center text-white p-8">
            <Video className="w-12 h-12 mx-auto mb-3 text-blue-400 animate-pulse" />
            <p className="font-bold">Webcam openen…</p>
            <p className="text-sm text-slate-400 mt-1">Sta cameratoegang toe wanneer de browser dit vraagt.</p>
          </div>
        )}

        {status === 'error' && !photoUrl && (
          <div className="text-center text-white p-8 max-w-lg">
            <VideoOff className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <p className="font-bold">Webcam niet beschikbaar</p>
            <p className="text-sm text-slate-400 mt-2">{errorMessage}</p>
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
          {photoUrl ? 'FOTO GENOMEN' : status === 'live' ? '● WEBCAM LIVE' : 'WEBCAM'}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {status === 'live' && !photoUrl && (
          <button
            type="button"
            onClick={capturePhoto}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-bold flex items-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Foto nemen
          </button>
        )}

        {(photoUrl || status === 'error') && (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-6 py-3 font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            {photoUrl ? 'Foto opnieuw nemen' : 'Opnieuw proberen'}
          </button>
        )}
      </div>

      {photoUrl && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-sm font-bold text-amber-900">Webcamfoto klaar voor beeldanalyse</p>
          <p className="text-xs text-amber-700 mt-1">
            De camera-opname werkt. Automatisch OK/NOK wordt apart gekoppeld aan de visioncontrole.
          </p>
        </div>
      )}
    </div>
  );
}
