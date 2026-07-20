// Source model: Fable 5
// 关卡数据：五段向上的区域、五类平台、风区、收集物、检查点与终点。

import type { AABB, Vec2 } from '../engine/physics';

export type PlatformType = 'normal' | 'oneway' | 'moving' | 'crumble' | 'spring';

export interface PlatformDef {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: PlatformType;
  /** 结冰地面：站上去会打滑 */
  ice?: boolean;
  /** 移动平台：水平往返（正弦） */
  move?: { dx: number; period: number; phase: number };
}

export interface CollectibleDef {
  id: number;
  x: number;
  y: number;
}

export interface CheckpointDef {
  id: number;
  x: number;
  y: number;
  name: string;
}

export interface WindZone {
  yTop: number;
  yBottom: number;
  strength: number;
}

export interface ZoneDef {
  name: string;
  yTop: number;
  yBottom: number;
}

export interface LevelData {
  width: number;
  height: number;
  spawn: Vec2;
  platforms: PlatformDef[];
  collectibles: CollectibleDef[];
  checkpoints: CheckpointDef[];
  finish: AABB;
  windZones: WindZone[];
  zones: ZoneDef[];
}

let nextId = 1;
function p(
  x: number,
  y: number,
  w: number,
  type: PlatformType = 'normal',
  extra: Partial<PlatformDef> = {}
): PlatformDef {
  return { id: nextId++, x, y, w, h: 24, type, ...extra };
}

export function createLevel(): LevelData {
  nextId = 1;
  const W = 960;
  const H = 3640;

  const platforms: PlatformDef[] = [
    // ---- 底层地面 ----
    { id: nextId++, x: 0, y: 3560, w: W, h: 80, type: 'normal' },

    // ---- 区域 1：坍塌基座 (y 2900~3560) ----
    p(120, 3420, 220),
    p(480, 3320, 220),
    p(760, 3200, 170, 'oneway'),
    p(420, 3080, 180),
    p(110, 2980, 200),
    p(620, 2900, 220),

    // ---- 区域 2：齿轮库 (y 2240~2900) ----
    p(430, 2770, 160, 'moving', { move: { dx: 190, period: 4.2, phase: 0 } }),
    p(120, 2660, 210), // CP1 所在
    p(520, 2560, 170, 'oneway'),
    p(820, 2440, 140),
    p(470, 2330, 150, 'moving', { move: { dx: 210, period: 5.0, phase: 1.8 } }),
    p(130, 2250, 170, 'oneway'),

    // ---- 区域 3：结冰钟廊 (y 1580~2240) ----
    p(420, 2140, 200, 'normal', { ice: true }),
    p(750, 2020, 180, 'normal', { ice: true }),
    p(360, 1900, 150, 'crumble'),
    p(70, 1790, 180, 'normal', { ice: true }),
    p(500, 1700, 150, 'spring'),
    p(780, 1560, 180, 'normal', { ice: true }), // CP2 所在

    // ---- 区域 4：风暴外壁 (y 920~1580) ----
    p(440, 1460, 160),
    p(140, 1350, 150, 'crumble'),
    p(650, 1260, 160, 'oneway'),
    p(340, 1150, 150, 'moving', { move: { dx: 165, period: 3.6, phase: 0.7 } }),
    p(810, 1050, 140, 'crumble'),
    p(500, 960, 180), // CP3 所在

    // ---- 区域 5：钟顶 (y 170~920) ----
    p(190, 860, 150, 'normal', { ice: true }),
    p(610, 780, 140, 'spring'),
    p(410, 600, 140, 'crumble'),
    p(130, 500, 150, 'oneway'),
    p(690, 440, 150, 'moving', { move: { dx: 150, period: 3.0, phase: 2.4 } }),
    p(380, 300, 250, 'normal', { h: 28 } as Partial<PlatformDef>),

    // ---- 侧墙 ----
    { id: nextId++, x: -70, y: -400, w: 70, h: H + 800, type: 'normal' },
    { id: nextId++, x: W, y: -400, w: 70, h: H + 800, type: 'normal' },
  ];

  const collectibles: CollectibleDef[] = [
    { id: 1, x: 585, y: 3270 },
    { id: 2, x: 845, y: 3150 },
    { id: 3, x: 600, y: 2510 },
    { id: 4, x: 210, y: 2200 },
    { id: 5, x: 515, y: 2090 },
    { id: 6, x: 155, y: 1740 },
    { id: 7, x: 575, y: 1630 },
    { id: 8, x: 210, y: 1300 },
    { id: 9, x: 875, y: 1000 },
    { id: 10, x: 200, y: 450 },
  ];

  const checkpoints: CheckpointDef[] = [
    { id: 1, x: 225, y: 2660, name: '齿轮库' },
    { id: 2, x: 870, y: 1560, name: '结冰钟廊' },
    { id: 3, x: 590, y: 960, name: '风暴外壁' },
  ];

  return {
    width: W,
    height: H,
    spawn: { x: 467, y: 3524 },
    platforms,
    collectibles,
    checkpoints,
    finish: { x: 420, y: 168, w: 170, h: 132 },
    windZones: [
      { yTop: 100, yBottom: 1580, strength: 130 },
      { yTop: 1580, yBottom: 2240, strength: 60 },
    ],
    zones: [
      { name: '坍塌基座', yTop: 2900, yBottom: 3640 },
      { name: '齿轮库', yTop: 2240, yBottom: 2900 },
      { name: '结冰钟廊', yTop: 1580, yBottom: 2240 },
      { name: '风暴外壁', yTop: 920, yBottom: 1580 },
      { name: '钟顶', yTop: 0, yBottom: 920 },
    ],
  };
}

/** 当前时刻移动平台的 X 坐标 */
export function movingPlatformX(def: PlatformDef, t: number): number {
  if (!def.move) return def.x;
  return def.x + def.move.dx * Math.sin((Math.PI * 2 * t) / def.move.period + def.move.phase);
}

/** 某高度处的横风基础强度（0 表示无风区） */
export function windStrengthAt(level: LevelData, y: number): number {
  for (const z of level.windZones) {
    if (y >= z.yTop && y < z.yBottom) return z.strength;
  }
  return 0;
}

export function zoneNameAt(level: LevelData, y: number): string {
  for (const z of level.zones) {
    if (y >= z.yTop && y < z.yBottom) return z.name;
  }
  return '钟顶';
}
