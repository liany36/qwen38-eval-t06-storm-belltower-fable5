// Source model: Fable 5
// 蓄力与跳跃速度计算的测试。

import { describe, it, expect } from 'vitest';
import { accumulateCharge, chargeRatio, jumpVelocity, PHYS } from '../src/engine/physics';

describe('蓄力累积 accumulateCharge', () => {
  it('随时间增长', () => {
    expect(accumulateCharge(0, 0.3)).toBeCloseTo(0.3);
    expect(accumulateCharge(0.3, 0.2)).toBeCloseTo(0.5);
  });

  it('封顶于最大蓄力时间', () => {
    expect(accumulateCharge(0.9, 10)).toBe(PHYS.chargeTime);
    expect(accumulateCharge(PHYS.chargeTime, 0.5)).toBe(PHYS.chargeTime);
  });

  it('负 dt 不会让蓄力倒退', () => {
    expect(accumulateCharge(0.5, -1)).toBeCloseTo(0.5);
  });
});

describe('蓄力比例 chargeRatio', () => {
  it('未蓄力时为 0', () => {
    expect(chargeRatio(0)).toBe(0);
  });

  it('轻点也有最低比例（保证最小跳）', () => {
    expect(chargeRatio(0.01)).toBe(PHYS.minChargeRatio);
  });

  it('蓄满为 1，超出仍为 1', () => {
    expect(chargeRatio(PHYS.chargeTime)).toBe(1);
    expect(chargeRatio(PHYS.chargeTime * 2)).toBe(1);
  });

  it('中段线性增长', () => {
    expect(chargeRatio(PHYS.chargeTime * 0.5)).toBeCloseTo(0.5);
  });
});

describe('跳跃速度 jumpVelocity', () => {
  it('蓄力越大，垂直与水平速度越大', () => {
    const lo = jumpVelocity(0.2, 1);
    const hi = jumpVelocity(1, 1);
    expect(Math.abs(hi.y)).toBeGreaterThan(Math.abs(lo.y));
    expect(hi.x).toBeGreaterThan(lo.x);
  });

  it('垂直速度向上（负值），范围符合配置', () => {
    expect(jumpVelocity(0, 0).y).toBe(-PHYS.jumpVyMin);
    expect(jumpVelocity(1, 0).y).toBe(-PHYS.jumpVyMax);
  });

  it('方向决定水平速度符号；无方向则垂直起跳', () => {
    expect(jumpVelocity(0.8, 1).x).toBeGreaterThan(0);
    expect(jumpVelocity(0.8, -1).x).toBeLessThan(0);
    expect(jumpVelocity(0.8, 0).x).toBe(0);
  });

  it('比例越界会被夹紧', () => {
    expect(jumpVelocity(5, 1).y).toBe(-PHYS.jumpVyMax);
    expect(jumpVelocity(-3, 1).y).toBe(-PHYS.jumpVyMin);
  });
});
