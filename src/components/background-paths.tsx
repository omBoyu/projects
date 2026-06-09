"use client";

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, index) => ({
    id: index,
    d: `M-${380 - index * 5 * position} -${189 + index * 6}C-${
      380 - index * 5 * position
    } -${189 + index * 6} -${312 - index * 5 * position} ${
      216 - index * 6
    } ${152 - index * 5 * position} ${343 - index * 6}C${
      616 - index * 5 * position
    } ${470 - index * 6} ${684 - index * 5 * position} ${
      875 - index * 6
    } ${684 - index * 5 * position} ${875 - index * 6}`,
    width: 0.5 + index * 0.03,
  }));

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 696 316"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {paths.map((path) => (
        <path
          key={path.id}
          className="travel-background-path"
          d={path.d}
          pathLength={1}
          stroke="currentColor"
          strokeWidth={path.width}
          strokeOpacity={Math.min(0.1 + path.id * 0.025, 0.95)}
          style={{
            animationDelay: `${path.id * -0.42}s`,
            animationDuration: `${20 + (path.id % 9)}s`,
          }}
        />
      ))}
    </svg>
  );
}

export function BackgroundPaths() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-white text-slate-950">
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>
    </div>
  );
}
