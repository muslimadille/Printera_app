import type { T0002Params, T0002Geometry } from "./types";
import { T0002_REFERENCE } from "./types";
import { buildT0002Geometry } from "./geometry";

export function buildT0002Reference(params: T0002Params): T0002Geometry {
  return buildT0002Geometry({
    ...T0002_REFERENCE,
    sheetWidth: params.sheetWidth,
    sheetHeight: params.sheetHeight,
    sheetMargin: params.sheetMargin,
    gripper: params.gripper,
  });
}
