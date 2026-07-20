// Source model: Fable 5
// 纯函数物理层：蓄力计算、跳跃速度、AABB 碰撞求解。不依赖 DOM，便于单元测试。

export interface Vec2 {
  x: number;
  y: number;
}

export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 参与碰撞的矩形；oneway 为单向平台（只能从上方落上去） */
export interface Collider extends AABB {
  id?: number;
  oneway?: boolean;
}

export const PHYS = {
  gravity: 1900, // px/s^2
  maxFall: 980,
  walkSpeed: 205,
  groundAccel: 3200,
  iceAccel: 330, // 冰面加速度低 → 打滑
  airAccel: 340,
  airBudget: 150, // 每次跳跃空中修正的总速度预算 (px/s)
  wallBounce: 0.42, // 撞墙反弹系数
  chargeTime: 0.95, // 蓄满所需秒数
  minChargeRatio: 0.18, // 轻点空格也有最低蓄力
  jumpVyMin: 430,
  jumpVyMax: 950,
  jumpVxMin: 60,
  jumpVxMax: 330,
  springVy: 960,
  windMaxVx: 430,
} as const;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function approach(cur: number, target: number, delta: number): number {
  if (cur < target) return Math.min(target, cur + delta);
  return Math.max(target, cur - delta);
}

/** 累积蓄力时间，封顶于 chargeTime */
export function accumulateCharge(charge: number, dt: number): number {
  return Math.min(PHYS.chargeTime, charge + Math.max(0, dt));
}

/** 蓄力比例 [minChargeRatio, 1]；charge<=0 时为 0 */
export function chargeRatio(charge: number): number {
  if (charge <= 0) return 0;
  return clamp(charge / PHYS.chargeTime, PHYS.minChargeRatio, 1);
}

/** 由蓄力比例与方向得到起跳速度。dir=0 为原地垂直跳 */
export function jumpVelocity(ratio: number, dir: -1 | 0 | 1): Vec2 {
  const r = clamp(ratio, 0, 1);
  return {
    x: dir * (PHYS.jumpVxMin + (PHYS.jumpVxMax - PHYS.jumpVxMin) * r),
    y: -(PHYS.jumpVyMin + (PHYS.jumpVyMax - PHYS.jumpVyMin) * r),
  };
}

export function overlaps(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export interface MoveResult {
  x: number;
  y: number;
  onGround: boolean;
  hitWall: boolean;
  hitCeiling: boolean;
  /** 撞墙方向：1=右侧墙, -1=左侧墙, 0=无 */
  wallDir: -1 | 0 | 1;
  /** 落在哪个平台上（collider.id） */
  groundId: number | null;
}

/**
 * 分轴移动 + 碰撞求解。
 * 先沿 X 移动并对实心体夹紧，再沿 Y 移动处理落地/顶头；
 * 单向平台仅当下落且前一帧底边不低于平台顶面时生效。
 */
export function moveAndCollide(
  box: AABB,
  vx: number,
  vy: number,
  dt: number,
  colliders: readonly Collider[]
): MoveResult {
  let x = box.x;
  let y = box.y;
  const { w, h } = box;
  let hitWall = false;
  let hitCeiling = false;
  let onGround = false;
  let wallDir: -1 | 0 | 1 = 0;
  let groundId: number | null = null;

  // X 轴
  x += vx * dt;
  for (const c of colliders) {
    if (c.oneway) continue;
    if (x < c.x + c.w && x + w > c.x && y < c.y + c.h && y + h > c.y) {
      if (vx > 0) {
        x = c.x - w;
        wallDir = 1;
        hitWall = true;
      } else if (vx < 0) {
        x = c.x + c.w;
        wallDir = -1;
        hitWall = true;
      }
    }
  }

  // Y 轴
  const prevBottom = y + h;
  y += vy * dt;
  for (const c of colliders) {
    if (!(x < c.x + c.w && x + w > c.x && y < c.y + c.h && y + h > c.y)) continue;
    if (c.oneway) {
      if (vy > 0 && prevBottom <= c.y + 0.6) {
        y = c.y - h;
        onGround = true;
        groundId = c.id ?? null;
      }
      continue;
    }
    if (vy > 0) {
      y = c.y - h;
      onGround = true;
      groundId = c.id ?? null;
    } else if (vy < 0) {
      y = c.y + c.h;
      hitCeiling = true;
    }
  }

  return { x, y, onGround, hitWall, hitCeiling, wallDir, groundId };
}
