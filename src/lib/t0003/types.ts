import type { Segment } from '@/components/InteractiveSvgCanvas';
import type { Panel2DInfo } from '@/components/boxes/MailerBox3DPreview';

export interface T0003Params {
  width: number;
  height: number;
  depth: number;
  referenceMode?: boolean;

  sheetWidth: number;
  sheetHeight: number;
  gripper: number;
  sheetMargin: number;

  paperThickness?: number;
}

export const T0003_REFERENCE: Required<Omit<T0003Params, 'referenceMode' | 'sheetWidth' | 'sheetHeight' | 'gripper' | 'sheetMargin' | 'paperThickness'>> = {
  width: 708.67, // Using W from SVG
  height: 141.73, // Using H from SVG
  depth: 538.59, // Using L from SVG
};

export const T0003_DEFAULTS: T0003Params = {
  width: 708.67,
  height: 141.73,
  depth: 538.59,
  referenceMode: false,
  sheetWidth: 1000,
  sheetHeight: 700,
  gripper: 12,
  sheetMargin: 5,
};

export interface T0003FaceCoords {
  bottom: Panel2DInfo;
  back: Panel2DInfo;
  front: Panel2DInfo;
  lid: Panel2DInfo;
  lidTuck: Panel2DInfo;
  leftWallOuter: Panel2DInfo;
  leftWallInner: Panel2DInfo;
  rightWallOuter: Panel2DInfo;
  rightWallInner: Panel2DInfo;
  frontDustLeft: Panel2DInfo;
  frontDustRight: Panel2DInfo;
  backDustLeft: Panel2DInfo;
  backDustRight: Panel2DInfo;
}

export interface T0003Geometry {
  svg: string;
  segments: Segment[];
  bbox: { w: number; h: number };
  faceCoords: T0003FaceCoords;
  derived: {
    width: number;
    height: number;
  };
}

export const usableSheet = (p: T0003Params) => ({
  width: p.sheetWidth - p.sheetMargin * 2,
  height: p.sheetHeight - p.sheetMargin * 2 - p.gripper,
});
