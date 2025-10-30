"use client";

import { type CSSProperties, useEffect, useMemo } from "react";

const CONFETTI_COLORS = [
  "#facc15",
  "#f97316",
  "#22d3ee",
  "#38bdf8",
  "#a855f7",
  "#34d399",
  "#f472b6",
];

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  color: string;
  drift: number;
  rotateStart: number;
  rotateEnd: number;
};

type ConfettiBurstProps = {
  onDone: () => void;
  pieceCount?: number;
  seed: string;
};

const hashSeed = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return hash >>> 0;
};

const createGenerator = (seedValue: number) => {
  let seed = seedValue || 1;

  return () => {
    seed += 0x6d2b79f5;
    seed = seed >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const createConfettiPieces = (
  seed: string,
  count: number,
): ConfettiPiece[] => {
  const rng = createGenerator(hashSeed(seed));

  return Array.from({ length: count }, (_, pieceIndex) => {
    const width = 6 + rng() * 8;
    const height = width * (1.4 + rng() * 0.6);
    const rotateStart = rng() * 360;
    const rotateEnd = rotateStart + (rng() - 0.5) * 900;

    return {
      id: pieceIndex,
      color:
        CONFETTI_COLORS[
          Math.floor(rng() * CONFETTI_COLORS.length)
        ],
      delay: rng() * 160,
      duration: 2400 + rng() * 1400,
      left: rng() * 100,
      drift: (rng() - 0.5) * 42,
      width,
      height,
      rotateStart,
      rotateEnd,
    };
  });
};

export function ConfettiBurst({
  onDone,
  pieceCount = 140,
  seed,
}: ConfettiBurstProps) {
  const pieces = useMemo<ConfettiPiece[]>(
    () => createConfettiPieces(seed, pieceCount),
    [pieceCount, seed],
  );

  useEffect(() => {
    const timer = window.setTimeout(onDone, 3200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
      {pieces.map((piece) => {
        const style: CSSProperties & {
          [key: string]: string | number | undefined;
        } = {
          left: `${piece.left}%`,
          width: `${piece.width}px`,
          height: `${piece.height}px`,
          backgroundColor: piece.color,
          animationDelay: `${piece.delay}ms`,
          animationDuration: `${piece.duration}ms`,
        };

        style["--confetti-rotate-start"] = `${piece.rotateStart}deg`;
        style["--confetti-rotate-end"] = `${piece.rotateEnd}deg`;
        style["--confetti-drift"] = `${piece.drift}vw`;

        return (
          <span
            key={piece.id}
            className="confetti-piece"
            style={style}
          />
        );
      })}
    </div>
  );
}
