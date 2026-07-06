import { buildD003Geometry } from "./geometry";
import { D003_DEFAULTS } from "./types";

export function buildD003Reference(params = D003_DEFAULTS) {
  return buildD003Geometry(params);
}
