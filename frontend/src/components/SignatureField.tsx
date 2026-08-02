import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import SignaturePad from 'signature_pad';
import { Eraser } from 'lucide-react';

export interface SignatureFieldHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

interface SignatureFieldProps {
  title: string;
  signerName: string;
  ariaLabel: string;
  onStateChange: (hasSignature: boolean) => void;
}

export const SignatureField = forwardRef<SignatureFieldHandle, SignatureFieldProps>(
  function SignatureField({ title, signerName, ariaLabel, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);

    useImperativeHandle(ref, () => ({
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toDataURL: () => padRef.current?.toDataURL('image/png') || '',
      clear: () => {
        padRef.current?.clear();
        onStateChange(false);
      },
    }), [onStateChange]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pad = new SignaturePad(canvas, {
        penColor: '#161616',
        backgroundColor: '#ffffff',
        minWidth: 1.2,
        maxWidth: 3.2,
        throttle: 8,
      });
      padRef.current = pad;
  onStateChange(false);
      const updateState = () => onStateChange(!pad.isEmpty());
      pad.addEventListener('endStroke', updateState);

      const resize = () => {
        const data = pad.toData();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = 185 * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        pad.clear();
        if (data.length > 0) pad.fromData(data);
        onStateChange(data.length > 0);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);

      return () => {
        observer.disconnect();
        pad.removeEventListener('endStroke', updateState);
        pad.off();
        padRef.current = null;
      };
    }, [onStateChange]);

    return (
      <div className="border-2 border-neutral-300 bg-white rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-neutral-100 border-b flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-neutral-800">{title}</p>
            <p className="text-xs text-neutral-500">{signerName}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              padRef.current?.clear();
              onStateChange(false);
            }}
            className="inline-flex items-center gap-1 text-xs text-red-600 font-medium shrink-0"
          >
            <Eraser className="w-4 h-4" /> Wyczyść
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="block w-full h-[185px] touch-none cursor-crosshair"
          aria-label={ariaLabel}
        />
        <p className="px-4 py-2 text-[11px] text-neutral-500 border-t bg-neutral-50">
          Podpisz palcem, rysikiem lub myszką.
        </p>
      </div>
    );
  }
);
