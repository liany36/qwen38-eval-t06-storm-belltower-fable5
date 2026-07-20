// Source model: Fable 5
// 一局游戏的运行状态：检查点激活、重生点、坠落统计、收集物。纯逻辑，便于测试。

import type { LevelData } from './level';
import type { Vec2 } from '../engine/physics';

export interface RunStats {
  timeMs: number;
  falls: number;
  collected: number;
  maxHeight: number; // 距出生点的最高攀登高度（米）
}

const CHECKPOINT_RADIUS = 58;
const COLLECT_RADIUS = 30;

export class RunSession {
  readonly level: LevelData;
  activatedCheckpoints = new Set<number>();
  collectedIds = new Set<number>();
  stats: RunStats = { timeMs: 0, falls: 0, collected: 0, maxHeight: 0 };
  private respawn: Vec2;

  constructor(level: LevelData) {
    this.level = level;
    this.respawn = { ...level.spawn };
  }

  /** 玩家中心点靠近未激活检查点时激活之；返回激活的检查点 id，否则 null */
  tryActivateCheckpoint(px: number, py: number): number | null {
    for (const cp of this.level.checkpoints) {
      if (this.activatedCheckpoints.has(cp.id)) continue;
      const dx = px - cp.x;
      const dy = py - cp.y;
      if (dx * dx + dy * dy <= CHECKPOINT_RADIUS * CHECKPOINT_RADIUS) {
        this.activatedCheckpoints.add(cp.id);
        // 重生点设在检查点正上方一点，保证落在平台上
        this.respawn = { x: cp.x - 13, y: cp.y - 40 };
        return cp.id;
      }
    }
    return null;
  }

  /** 当前重生点（最近激活的检查点；从未激活则为出生点） */
  respawnPoint(): Vec2 {
    return { ...this.respawn };
  }

  /** 记录一次坠落（失败惩罚计入统计） */
  registerFall(): void {
    this.stats.falls++;
  }

  /** 尝试收集；返回收集到的 id，否则 null。已收集的不会重复计数 */
  tryCollect(px: number, py: number): number | null {
    for (const c of this.level.collectibles) {
      if (this.collectedIds.has(c.id)) continue;
      const dx = px - c.x;
      const dy = py - c.y;
      if (dx * dx + dy * dy <= COLLECT_RADIUS * COLLECT_RADIUS) {
        this.collectedIds.add(c.id);
        this.stats.collected = this.collectedIds.size;
        return c.id;
      }
    }
    return null;
  }

  /** 根据玩家脚底 Y 更新最高高度（米，1 米 = 10 px） */
  updateHeight(playerBottomY: number): void {
    const meters = Math.max(0, (this.level.spawn.y + 34 - playerBottomY) / 10);
    if (meters > this.stats.maxHeight) this.stats.maxHeight = Math.round(meters * 10) / 10;
  }

  tick(dtMs: number): void {
    this.stats.timeMs += dtMs;
  }
}
