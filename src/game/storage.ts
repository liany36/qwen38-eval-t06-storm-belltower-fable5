// Source model: Fable 5
// 最佳成绩持久化。抽象 StorageLike 以便在测试中注入内存实现。

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BestRecord {
  timeMs: number;
  falls: number;
  collected: number;
  maxHeight: number;
  date: string;
}

export const BEST_KEY = 'storm-clocktower/best';
export const TIPS_KEY = 'storm-clocktower/tips-seen';

export function loadBest(storage: StorageLike): BestRecord | null {
  try {
    const raw = storage.getItem(BEST_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Partial<BestRecord>;
    if (typeof obj.timeMs !== 'number' || !isFinite(obj.timeMs)) return null;
    return {
      timeMs: obj.timeMs,
      falls: typeof obj.falls === 'number' ? obj.falls : 0,
      collected: typeof obj.collected === 'number' ? obj.collected : 0,
      maxHeight: typeof obj.maxHeight === 'number' ? obj.maxHeight : 0,
      date: typeof obj.date === 'string' ? obj.date : '',
    };
  } catch {
    return null;
  }
}

/** 通关用时更短即为更好成绩 */
export function isBetter(candidate: BestRecord, current: BestRecord | null): boolean {
  if (!current) return true;
  return candidate.timeMs < current.timeMs;
}

/** 若成绩更好则保存；返回保存后的最佳成绩与是否刷新纪录 */
export function saveBestIfBetter(
  storage: StorageLike,
  record: BestRecord
): { best: BestRecord; improved: boolean } {
  const current = loadBest(storage);
  if (isBetter(record, current)) {
    try {
      storage.setItem(BEST_KEY, JSON.stringify(record));
    } catch {
      // 存储不可用时静默失败，不影响游戏
    }
    return { best: record, improved: true };
  }
  return { best: current as BestRecord, improved: false };
}

export function hasSeenTips(storage: StorageLike): boolean {
  try {
    return storage.getItem(TIPS_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTipsSeen(storage: StorageLike): void {
  try {
    storage.setItem(TIPS_KEY, '1');
  } catch {
    // ignore
  }
}
