"use client";

import { useCallback, useEffect, useRef } from "react";

type AudioPool = {
  play: () => void;
  dispose: () => void;
};

const createAudioPool = (src: string, size = 8, volume = 0.35): AudioPool | null => {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return null;
  }

  const elements = Array.from({ length: size }, () => {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = volume;
    audio.crossOrigin = "anonymous";
    return audio;
  });

  let pointer = 0;

  const play = () => {
    const next = elements[pointer];
    pointer = (pointer + 1) % elements.length;

    if (!next) {
      return;
    }

    next.currentTime = 0;
    const playPromise = next.play();
    if (playPromise) {
      playPromise.catch((error) => {
        // Ignore user gesture errors silently; surface others for debugging.
        if (error && error.name !== "NotAllowedError") {
          console.warn("Unable to play keypress sound", error);
        }
      });
    }
  };

  const dispose = () => {
    elements.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  };

  return { play, dispose };
};

type AudioCueOptions = {
  completionEnabled?: boolean;
  keypressEnabled?: boolean;
};

export function useAudioCues({
  completionEnabled = true,
  keypressEnabled = true,
}: AudioCueOptions = {}) {
  const keyPoolRef = useRef<AudioPool | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const keypressEnabledRef = useRef(keypressEnabled);

  useEffect(() => {
    keypressEnabledRef.current = keypressEnabled;

    if (!keypressEnabled) {
      keyPoolRef.current?.dispose();
      keyPoolRef.current = null;
      return;
    }

    if (!keyPoolRef.current) {
      keyPoolRef.current = createAudioPool("/press_down.mp3");
    }

    return () => {
      keyPoolRef.current?.dispose();
      keyPoolRef.current = null;
    };
  }, [keypressEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (!keypressEnabledRef.current) {
        return;
      }

      keyPoolRef.current?.play();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // Closing can reject if context is already closed or suspended; swallow silently.
        });
        audioContextRef.current = null;
      }
    };
  }, []);

  const playCompletion = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!completionEnabled) {
      return;
    }

    let context = audioContextRef.current;
    if (!context) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;

        if (!AudioContextClass) {
          console.warn("Web Audio API is not supported in this browser.");
          return;
        }

        context = new AudioContextClass();
        audioContextRef.current = context;
      } catch (error) {
        console.error("Unable to create AudioContext", error);
        return;
      }
    }

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.7);
    gain.connect(context.destination);

    const tones = [
      { frequency: 523.25, startOffset: 0 },
      { frequency: 659.25, startOffset: 0.12 },
      { frequency: 783.99, startOffset: 0.24 },
    ];

    let activeOscillators = tones.length;
    const handleEnded = () => {
      activeOscillators -= 1;
      if (activeOscillators === 0) {
        gain.disconnect();
      }
    };

    tones.forEach(({ frequency, startOffset }) => {
      const oscillator = context.createOscillator();
      oscillator.type = "triangle";
      const startTime = now + startOffset;
      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.connect(gain);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.32);
      oscillator.addEventListener("ended", handleEnded, { once: true });
    });
  }, [completionEnabled]);

  return { playCompletion };
}
