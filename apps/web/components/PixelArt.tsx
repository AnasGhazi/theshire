/** Renders a pixel grid as crisp SVG rects. `rows` uses one character per pixel; '.' is empty. */
export function PixelArt({
  rows,
  palette,
  className,
  title,
  style,
}: {
  rows: string[];
  palette: Record<string, string>;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}) {
  const width = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      viewBox={`0 0 ${width} ${rows.length}`}
      shapeRendering="crispEdges"
      className={className}
      style={style}
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
export const DOOR_PALETTE = {
  b: '#8a5a2b',
  g: '#3fae5a',
  d: '#2f8a45',
  y: '#ffd23f',
  k: '#1c0f06', // dark hallway
  L: '#ffb547', // warm light inside
  W: '#ffe9a8', // brightest glow
};

const isDoor = (ch: string) => ch === 'g' || ch === 'd' || ch === 'y';

/** The door swung half open: the left side shows the lit hallway behind it. */
export const DOOR_AJAR_ROWS = DOOR_ROWS.map((row, y) =>
  [...row].map((ch, x) => (isDoor(ch) && x < 9 ? (x >= 5 && y >= 5 ? 'L' : 'k') : ch)).join(''),
);

/** The door fully open: a glowing hallway. */
export const DOOR_OPEN_ROWS = DOOR_ROWS.map((row, y) =>
  [...row]
    .map((ch, x) => {
      if (!isDoor(ch)) return ch;
      const dx = Math.abs(x - 7.5);
      if (y >= 6 && dx < 2.5) return 'W';
      if (y >= 3 && dx < 4.5) return 'L';
      return 'k';
    })
    .join(''),
);

export function DoorIcon({ className }: { className?: string }) {
  return <PixelArt rows={DOOR_ROWS} palette={DOOR_PALETTE} className={className} />;
}
