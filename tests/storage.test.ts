// Source model: Fable 5
// 最佳成绩 localStorage 持久化逻辑的测试（注入内存存储）。

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadBest,
  saveBestIfBetter,
  isBetter,
  BEST_KEY,
  type BestRecord,
  type StorageLike,
} from '../src/game/storage';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

function rec(timeMs: number, extra: Partial<BestRecord> = {}): BestRecord {
  return { timeMs, falls: 3, collected: 8, maxHeight: 340, date: '2026-07-21', ...extra };
}

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage();
});

describe('最佳成绩保存', () => {
  it('无历史记录时读取为 null', () => {
    expect(loadBest(storage)).toBeNull();
  });

  it('首次通关即保存为最佳', () => {
    const { improved, best } = saveBestIfBetter(storage, rec(120_000));
    expect(improved).toBe(true);
    expect(best.timeMs).toBe(120_000);
    expect(loadBest(storage)?.timeMs).toBe(120_000);
  });

  it('更快用时会覆盖旧纪录', () => {
    saveBestIfBetter(storage, rec(120_000));
    const { improved } = saveBestIfBetter(storage, rec(90_000, { falls: 1 }));
    expect(improved).toBe(true);
    expect(loadBest(storage)?.timeMs).toBe(90_000);
    expect(loadBest(storage)?.falls).toBe(1);
  });

  it('更慢用时不会覆盖旧纪录', () => {
    saveBestIfBetter(storage, rec(90_000));
    const { improved, best } = saveBestIfBetter(storage, rec(150_000));
    expect(improved).toBe(false);
    expect(best.timeMs).toBe(90_000);
    expect(loadBest(storage)?.timeMs).toBe(90_000);
  });

  it('损坏的 JSON 被视为无记录（可自动恢复）', () => {
    storage.map.set(BEST_KEY, '{oops not json');
    expect(loadBest(storage)).toBeNull();
    const { improved } = saveBestIfBetter(storage, rec(100_000));
    expect(improved).toBe(true);
    expect(loadBest(storage)?.timeMs).toBe(100_000);
  });

  it('字段缺失或非法时读取为 null', () => {
    storage.map.set(BEST_KEY, JSON.stringify({ falls: 2 }));
    expect(loadBest(storage)).toBeNull();
    storage.map.set(BEST_KEY, JSON.stringify({ timeMs: 'fast' }));
    expect(loadBest(storage)).toBeNull();
  });

  it('isBetter 比较规则：时间短者胜', () => {
    expect(isBetter(rec(80_000), rec(90_000))).toBe(true);
    expect(isBetter(rec(95_000), rec(90_000))).toBe(false);
    expect(isBetter(rec(80_000), null)).toBe(true);
  });
});
