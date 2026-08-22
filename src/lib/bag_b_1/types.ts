export interface Bag_B_1Dimensions {
  width: number;
  height: number;
  depth: number;
  topHem: number;
  bottomFlap: number;
  glueFlap: number;
}

export const MIN_BAG_DEPTH = 25;

export function getBottomFlapBounds(depth: number) {
  const d = Math.max(MIN_BAG_DEPTH, depth);
  const min = d / 2 + 10;
  const max = Math.max(min, d - 3);
  const def = Math.max(min, Math.min(max, d / 2 + 20));
  return { min, max, default: def };
}

export function clampBottomFlap(depth: number, flap: number) {
  const { min, max } = getBottomFlapBounds(depth);
  return Math.max(min, Math.min(max, flap));
}

export const BAG_B_1_REFERENCE = {
  width: 537.2,
  height: 652.3,
  depth: 230.2,
  topHem: 76.7,
  bottomFlap: 135.1, // D / 2 + 20 (230.2 / 2 + 20)
  glueFlap: 38.4,
} as const;

export const BAG_B_1_DEFAULTS: Bag_B_1Dimensions = {
  width: BAG_B_1_REFERENCE.width,
  height: BAG_B_1_REFERENCE.height,
  depth: BAG_B_1_REFERENCE.depth,
  topHem: BAG_B_1_REFERENCE.topHem,
  bottomFlap: BAG_B_1_REFERENCE.bottomFlap,
  glueFlap: BAG_B_1_REFERENCE.glueFlap,
};

