/**
 * Lid Tuck Box v1 — Source template (200 × 50 × 200).
 *
 * Verbatim copy of docs/templates/_analysis/lid-tuck-box-v1/refs/200x200x50.svg
 * used as the geometric source-of-truth for the parametric remap engine. All
 * curves (handle notch, side-flap rounded "ears", closing-tab diagonals) come
 * from this file; the engine only relocates each coordinate by anchor + delta.
 *
 * Do not edit. To regenerate, replace with the latest verified reference SVG
 * and re-run the parametric remap test suite.
 */
export const LID_TUCK_BOX_SOURCE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="29.95cm" height="60.11cm" viewBox="0 0 848.97645 1703.9056">
  <g id="CREASE">
    <line id="CREASE_Y_FRONT_INNER_FLAP_TO_FRONT_DEPTH" x1="707.24417" y1="146.69291" x2="141.7323" y2="146.69291" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_FRONT_DEPTH_TO_RIGHT_SIDE_FLAP" x1="708.66147" y1="292.67729" x2="594.56698" y2="292.67729" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_FRONT_DEPTH_TO_CENTER_SLOT_AREA" x1="481.18118" y1="292.67729" x2="367.79532" y2="292.67729" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_FRONT_DEPTH_TO_LEFT_SIDE_FLAP" x1="254.40948" y1="292.67729" x2="140.31497" y2="292.67729" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_X_BASE_TO_RIGHT_DEPTH" x1="707.95279" y1="294.09453" x2="707.95279" y2="858.18907" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_X_LEFT_DEPTH_TO_BASE" x1="708.66147" y1="859.60631" x2="140.31497" y2="859.60631" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_BASE_TO_BACK_DEPTH" x1="141.02363" y1="858.18907" x2="141.02363" y2="294.09453" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_BACK_DEPTH_TO_LID" x1="708.66147" y1="1001.33867" x2="140.31497" y2="1001.33867" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_X_LID_TO_RIGHT_LID_FLAP" x1="706.53555" y1="1002.75596" x2="706.53555" y2="1562.882" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_LID_TO_FRONT_TUCK_FLAP_RIGHT_SECTION" x1="706.53555" y1="1562.882" x2="445.74807" y2="1562.882" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_LID_TO_FRONT_TUCK_FLAP_LEFT_SECTION" x1="403.22836" y1="1562.882" x2="142.44096" y2="1562.882" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_X_LEFT_LID_FLAP_TO_LID" x1="142.44096" y1="1562.882" x2="142.44096" y2="1002.75596" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_LEFT_FRONT_DEPTH_FLAP_TO_LEFT_DEPTH" x1=".70866" y1="294.09453" x2="141.02363" y2="294.09453" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_LEFT_BACK_DEPTH_FLAP_TO_LEFT_DEPTH" x1="141.02363" y1="858.18907" x2=".70866" y2="858.18907" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_RIGHT_BACK_DEPTH_FLAP_TO_RIGHT_DEPTH" x1="848.26773" y1="858.18907" x2="707.95279" y2="858.18907" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_RIGHT_FRONT_DEPTH_FLAP_TO_RIGHT_DEPTH" x1="707.95279" y1="294.09453" x2="848.26773" y2="294.09453" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
    <line id="CREASE_Y_FRONT_DEPTH_TO_FRONT_INNER_FLAP" x1="708.66147" y1="150.94487" x2="140.31497" y2="150.94487" fill="none" stroke="#2e3192" stroke-width="1.41732"/>
  </g>
  <g id="CUT">
    <polyline id="CUT_TOP_LOCK_SLOT_LEFT" points="254.40948 292.67717 255.82681 294.09453 366.37802 294.09453 367.79532 292.67717" fill="none" stroke="#ed1c24" stroke-width="1.41732"/>
    <polyline id="CUT_TOP_LOCK_SLOT_RIGHT" points="481.18117 292.67717 482.59849 294.09453 593.1497 294.09453 594.567 292.67717" fill="none" stroke="#ed1c24" stroke-width="1.41732"/>
    <path id="CUT_LID_FRONT_TUCK_NOTCH_CURVE" d="M403.22842,1562.882c0,7.59546,4.05206,14.61389,10.62988,18.41174,6.57782,3.79761,14.68201,3.79761,21.25983,0,6.57788-3.79785,10.62994-10.81628,10.62994-18.41174" fill="none" stroke="#ed1c24" stroke-width="1.41732"/>
    <polyline id="CUT_RIGHT_BACK_DEPTH_SIDE_FLAP_EDGE" points="707.95285 858.18907 708.66147 859.60637 708.66147 1001.33867" fill="none" stroke="#ed1c24" stroke-width="1.41732"/>
    <polyline id="CUT_LEFT_BACK_DEPTH_SIDE_FLAP_EDGE" points="141.02363 858.18907 140.31497 859.60637 140.31497 1001.33867" fill="none" stroke="#ed1c24" stroke-width="1.41732"/>
    <polyline id="CUT_RIGHT_FRONT_DEPTH_SIDE_FLAP_EDGE" points="707.95285 294.09453 708.66147 292.67717 708.66147 150.94487" fill="none" stroke="#ed1c24" stroke-width="1.41732"/>
    <polyline id="CUT_LEFT_FRONT_DEPTH_SIDE_FLAP_EDGE" points="141.02363 294.09453 140.31497 292.67717 140.31497 150.94487" fill="none" stroke="#ed1c24" stroke-width="1.41732"/>
    <path id="CUT_OUTER_CONTOUR" d="M141.7323,146.69291V7.08659h114.09451l1.4173-6.37793h107.71655l1.41736,6.37793h116.22046l1.4173-6.37793h107.71655l1.41736,6.37793h114.09448v139.60632l1.4173,4.25195,14.17322-83.62207h125.43311v934.01587h-139.60632l-2.12598,1.41736,112.33789,40.8877c8.19965,2.98438,15.28253,8.41931,20.28754,15.56702,5.00488,7.14795,7.68958,15.66248,7.68958,24.38843v398.43994c0,8.72571-2.68469,17.24036-7.68958,24.38818-5.005,7.14783-12.08789,12.58276-20.28754,15.56702l-112.33789,40.8877-40.88763,112.33789c-2.98444,8.19958-8.41937,15.28259-15.56714,20.28748-7.14783,5.005-15.66241,7.68958-24.38831,7.68958H223.28402c-8.72586,0-17.24048-2.68457-24.38828-7.68958-7.1478-5.00488-12.58273-12.08789-15.56717-20.28748l-40.88762-112.33789-112.33788-40.8877c-8.19965-2.98425-15.28255-8.41919-20.28751-15.56702-5.00495-7.14783-7.6896-15.66248-7.6896-24.38818v-398.43994c0-8.72595,2.68465-17.24048,7.6896-24.38843,5.00496-7.14771,12.08786-12.58264,20.28751-15.56702l112.33788-40.8877-2.12599-1.41736H.70866V67.3228h125.43309l14.17322,83.62207,1.41733-4.25195Z" fill="none" stroke="#ed1c24" stroke-width="1.41732"/>
  </g>
</svg>`;

/** Source dimensions (mm). */
export const LID_TUCK_BOX_SOURCE_DIMS = { L: 200, D: 50, H: 200 } as const;

/** Millimetre → SVG-pt scale (1mm = 2.83465pt, standard CSS units). */
export const MM_TO_PT = 2.83465;
