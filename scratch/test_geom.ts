import { buildT0012Geometry } from '../src/lib/t0012/geometry';
import { T0012_DEFAULTS } from '../src/lib/t0012/types';

const geo = buildT0012Geometry(T0012_DEFAULTS);
console.log("Segments:", geo.segments.length);
for (const s of geo.segments) {
    if (s.geometry === "arc" && !s.arc) {
        console.log("BAD ARC:", s);
    }
    if (isNaN(s.start.x) || isNaN(s.start.y) || isNaN(s.end.x) || isNaN(s.end.y)) {
        console.log("NAN IN SEGMENT:", s);
    }
}
