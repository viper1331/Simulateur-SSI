import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';

export type AudioHubProps = {
  buzzerActive: boolean;
  ugaActive: boolean;
};

type ToneNode = {
  oscillator: OscillatorNode;
  gain: GainNode;
};

const disposeNode = (node: ToneNode | null) => {
  if (!node) return;
  try {
    node.oscillator.stop();
  } catch (error) {
    // oscillator already stopped
  }
  node.oscillator.disconnect();
  node.gain.disconnect();
};

const AudioHub = ({ buzzerActive, ugaActive }: AudioHubProps) => {
  const [armed, setArmed] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const contextRef = useRef<AudioContext | null>(null);
  const buzzerNodeRef = useRef<ToneNode | null>(null);
  const ugaNodeRef = useRef<ToneNode | null>(null);

  const ensureContext = useCallback(async () => {
    if (!contextRef.current) {
      const ctx = new AudioContext();
      contextRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    }
    return contextRef.current;
  }, []);

  const startTone = useCallback(
    async (frequency: number, destinationRef: MutableRefObject<ToneNode | null>) => {
      const ctx = await ensureContext();
      if (!ctx) return;
      if (destinationRef.current) {
        destinationRef.current.gain.gain.value = volume;
        return;
      }
      const oscillator = ctx.createOscillator();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      destinationRef.current = { oscillator, gain };
    },
    [ensureContext, volume]
  );

  const stopTone = useCallback((ref: MutableRefObject<ToneNode | null>) => {
    if (ref.current) {
      disposeNode(ref.current);
      ref.current = null;
    }
  }, []);

  useEffect(() => {
    if (!armed) {
      stopTone(buzzerNodeRef);
      stopTone(ugaNodeRef);
      return;
    }
    if (buzzerActive) {
      void startTone(980, buzzerNodeRef);
    } else {
      stopTone(buzzerNodeRef);
    }
    if (ugaActive) {
      void startTone(415, ugaNodeRef);
    } else {
      stopTone(ugaNodeRef);
    }
  }, [armed, buzzerActive, ugaActive, startTone, stopTone]);

  useEffect(() => {
    const ref = buzzerNodeRef.current;
    if (ref) {
      ref.gain.gain.value = volume;
    }
    const uga = ugaNodeRef.current;
    if (uga) {
      uga.gain.gain.value = volume * 0.8;
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      stopTone(buzzerNodeRef);
      stopTone(ugaNodeRef);
      if (contextRef.current) {
        contextRef.current.close().catch(() => undefined);
      }
    };
  }, [stopTone]);

  const armAudio = async () => {
    await ensureContext();
    setArmed(true);
  };

  return (
    <div className="space-y-3">
      <header className="text-xs uppercase tracking-[0.3em] text-slate-400">Audio façade</header>
      <p className="text-xs text-slate-400">
        {armed
          ? 'Synthèse audio active. Ajustez le volume ou utilisez la touche B pour le buzzer.'
          : 'Activez le hub audio pour entendre le buzzer et la BAAS.'}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={armAudio}
          className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
            armed ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
          }`}
          aria-pressed={armed}
        >
          {armed ? 'Audio armé' : 'Activer audio'}
        </button>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="h-1 w-48 cursor-pointer appearance-none rounded-full bg-slate-700"
            aria-label="Volume hub audio"
          />
        </label>
      </div>
      <div className="text-xs text-slate-400">
        Buzzer {buzzerActive ? 'ON' : 'OFF'} • UGA sonore {ugaActive ? 'ON' : 'OFF'}
      </div>
    </div>
  );
};

export default AudioHub;
