// Source model: Fable 5
// 检查点激活、重生点选择、坠落统计与收集去重的测试。

import { describe, it, expect, beforeEach } from 'vitest';
import { RunSession } from '../src/game/session';
import { createLevel, type LevelData } from '../src/game/level';

let level: LevelData;
let session: RunSession;

beforeEach(() => {
  level = createLevel();
  session = new RunSession(level);
});

describe('检查点', () => {
  it('初始重生点为出生点', () => {
    expect(session.respawnPoint()).toEqual(level.spawn);
  });

  it('远离检查点时不会激活', () => {
    const cp = level.checkpoints[0];
    expect(session.tryActivateCheckpoint(cp.x + 300, cp.y)).toBeNull();
    expect(session.activatedCheckpoints.size).toBe(0);
  });

  it('靠近检查点即激活，且重生点更新到检查点上方', () => {
    const cp = level.checkpoints[0];
    const id = session.tryActivateCheckpoint(cp.x + 10, cp.y - 20);
    expect(id).toBe(cp.id);
    const rp = session.respawnPoint();
    expect(rp.y).toBeLessThan(cp.y);
    expect(Math.abs(rp.x - cp.x)).toBeLessThan(40);
  });

  it('同一检查点不会重复激活', () => {
    const cp = level.checkpoints[0];
    expect(session.tryActivateCheckpoint(cp.x, cp.y)).toBe(cp.id);
    expect(session.tryActivateCheckpoint(cp.x, cp.y)).toBeNull();
    expect(session.activatedCheckpoints.size).toBe(1);
  });

  it('激活更高的检查点后，重生点跟随最新检查点', () => {
    const cp1 = level.checkpoints[0];
    const cp2 = level.checkpoints[1];
    session.tryActivateCheckpoint(cp1.x, cp1.y);
    session.tryActivateCheckpoint(cp2.x, cp2.y);
    const rp = session.respawnPoint();
    expect(Math.abs(rp.x - cp2.x)).toBeLessThan(40);
    expect(rp.y).toBeCloseTo(cp2.y - 40);
  });

  it('坠落惩罚会累计到统计中', () => {
    session.registerFall();
    session.registerFall();
    expect(session.stats.falls).toBe(2);
  });
});

describe('收集物', () => {
  it('靠近即收集，且不会重复计数', () => {
    const c = level.collectibles[0];
    expect(session.tryCollect(c.x + 5, c.y - 5)).toBe(c.id);
    expect(session.tryCollect(c.x, c.y)).toBeNull();
    expect(session.stats.collected).toBe(1);
  });

  it('关卡至少有 8 个收集物、2 个检查点、5 个区域', () => {
    expect(level.collectibles.length).toBeGreaterThanOrEqual(8);
    expect(level.checkpoints.length).toBeGreaterThanOrEqual(2);
    expect(level.zones.length).toBeGreaterThanOrEqual(5);
  });
});

describe('高度统计', () => {
  it('向上攀登刷新最高高度，向下不回退', () => {
    const startBottom = level.spawn.y + 34;
    session.updateHeight(startBottom - 500); // 爬升 50m
    expect(session.stats.maxHeight).toBeCloseTo(50);
    session.updateHeight(startBottom - 100); // 掉回 10m
    expect(session.stats.maxHeight).toBeCloseTo(50);
  });
});
