import { useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, Trash2, VideoOff } from 'lucide-react';
import { IndustrialHeader } from './IndustrialHeader';
import {
  getReferenceImage,
  saveReferenceImage,
  clearReferenceImage,
  type ProductKey,
} from '../lib/productVision';

interface Props {
  operatorSettings: {
    operatorName: string;
    line: string;
    station: string;
  };
  onBack: () => void;
}

// Zelfde voorkeurscamera als de andere controles, zodat kalibreren en
// effectief controleren altijd via dezelfde, vast gemonteerde camera
// gebeurt.
const PREFERRED_CAMERA_PATTERN = /c270/i;

export function ProductCalibrationScreen({ operatorSettings, onBack }: Props) {
  const [product, setProduct] = useState<ProductKey>('product1');
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState('');
  const [referencePreview, setReferencePreview] = useState<string | null>(
    getReferenceImage('product1')
  );
  const [justSaved, setJustSaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    stopCamera();
    setStatus('starting');
    setErrorMessage('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Deze browser ondersteunt geen cameratoegang.');
      }

      let videoInputCount = 2;
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
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const preferred = devices.find(
            (d) => d.kind === 'videoinput' && PREFERRED_CAMERA_PATTERN.test(d.label)
          );
          const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId;

          if (preferred && preferred.deviceId !== activeId) {
            stream.getTracks().forEach((track) => track.stop());
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: preferred.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
              audio: false,
            });
          }
        } catch {
          // Voorkeurscamera niet gevonden: gewoon de al actieve camera gebruiken.
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

  useEffect(() => {
    setReferencePreview(getReferenceImage(product));
    setJustSaved(false);
  }, [product]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    saveReferenceImage(product, dataUrl);
    setReferencePreview(dataUrl);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 3000);
  };

  const handleClear = () => {
    clearReferenceImage(product);
    setReferencePreview(null);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden">
      <IndustrialHeader
        title="Kalibratie eindcontrole"
        subtitle="Referentiefoto's voor de automatische productcontrole"
        operatorSettings={operatorSettings}
        onBack={onBack}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-8">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-5">
            <p className="text-sm text-blue-800 leading-relaxed">
              Leg voor elk product één referentiefoto vast van een <strong>correct en volledig
              afgewerkt exemplaar</strong>, vanuit exact de positie waar de camera vast hangt. De
              eindcontrole vergelijkt daar vanaf nu automatisch tegen. Verplaats je de camera
              later, kom dan gewoon terug naar dit scherm en leg een nieuwe referentiefoto vast —
              er hoeft nergens code aangepast te worden.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProduct('product1')}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                product === 'product1'
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="block font-bold text-sm">Product 1</span>
            </button>
            <button
              type="button"
              onClick={() => setProduct('product2')}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                product === 'product2'
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="block font-bold text-sm">Product 2</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">
                Live camerabeeld
              </h3>

              <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-contain ${
                    status === 'live' ? 'block' : 'hidden'
                  }`}
                />

                {status === 'starting' && (
                  <div className="text-center text-white p-6">
                    <Camera className="w-10 h-10 mx-auto mb-2 text-blue-400 animate-pulse" />
                    <p className="text-sm font-bold">Webcam openen…</p>
                  </div>
                )}

                {status === 'error' && (
                  <div className="text-center text-white p-6">
                    <VideoOff className="w-10 h-10 mx-auto mb-2 text-red-400" />
                    <p className="text-sm font-bold mb-3">{errorMessage}</p>
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="bg-white text-slate-800 rounded-lg px-4 py-2 text-xs font-bold inline-flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Opnieuw proberen
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleCapture}
                disabled={status !== 'live'}
                className="mt-4 w-full py-3.5 rounded-lg text-white font-bold text-sm flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
              >
                <Camera className="w-4 h-4" />
                Vastleggen als referentie voor {product === 'product1' ? 'Product 1' : 'Product 2'}
              </button>

              {justSaved && (
                <div className="mt-3 flex items-center gap-2 text-green-700 text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Referentiefoto opgeslagen.
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">
                Huidige referentie — {product === 'product1' ? 'Product 1' : 'Product 2'}
              </h3>

              {referencePreview ? (
                <>
                  <img
                    src={referencePreview}
                    alt={`Referentie ${product}`}
                    className="w-full h-auto rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={handleClear}
                    className="mt-4 w-full py-2.5 rounded-lg text-red-700 border border-red-200 hover:bg-red-50 font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Referentie wissen
                  </button>
                </>
              ) : (
                <div className="aspect-video rounded-lg bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center text-center text-gray-400 text-sm p-6">
                  Nog geen referentiefoto ingesteld voor{' '}
                  {product === 'product1' ? 'Product 1' : 'Product 2'}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
