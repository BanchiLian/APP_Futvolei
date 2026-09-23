import sharp from 'sharp';

/**
 * Stand-in photos for the seeded feed.
 *
 * These are drawn, not photographed: flat illustrations of a court at different
 * times of day. They exist so the feed has something to show while the arena has
 * no real photos yet, and they are deliberately stylised rather than trying to
 * pass for real pictures.
 */

interface Scene {
  sky: [string, string];
  sand: string;
  sun: string;
  /** Sun height as a fraction of the sky band. */
  sunY: number;
}

const SCENES: Scene[] = [
  // Morning
  { sky: ['#7dd3fc', '#e0f2fe'], sand: '#f4d9a6', sun: '#fde68a', sunY: 0.35 },
  // Midday
  { sky: ['#38bdf8', '#bae6fd'], sand: '#f0cf93', sun: '#fef9c3', sunY: 0.18 },
  // Late afternoon
  { sky: ['#fb923c', '#fde68a'], sand: '#e8c187', sun: '#fb7185', sunY: 0.52 },
  // Dusk
  { sky: ['#4c1d95', '#f472b6'], sand: '#c9a06b', sun: '#fbbf24', sunY: 0.62 },
  // Night, under the floodlights
  { sky: ['#0b1120', '#1e293b'], sand: '#a97f52', sun: '#fef08a', sunY: 0.2 },
];

function player(x: number, groundY: number, height: number, flip = false): string {
  const head = height * 0.18;
  const body = height * 0.45;
  const legs = height - head - body;
  const lean = flip ? -1 : 1;

  return `
    <g fill="#1f2937" opacity="0.88">
      <circle cx="${x}" cy="${groundY - legs - body - head / 2}" r="${head / 2}" />
      <rect x="${x - height * 0.07}" y="${groundY - legs - body}" width="${height * 0.14}"
            height="${body}" rx="${height * 0.07}" />
      <rect x="${x - height * 0.05}" y="${groundY - legs}" width="${height * 0.045}"
            height="${legs}" rx="${height * 0.02}" />
      <rect x="${x + height * 0.01}" y="${groundY - legs}" width="${height * 0.045}"
            height="${legs}" rx="${height * 0.02}" />
      <rect x="${x + lean * height * 0.06}" y="${groundY - legs - body * 0.95}"
            width="${height * 0.04}" height="${body * 0.6}" rx="${height * 0.02}"
            transform="rotate(${lean * -35} ${x} ${groundY - legs - body * 0.9})" />
    </g>`;
}

function sceneSvg(scene: Scene, width: number, height: number, seed: number): string {
  const horizon = Math.round(height * 0.62);
  const netHeight = Math.round(height * 0.3);
  const netX = Math.round(width * (0.4 + (seed % 3) * 0.08));
  const ballX = Math.round(width * (0.2 + ((seed * 7) % 60) / 100));
  const ballY = Math.round(height * (0.2 + ((seed * 13) % 25) / 100));

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${scene.sky[0]}" />
        <stop offset="100%" stop-color="${scene.sky[1]}" />
      </linearGradient>
      <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${scene.sand}" />
        <stop offset="100%" stop-color="#b98c58" />
      </linearGradient>
    </defs>

    <rect width="${width}" height="${horizon}" fill="url(#sky)" />
    <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(horizon * scene.sunY)}"
            r="${Math.round(height * 0.07)}" fill="${scene.sun}" opacity="0.9" />
    <rect y="${horizon}" width="${width}" height="${height - horizon}" fill="url(#sand)" />

    <!-- net -->
    <rect x="${netX}" y="${horizon - netHeight}" width="4" height="${netHeight}" fill="#1f2937" opacity="0.7" />
    <rect x="${netX + 4}" y="${horizon - netHeight}" width="${Math.round(width * 0.42)}"
          height="${Math.round(netHeight * 0.45)}" fill="none" stroke="#f8fafc" stroke-width="2"
          stroke-dasharray="8 6" opacity="0.75" />
    <rect x="${netX + 4 + Math.round(width * 0.42)}" y="${horizon - netHeight}" width="4"
          height="${netHeight}" fill="#1f2937" opacity="0.7" />

    ${player(Math.round(width * 0.24), horizon + Math.round(height * 0.12), Math.round(height * 0.3))}
    ${player(Math.round(width * 0.78), horizon + Math.round(height * 0.16), Math.round(height * 0.26), true)}

    <circle cx="${ballX}" cy="${ballY}" r="${Math.round(height * 0.035)}" fill="#fbbf24" />
    <circle cx="${ballX}" cy="${ballY}" r="${Math.round(height * 0.035)}" fill="none"
            stroke="#b45309" stroke-width="2" opacity="0.7" />
  </svg>`;
}

/** A JPEG of one court scene, as a phone camera would deliver it. */
export function renderSampleCourtPhoto(index: number): Promise<Buffer> {
  const scene = SCENES[index % SCENES.length] ?? SCENES[0]!;
  // Portrait or landscape, alternating, so the feed shows both shapes.
  const portrait = index % 3 === 1;
  const width = portrait ? 1080 : 1440;
  const height = portrait ? 1350 : 1080;

  return sharp(Buffer.from(sceneSvg(scene, width, height, index + 1)))
    .jpeg({ quality: 88 })
    .toBuffer();
}
