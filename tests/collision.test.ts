// Source model: Fable 5
// AABB 碰撞求解的测试：落地、撞墙、顶头、单向平台。

import { describe, it, expect } from 'vitest';
import { moveAndCollide, type Collider } from '../src/engine/physics';

const ground: Collider = { id: 1, x: 0, y: 100, w: 200, h: 24 };
const wall: Collider = { id: 2, x: 300, y: 0, w: 40, h: 400 };
const oneway: Collider = { id: 3, x: 0, y: 100, w: 200, h: 24, oneway: true };

describe('碰撞求解 moveAndCollide', () => {
  it('下落时落在平台顶面并贴合', () => {
    const res = moveAndCollide({ x: 50, y: 60, w: 26, h: 34 }, 0, 300, 0.1, [ground]);
    expect(res.onGround).toBe(true);
    expect(res.y).toBe(100 - 34);
    expect(res.groundId).toBe(1);
  });

  it('向右撞墙会被夹在墙左侧并报告撞墙方向', () => {
    const res = moveAndCollide({ x: 260, y: 50, w: 26, h: 34 }, 500, 0, 0.1, [wall]);
    expect(res.hitWall).toBe(true);
    expect(res.wallDir).toBe(1);
    expect(res.x).toBe(300 - 26);
  });

  it('向左撞墙报告 wallDir=-1', () => {
    const res = moveAndCollide({ x: 360, y: 50, w: 26, h: 34 }, -500, 0, 0.1, [wall]);
    expect(res.hitWall).toBe(true);
    expect(res.wallDir).toBe(-1);
    expect(res.x).toBe(340);
  });

  it('上跳顶到平台底部会停住并报告 hitCeiling', () => {
    const res = moveAndCollide({ x: 50, y: 140, w: 26, h: 34 }, 0, -600, 0.1, [ground]);
    expect(res.hitCeiling).toBe(true);
    expect(res.y).toBe(124);
    expect(res.onGround).toBe(false);
  });

  it('单向平台：从下方上升可穿过', () => {
    const res = moveAndCollide({ x: 50, y: 140, w: 26, h: 34 }, 0, -600, 0.1, [oneway]);
    expect(res.hitCeiling).toBe(false);
    expect(res.y).toBeCloseTo(140 - 60);
  });

  it('单向平台：从上方下落会落住', () => {
    const res = moveAndCollide({ x: 50, y: 40, w: 26, h: 34 }, 0, 400, 0.1, [oneway]);
    expect(res.onGround).toBe(true);
    expect(res.y).toBe(66);
  });

  it('单向平台：身体已在平台内部时下落不会被钩住', () => {
    const res = moveAndCollide({ x: 50, y: 90, w: 26, h: 34 }, 0, 200, 0.05, [oneway]);
    expect(res.onGround).toBe(false);
  });

  it('无碰撞时自由移动', () => {
    const res = moveAndCollide({ x: 10, y: 10, w: 26, h: 34 }, 100, 50, 0.1, [ground, wall]);
    expect(res.x).toBeCloseTo(20);
    expect(res.y).toBeCloseTo(15);
    expect(res.onGround).toBe(false);
    expect(res.hitWall).toBe(false);
  });

  it('站立状态下每帧轻微下压仍保持贴地（连续 onGround）', () => {
    let box = { x: 50, y: 66, w: 26, h: 34 };
    for (let i = 0; i < 5; i++) {
      const res = moveAndCollide(box, 0, 15, 1 / 120, [ground]);
      expect(res.onGround).toBe(true);
      box = { ...box, x: res.x, y: res.y };
    }
    expect(box.y).toBe(66);
  });
});
