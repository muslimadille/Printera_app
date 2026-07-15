import type { Segment } from '@/components/InteractiveSvgCanvas';
import type { Panel2DInfo } from '@/components/boxes/MailerBox3DPreview';

export interface T00012Params {
  width: number;
  height: number;
  depth: number;
  referenceMode?: boolean;

  dustFlapLength?: number;
  topFlapTuckLength?: number;
  sideFlapsLength?: number;

  sheetWidth: number;
  sheetHeight: number;
  gripper: number;
  sheetMargin: number;

  paperThickness?: number;
}

export const T00012_REFERENCE: Required<Omit<T00012Params, 'referenceMode' | 'sheetWidth' | 'sheetHeight' | 'gripper' | 'sheetMargin' | 'paperThickness'>> = {
  width: 250, 
  height: 190, 
  depth: 50, 
  dustFlapLength: 50,
  topFlapTuckLength: 20,
  sideFlapsLength: 15.5,
};

export const T00012_DEFAULTS: T00012Params = {
  width: 250,
  height: 190,
  depth: 50,
  dustFlapLength: 50,
  topFlapTuckLength: 20,
  sideFlapsLength: 15.5,
  referenceMode: false,
  sheetWidth: 1000,
  sheetHeight: 700,
  gripper: 12,
  sheetMargin: 5,
};

export interface T00012FaceCoords {
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

export interface T00012Geometry {
  svg: string;
  segments: Segment[];
  bbox: { w: number; h: number };
  faceCoords: T00012FaceCoords;
  derived: {
    width: number;
    height: number;
  };
}

export const usableSheet = (p: T00012Params) => ({
  width: p.sheetWidth - p.sheetMargin * 2,
  height: p.sheetHeight - p.sheetMargin * 2 - p.gripper,
});
