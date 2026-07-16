// Silly photo-booth face props (cowboy hat, mustache, sunglasses, party hat),
// drawn as self-contained SVGs so nothing loads off-network. Props are anchored
// to MediaPipe face keypoints (eyes / nose / mouth) and rotated to head tilt, so
// they sit ON the features instead of covering the whole face box.

export type PropId = "cowboy" | "party" | "mustache" | "glasses";

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

export interface Pt {
  x: number;
  y: number;
}

/** A detected face in source-media pixels: bounding box + the four keypoints
 *  we use (two eyes, nose tip, mouth center). */
export interface Face {
  x: number;
  y: number;
  width: number;
  height: number;
  eyeR: Pt;
  eyeL: Pt;
  nose: Pt;
  mouth: Pt;
}

/** A placed prop: center, size, rotation — all in the same units as the face. */
export interface Placement {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number; // radians
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Where a prop sits for a given face (source-media coordinate units). */
export function propPlacement(prop: PropId, f: Face): Placement {
  const eyeC = mid(f.eyeR, f.eyeL);
  const dx = f.eyeL.x - f.eyeR.x;
  const dy = f.eyeL.y - f.eyeR.y;
  const eyeDist = Math.hypot(dx, dy) || f.width * 0.42;
  const angle = Math.atan2(dy, dx);
  const asp = SVGS[prop].aspect;
  // Unit vector pointing "up" out of the top of the head (perpendicular to eyes).
  const up = { x: Math.sin(angle), y: -Math.cos(angle) };

  switch (prop) {
    case "glasses": {
      const w = eyeDist * 2.2;
      return { cx: eyeC.x, cy: eyeC.y, w, h: w * asp, angle };
    }
    case "mustache": {
      const w = eyeDist * 1.5;
      // Just under the nose, above the mouth.
      const cx = (f.nose.x + f.mouth.x) / 2;
      const cy = f.nose.y * 0.55 + f.mouth.y * 0.45;
      return { cx, cy, w, h: w * asp, angle };
    }
    case "cowboy": {
      const w = eyeDist * 3.1;
      const h = w * asp;
      // Rest the brim just above the brow: from the eyes, up ~1 eye-distance,
      // then up by half the hat height.
      const lift = eyeDist * 1.05 + h * 0.42;
      return { cx: eyeC.x + up.x * lift, cy: eyeC.y + up.y * lift, w, h, angle };
    }
    case "party": {
      const w = eyeDist * 2.1;
      const h = w * asp;
      const lift = eyeDist * 1.15 + h * 0.42;
      return { cx: eyeC.x + up.x * lift, cy: eyeC.y + up.y * lift, w, h, angle };
    }
  }
}

/** Map a placement from source-media coords into the object-cover display box,
 *  honoring the mirrored selfie preview. */
export function placementToDisplay(
  p: Placement,
  stageW: number,
  stageH: number,
  mediaW: number,
  mediaH: number,
  mirror: boolean
): Placement {
  const s = Math.max(stageW / mediaW, stageH / mediaH);
  const offX = (stageW - mediaW * s) / 2;
  const offY = (stageH - mediaH * s) / 2;
  let cx = offX + p.cx * s;
  const cy = offY + p.cy * s;
  let angle = p.angle;
  if (mirror) {
    cx = stageW - cx;
    angle = -angle;
  }
  return { cx, cy, w: p.w * s, h: p.h * s, angle };
}

export const PROP_SETS: { key: string; label: string; props: PropId[] }[] = [
  { key: "none", label: "No effect", props: [] },
  { key: "howdy", label: "🤠 Howdy", props: ["cowboy", "mustache"] },
  { key: "disguise", label: "🥸 Disguise", props: ["glasses", "mustache"] },
  { key: "party", label: "🎉 Party", props: ["party", "glasses"] },
];
