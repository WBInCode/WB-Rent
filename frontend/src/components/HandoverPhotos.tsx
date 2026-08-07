import { useEffect, useRef, useState } from 'react';
import { Camera, ImageOff, ImagePlus, Loader2, SwitchCamera, Trash2, X } from 'lucide-react';
import {
  deleteReservationPhoto,
  getReservationPhotos,
  loadPhotoObjectUrl,
  uploadReservationPhoto,
  type PhotoPhase,
  type ReservationPhoto,
} from '@/services/adminApi';

interface HandoverPhotosProps {
  reservationId: number;
  takenBy?: string;
  onNotify?: (message: string, tone?: 'success' | 'error') => void;
  /** Ograniczenie do jednej fazy - protokół wydania nie potrzebuje zdjęć zwrotu. */
  phases?: PhotoPhase[];
  onCountChange?: (counts: Record<PhotoPhase, number>) => void;
}

const PHASE_LABEL: Record<PhotoPhase, string> = {
  before: 'Przed wydaniem',
  after: 'Po zwrocie',
};

/** Full-resolution tablet photos are several MB - useless as evidence and slow to send. */
const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.85;

const canvasToFile = (canvas: HTMLCanvasElement, name: string) =>
  new Promise<File | null>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], name, { type: 'image/jpeg' }) : null),
      'image/jpeg',
      JPEG_QUALITY
    );
  });

const scaledCanvas = (source: CanvasImageSource, width: number, height: number) => {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/** Re-encodes to JPEG and applies EXIF rotation, so uploads stay small and upright. */
async function shrinkImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) return file;
  const canvas = scaledCanvas(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  const shrunk = await canvasToFile(canvas, `${file.name.replace(/\.[^.]+$/, '')}.jpg`);
  return shrunk || file;
}

interface CameraDialogProps {
  title: string;
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * The `capture="environment"` attribute is only a hint and tablets often ignore it,
 * so the rear lens is selected explicitly through getUserMedia.
 */
function CameraDialog({ title, onCapture, onClose }: CameraDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const stopStream = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const start = async () => {
      stopStream();
      setReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Ta przeglądarka nie udostępnia aparatu. Użyj przycisku „Z galerii”.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setError('');
        setReady(true);
      } catch {
        if (!cancelled) setError('Nie udało się uruchomić aparatu. Sprawdź uprawnienia strony do kamery.');
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing]);

  const shoot = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = scaledCanvas(video, video.videoWidth, video.videoHeight);
    const file = await canvasToFile(canvas, `zdjecie-${Date.now()}.jpg`);
    if (file) onCapture(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-text-primary">
        <p className="text-sm font-semibold">{title}</p>
        <button type="button" onClick={onClose} aria-label="Zamknij aparat" className="rounded-lg p-2 hover:bg-surface-strong">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
        {error && (
          <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-lg bg-black/80 p-4 text-center text-sm text-white">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-8 px-4 py-6">
        <button
          type="button"
          onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))}
          aria-label="Przełącz aparat"
          className="rounded-full border border-border-hover p-3 text-text-primary hover:bg-surface-strong"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => void shoot()}
          disabled={!ready}
          aria-label="Zrób zdjęcie"
          className="h-16 w-16 rounded-full border-4 border-white bg-white/20 transition-transform active:scale-95 disabled:opacity-40"
        />
        <span className="w-11" />
      </div>
    </div>
  );
}

/** Condition evidence for a rental: photos taken at handover and at return. */
export function HandoverPhotos({ reservationId, takenBy, onNotify, phases, onCountChange }: HandoverPhotosProps) {
  const [photos, setPhotos] = useState<ReservationPhoto[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState<PhotoPhase | null>(null);
  const [cameraPhase, setCameraPhase] = useState<PhotoPhase | null>(null);
  const beforeInput = useRef<HTMLInputElement>(null);
  const afterInput = useRef<HTMLInputElement>(null);

  const notify = (message: string, tone: 'success' | 'error' = 'success') =>
    onNotify ? onNotify(message, tone) : undefined;

  const load = async () => {
    const response = await getReservationPhotos(reservationId);
    if (!response.success) return;
    const lista: ReservationPhoto[] = response.data || [];
    setPhotos(lista);
    onCountChange?.({
      before: lista.filter((photo) => photo.phase === 'before').length,
      after: lista.filter((photo) => photo.phase === 'after').length,
    });
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  // Thumbnails need the auth header, so each one is fetched into a blob URL.
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    (async () => {
      for (const photo of photos) {
        if (previews[photo.id]) continue;
        const url = await loadPhotoObjectUrl(photo.id);
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (url) {
          created.push(url);
          setPreviews((current) => ({ ...current, [photo.id]: url }));
        }
      }
    })();

    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  const handleFile = async (phase: PhotoPhase, file: File | undefined) => {
    if (!file) return;
    setUploading(phase);
    const response = await uploadReservationPhoto(reservationId, await shrinkImage(file), { phase, takenBy });
    setUploading(null);
    if (!response.success) {
      notify(response.message || 'Nie udało się zapisać zdjęcia', 'error');
      return;
    }
    notify(response.message || 'Zdjęcie zapisane');
    void load();
  };

  const remove = async (photo: ReservationPhoto) => {
    if (!window.confirm('Usunąć to zdjęcie?')) return;
    const response = await deleteReservationPhoto(photo.id);
    if (!response.success) {
      notify(response.message || 'Nie udało się usunąć zdjęcia', 'error');
      return;
    }
    setPreviews((current) => {
      const next = { ...current };
      if (next[photo.id]) URL.revokeObjectURL(next[photo.id]);
      delete next[photo.id];
      return next;
    });
    notify('Zdjęcie usunięte');
    void load();
  };

  const renderPhase = (phase: PhotoPhase, inputRef: React.RefObject<HTMLInputElement | null>) => {
    const phasePhotos = photos.filter((photo) => photo.phase === phase);

    return (
      <div className="rounded-[--radius-sm] border border-border bg-surface-soft p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">{PHASE_LABEL[phase]}</p>
            <p className="text-xs text-text-muted">
              {phasePhotos.length > 0 ? `${phasePhotos.length} zdjęć` : 'Brak zdjęć'}
            </p>
          </div>
          <input spellCheck={false}
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleFile(phase, event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading !== null}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-hover px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-soft disabled:opacity-40"
            >
              <ImagePlus className="h-4 w-4" />
              Z galerii
            </button>
            <button
              type="button"
              onClick={() => setCameraPhase(phase)}
              disabled={uploading !== null}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gold/35 px-3 text-sm font-medium text-gold-light light:text-gold-dark transition-colors hover:bg-gold/10 disabled:opacity-40"
            >
              {uploading === phase ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Zrób zdjęcie
            </button>
          </div>
        </div>

        {phasePhotos.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {phasePhotos.map((photo) => (
              <li key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-black/30">
                {previews[photo.id] ? (
                  <img
                    src={previews[photo.id]}
                    alt={`${PHASE_LABEL[phase]} — zdjęcie ${photo.id}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-text-muted">
                    <ImageOff className="h-5 w-5" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void remove(photo)}
                  aria-label={`Usuń zdjęcie ${photo.id}`}
                  className="absolute right-1 top-1 rounded-md bg-black/70 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {(!phases || phases.includes('before')) && renderPhase('before', beforeInput)}
      {(!phases || phases.includes('after')) && renderPhase('after', afterInput)}
      {cameraPhase && (
        <CameraDialog
          title={PHASE_LABEL[cameraPhase]}
          onClose={() => setCameraPhase(null)}
          onCapture={(file) => {
            setCameraPhase(null);
            void handleFile(cameraPhase, file);
          }}
        />
      )}
    </div>
  );
}
