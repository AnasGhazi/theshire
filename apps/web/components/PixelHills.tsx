/**
 * A tiny pixel-art landscape (rolling hills, a hobbit-hole door, a sun) used as course banners.
 * Drawn from code so each course gets its own palette.
 */
export function PixelHills({
  sky,
  hills,
  seed = 1,
  className,
}: {
  sky: [string, string];
  hills: [string, string];
  seed?: number;
  className?: string;
}) {
  const W = 64;
  const H = 24;
  const back: number[] = [];
  const front: number[] = [];
  for (let x = 0; x < W; x += 2) {
    back.push(Math.round(13 + 3 * Math.sin((x + seed * 7) / 7)));
    front.push(Math.round(17 + 2.5 * Math.sin((x + seed * 13) / 5 + 1)));
  }
  const doorX = 10 + ((seed * 17) % 36);
  const doorTop = (front[Math.floor(doorX / 2)] ?? 17) + 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <rect width={W} height={H / 2} fill={sky[0]} />
      <rect y={H / 2} width={W} height={H / 2} fill={sky[1]} />
      {[3, 9, 22, 31, 44, 57].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={2 + ((i * 5) % 7)}
          width={1}
          height={1}
          fill="#ffffff"
          opacity={0.7}
        />
      ))}
      <rect x={50} y={3} width={5} height={5} fill="#ffd23f" />
      <rect x={51} y={2} width={3} height={7} fill="#ffd23f" />
      {back.map((h, i) => (
        <rect key={`b${i}`} x={i * 2} y={h} width={2} height={H - h} fill={hills[0]} />
      ))}
      {front.map((h, i) => (
        <rect key={`f${i}`} x={i * 2} y={h} width={2} height={H - h} fill={hills[1]} />
      ))}
      <rect x={doorX - 2} y={doorTop} width={5} height={H - doorTop} fill="#8a5a2b" />
      <rect x={doorX - 1} y={doorTop - 1} width={3} height={1} fill="#8a5a2b" />
      <rect x={doorX - 1} y={doorTop} width={3} height={H - doorTop} fill="#3fae5a" />
      <rect x={doorX + 1} y={doorTop + 2} width={1} height={1} fill="#ffd23f" />
    </svg>
  );
}
