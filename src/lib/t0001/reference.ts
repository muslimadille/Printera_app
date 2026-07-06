import type { T0001Params, T0001Geometry } from "./types";
import { T0001_REFERENCE } from "./types";
import { buildT0001Geometry } from "./geometry";

export function buildT0001Reference(params: T0001Params): T0001Geometry {
  return buildT0001Geometry({
    ...T0001_REFERENCE,
    sheetWidth: params.sheetWidth,
    sheetHeight: params.sheetHeight,
    sheetMargin: params.sheetMargin,
    gripper: params.gripper,
  });
}
