/** Renders a pixel grid as crisp SVG rects. `rows` uses one character per pixel; '.' is empty. */
export function PixelArt({
  rows,
  palette,
  className,
  title,
}: {
  rows: string[];
  palette: Record<string, string>;
  className?: string;
  title?: string;
}) {
  const width = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      viewBox={`0 0 ${width} ${rows.length}`}
      shapeRendering="crispEdges"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          palette[ch] ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={palette[ch]} />
          ) : null,
        ),
      )}
    </svg>
  );
}

/** A round hobbit-hole door: the brand mark. */
export const DOOR_ROWS = [
  '.....bbbbbb.....',
  '...bbggggggbb...',
  '..bggggggggggb..',
  '.bggdggdggdgggb.',
  '.bggdggdggdgggb.',
  'bgggdggdggdggggb',
  'bgggdggdggdggggb',
  'bgggdggdggdyyggb',
  'bgggdggdggdyyggb',
  'bgggdggdggdggggb',
  'bgggdggdggdggggb',
  'bgggdggdggdggggb',
  'bbbbbbbbbbbbbbbb',
];
export const DOOR_PALETTE = { b: '#8a5a2b', g: '#3fae5a', d: '#2f8a45', y: '#ffd23f' };

export function DoorIcon({ className }: { className?: string }) {
  return <PixelArt rows={DOOR_ROWS} palette={DOOR_PALETTE} className={className} />;
}
