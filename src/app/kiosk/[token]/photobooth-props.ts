// Silly photo-booth face props (cowboy hat, mustache, sunglasses, party hat),
// drawn as self-contained SVGs so nothing loads off-network. Each prop is
// positioned relative to a detected face's bounding box; the same geometry
// drives the live preview overlay (<img>) and the saved still (canvas drawImage).

export type PropId = "cowboy" | "party" | "mustache" | "glasses";

// width/height on the root <svg> give the data-URL image an intrinsic size, so
// canvas drawImage() has a source rect to scale (0-size SVGs draw nothing).
const SVGS: Record<PropId, { svg: string; aspect: number }> = {
  cowboy: {
    aspect: 130 / 200,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='130' viewBox='0 0 200 130'>
      <path d='M58 94 C54 42 70 22 100 22 C130 22 146 42 142 94 Z' fill='#8a5a2b'/>
      <ellipse cx='100' cy='96' rx='96' ry='19' fill='#6b4423'/>
      <ellipse cx='100' cy='92' rx='96' ry='15' fill='#7c4e26'/>
      <rect x='58' y='76' width='84' height='14' rx='3' fill='#452a13'/>
    </svg>`,
  },
  party: {
    aspect: 160 / 200,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='160' viewBox='0 0 200 160'>
      <polygon points='100,6 156,150 44,150' fill='#e14b8a'/>
      <circle cx='100' cy='10' r='11' fill='#ffd93d'/>
      <circle cx='82' cy='66' r='8' fill='#ffffff'/>
      <circle cx='120' cy='96' r='8' fill='#ffd93d'/>
      <circle cx='92' cy='126' r='7' fill='#6bc3ff'/>
    </svg>`,
  },
  mustache: {
    aspect: 90 / 200,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='90' viewBox='0 0 200 90'>
      <path d='M100 32 C88 20 70 18 48 28 C30 36 14 54 22 68 C30 60 40 54 54 54 C74 54 90 46 100 36 C110 46 126 54 146 54 C160 54 170 60 178 68 C186 54 170 36 152 28 C130 18 112 20 100 32 Z' fill='#241c16'/>
    </svg>`,
  },
  glasses: {
    aspect: 74 / 200,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='74' viewBox='0 0 200 74'>
      <rect x='95' y='18' width='10' height='9' rx='3' fill='#111111'/>
      <path d='M10 18 H92 V40 Q92 60 58 60 Q18 60 12 34 Z' fill='#141414'/>
      <path d='M190 18 H108 V40 Q108 60 142 60 Q182 60 188 34 Z' fill='#141414'/>
    </svg>`,
  },
};

export const PROP_SRC: Record<PropId, string> = Object.fromEntries(
  Object.entries(SVGS).map(([k, v]) => [k, `data:image/svg+xml,${encodeURIComponent(v.svg.trim())}`])
) as Record<PropId, string>;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a prop sits relative to a face box (same coordinate units as the box). */
export function propRect(prop: PropId, b: Box): Box {
  const cx = b.x + b.width / 2;
  const asp = SVGS[prop].aspect;
  switch (prop) {
    case "cowboy": {
      const width = b.width * 1.7;
      const height = width * asp;
      return { x: cx - width / 2, y: b.y - height * 0.66, width, height };
    }
    case "party": {
      const width = b.width * 1.15;
      const height = width * asp;
      return { x: cx - width / 2, y: b.y - height * 0.74, width, height };
    }
    case "mustache": {
      const width = b.width * 0.62;
      const height = width * asp;
      return { x: cx - width / 2, y: b.y + b.height * 0.6, width, height };
    }
    case "glasses": {
      const width = b.width * 0.96;
      const height = width * asp;
      return { x: cx - width / 2, y: b.y + b.height * 0.3, width, height };
    }
  }
}

export const PROP_SETS: { key: string; label: string; props: PropId[] }[] = [
  { key: "none", label: "No filter", props: [] },
  { key: "cowboy", label: "🤠 Howdy", props: ["cowboy", "mustache"] },
  { key: "disguise", label: "🥸 Disguise", props: ["glasses", "mustache"] },
  { key: "party", label: "🎉 Party", props: ["party", "glasses"] },
];

/** Map a face box from source-media coords into an object-cover display box,
 *  accounting for the mirrored selfie preview. */
export function mapToDisplay(
  b: Box,
  stageW: number,
  stageH: number,
  mediaW: number,
  mediaH: number,
  mirror: boolean
): Box {
  const s = Math.max(stageW / mediaW, stageH / mediaH);
  const offX = (stageW - mediaW * s) / 2;
  const offY = (stageH - mediaH * s) / 2;
  const width = b.width * s;
  const height = b.height * s;
  const y = offY + b.y * s;
  let x = offX + b.x * s;
  if (mirror) x = stageW - (x + width);
  return { x, y, width, height };
}
