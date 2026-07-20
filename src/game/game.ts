// Source model: Fable 5
// 游戏主逻辑：状态机、玩家更新、平台机制（移动/碎裂/弹簧/单向）、风、摄像机。

import {
  PHYS,
  accumulateCharge,
  chargeRatio,
  jumpVelocity,
  moveAndCollide,
  clamp,
  approach,
  type Collider,
} from '../engine/physics';
import { createLevel, movingPlatformX, windStrengthAt, zoneNameAt, type LevelData, type PlatformDef } from './level';
import { RunSession } from './session';
import { Input } from './input';
import { AudioFX } from './audio';
import { Particles } from './particles';
import {
  loadBest,
  saveBestIfBetter,
  hasSeenTips,
  markTipsSeen,
  type BestRecord,
  type StorageLike,
} from './storage';

export type GameState = 'title' | 'playing' | 'paused' | 'finished';

export interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  onGround: boolean;
  groundId: number | null;
  charging: boolean;
  charge: number;
  airBudget: number;
  takeoffY: number;
  landSquash: number; // 落地压扁动画计时
  walkPhase: number;
}

export interface CrumbleState {
  phase: 'idle' | 'shaking' | 'broken';
  t: number;
}

const VIEW_W = 960;
const VIEW_H = 540;
const FALL_THRESHOLD = 130; // 落点比起跳点低这么多像素记一次坠落
const CRUMBLE_DELAY = 0.45;
const CRUMBLE_RESPAWN = 3.2;

export class Game {
  readonly level: LevelData;
  session: RunSession;
  player: Player;
  state: GameState = 'title';
  camY = 0;
  worldTime = 0;
  wind = 0; // 当前实际横风加速度（含阵风）
  windBase = 0;
  private gustSeed = Math.random() * 100;
  finishStats: { improved: boolean; best: BestRecord | null } | null = null;
  best: BestRecord | null;
  showTips: boolean;
  hasJumped = false;
  lightningFlash = 0;
  private lightningTimer = 4;
  checkpointFlash = 0;
  finishFlash = 0;
  springAnims = new Map<number, number>();
  crumbles = new Map<number, CrumbleState>();

  readonly input = new Input();
  readonly audio = new AudioFX();
  readonly particles = new Particles();
  private storage: StorageLike;

  constructor(storage: StorageLike) {
    this.storage = storage;
    this.level = createLevel();
    this.session = new RunSession(this.level);
    this.player = this.makePlayer(this.level.spawn.x, this.level.spawn.y);
    this.best = loadBest(storage);
    this.showTips = !hasSeenTips(storage);
    this.camY = clamp(this.player.y - VIEW_H * 0.62, 0, this.level.height - VIEW_H);
  }

  private makePlayer(x: number, y: number): Player {
    return {
      x,
      y,
      w: 26,
      h: 34,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      groundId: null,
      charging: false,
      charge: 0,
      airBudget: 0,
      takeoffY: y,
      landSquash: 0,
      walkPhase: 0,
    };
  }

  /** R：完全重开一局 */
  restart(): void {
    this.session = new RunSession(this.level);
    this.player = this.makePlayer(this.level.spawn.x, this.level.spawn.y);
    this.crumbles.clear();
    this.springAnims.clear();
    this.finishStats = null;
    this.state = 'playing';
    this.camY = clamp(this.player.y - VIEW_H * 0.62, 0, this.level.height - VIEW_H);
  }

  /** 回到最近检查点（坠落惩罚已由调用方计数） */
  private respawnAtCheckpoint(): void {
    const p = this.session.respawnPoint();
    this.player.x = p.x;
    this.player.y = p.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.charging = false;
    this.player.charge = 0;
    this.audio.chargeStop();
    // 碎裂平台全部复原，保证状态可恢复
    this.crumbles.clear();
  }

  /** 当前时刻所有可碰撞体（含移动平台当前位置、排除已碎裂平台） */
  colliders(t: number): Collider[] {
    const out: Collider[] = [];
    for (const def of this.level.platforms) {
      const cs = this.crumbles.get(def.id);
      if (cs && cs.phase === 'broken') continue;
      out.push({
        id: def.id,
        x: def.type === 'moving' ? movingPlatformX(def, t) : def.x,
        y: def.y,
        w: def.w,
        h: def.h,
        oneway: def.type === 'oneway',
      });
    }
    return out;
  }

  platformById(id: number | null): PlatformDef | null {
    if (id === null) return null;
    return this.level.platforms.find((p) => p.id === id) ?? null;
  }

  update(dt: number): void {
    // 输入总开关
    if (this.input.anyKeyPressed) this.audio.ensure();

    if (this.state === 'title') {
      if (this.input.anyKeyPressed) {
        this.state = 'playing';
      }
      this.worldTime += dt;
      this.updateAmbient(dt);
      this.input.endFrame();
      return;
    }

    if (this.input.justPressed('KeyR')) {
      this.restart();
      this.input.endFrame();
      return;
    }

    if (this.state === 'finished') {
      this.worldTime += dt;
      this.updateAmbient(dt);
      this.particles.update(dt);
      this.input.endFrame();
      return;
    }

    if (this.input.justPressed('Escape')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
    }
    if (this.state === 'paused') {
      this.input.endFrame();
      return;
    }

    this.worldTime += dt;
    this.session.tick(dt * 1000);
    this.updateAmbient(dt);
    this.updateWind(dt);
    this.updateCrumbles(dt);
    this.updatePlayer(dt);
    this.updateCamera(dt);
    this.particles.update(dt);
    this.input.endFrame();
  }

  private updateAmbient(dt: number): void {
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 1.6);
    this.checkpointFlash = Math.max(0, this.checkpointFlash - dt);
    this.finishFlash = Math.max(0, this.finishFlash - dt * 0.5);
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningTimer = 5 + Math.random() * 9;
      this.lightningFlash = 0.55 + Math.random() * 0.3;
    }
    for (const [id, v] of this.springAnims) {
      const nv = v - dt;
      if (nv <= 0) this.springAnims.delete(id);
      else this.springAnims.set(id, nv);
    }
  }

  private updateWind(dt: number): void {
    const py = this.player.y + this.player.h;
    this.windBase = windStrengthAt(this.level, py);
    if (this.windBase <= 0) {
      this.wind = approach(this.wind, 0, 400 * dt);
      this.audio.setWindLevel(0.1);
      return;
    }
    const t = this.worldTime + this.gustSeed;
    const gust = Math.sin(t * 0.55) + 0.55 * Math.sin(t * 1.7 + 2.1) + 0.3 * Math.sin(t * 3.3);
    const target = this.windBase * gust * 1.15;
    this.wind = approach(this.wind, target, 600 * dt);
    this.audio.setWindLevel(Math.abs(this.wind) / 180);
  }

  private updateCrumbles(dt: number): void {
    for (const [id, cs] of this.crumbles) {
      cs.t += dt;
      if (cs.phase === 'shaking' && cs.t >= CRUMBLE_DELAY) {
        cs.phase = 'broken';
        cs.t = 0;
        const def = this.platformById(id);
        if (def) {
          this.particles.crumbleDebris(def.x, def.y, def.w);
          this.audio.crumble();
        }
      } else if (cs.phase === 'broken' && cs.t >= CRUMBLE_RESPAWN) {
        this.crumbles.delete(id);
      }
    }
  }

  private updatePlayer(dt: number): void {
    const pl = this.player;
    const dir = this.input.dirX();
    if (dir !== 0 && !pl.charging) pl.facing = dir;
    pl.landSquash = Math.max(0, pl.landSquash - dt * 4);

    const groundDef = this.platformById(pl.groundId);
    const onIce = !!groundDef?.ice && pl.onGround;

    // ---- 移动平台载运 ----
    if (pl.onGround && groundDef?.type === 'moving') {
      const now = movingPlatformX(groundDef, this.worldTime);
      const before = movingPlatformX(groundDef, this.worldTime - dt);
      pl.x += now - before;
      pl.x = clamp(pl.x, 0, this.level.width - pl.w);
    }

    // ---- 蓄力 ----
    if (this.state === 'playing') {
      if (this.input.justPressed('Space') && pl.onGround && !pl.charging) {
        pl.charging = true;
        pl.charge = 0;
        this.audio.chargeStart();
      }
      if (pl.charging) {
        pl.charge = accumulateCharge(pl.charge, dt);
        const r = chargeRatio(pl.charge);
        this.audio.chargeUpdate(r);
        if (Math.random() < 0.5) {
          this.particles.chargeSpark(pl.x + pl.w / 2 + (Math.random() - 0.5) * 20, pl.y + pl.h, r);
        }
        const releasedNow = this.input.justReleased('Space');
        const full = pl.charge >= PHYS.chargeTime;
        if ((releasedNow || full) && pl.onGround) {
          this.doJump(dir);
        } else if (releasedNow && !pl.onGround) {
          pl.charging = false;
          pl.charge = 0;
          this.audio.chargeStop();
        }
      }
    }

    // ---- 水平速度 ----
    if (pl.onGround) {
      const target = pl.charging ? 0 : dir * PHYS.walkSpeed;
      const accel = onIce ? PHYS.iceAccel : PHYS.groundAccel;
      pl.vx = approach(pl.vx, target, accel * dt);
      if (dir !== 0 && !pl.charging) pl.walkPhase += dt * 11;
    } else {
      // 有限空中修正：消耗预算
      if (dir !== 0 && pl.airBudget > 0) {
        const dv = Math.min(PHYS.airAccel * dt, pl.airBudget);
        pl.vx += dir * dv;
        pl.airBudget -= dv;
      }
      // 横风只作用于空中
      pl.vx += this.wind * dt;
      pl.vx = clamp(pl.vx, -PHYS.windMaxVx, PHYS.windMaxVx);
    }

    // ---- 重力 ----
    pl.vy = Math.min(PHYS.maxFall, pl.vy + PHYS.gravity * dt);

    // ---- 碰撞求解 ----
    const wasOnGround = pl.onGround;
    const prevVx = pl.vx;
    const prevVy = pl.vy;
    const res = moveAndCollide(
      { x: pl.x, y: pl.y, w: pl.w, h: pl.h },
      pl.vx,
      pl.vy,
      dt,
      this.colliders(this.worldTime)
    );
    pl.x = res.x;
    pl.y = res.y;
    pl.onGround = res.onGround;
    pl.groundId = res.groundId;

    if (res.hitWall) {
      if (!wasOnGround) {
        // 空中撞墙反弹
        pl.vx = -prevVx * PHYS.wallBounce;
        if (Math.abs(prevVx) > 120) this.audio.wallHit();
      } else {
        pl.vx = 0;
      }
    }
    if (res.hitCeiling) pl.vy = 20;
    else if (res.onGround) pl.vy = 0;

    // ---- 落地处理 ----
    if (res.onGround && !wasOnGround) {
      this.onLanded(prevVy);
    }
    // 起跳点记录（离开地面的瞬间）
    if (!res.onGround && wasOnGround) {
      pl.takeoffY = pl.y;
    }

    // ---- 交互：检查点 / 收集 / 终点 ----
    const cx = pl.x + pl.w / 2;
    const cy = pl.y + pl.h / 2;
    const cpId = this.session.tryActivateCheckpoint(cx, cy);
    if (cpId !== null) {
      this.audio.checkpoint();
      this.checkpointFlash = 1;
      const cp = this.level.checkpoints.find((c) => c.id === cpId);
      if (cp) this.particles.checkpointRing(cp.x, cp.y - 26);
    }
    const gotId = this.session.tryCollect(cx, cy);
    if (gotId !== null) {
      this.audio.collect();
      const c = this.level.collectibles.find((g) => g.id === gotId);
      if (c) this.particles.collectBurst(c.x, c.y);
    }
    this.session.updateHeight(pl.y + pl.h);

    const f = this.level.finish;
    if (cx > f.x && cx < f.x + f.w && cy > f.y && cy < f.y + f.h) {
      this.onFinish();
    }

    // ---- 掉出世界：自动重置到检查点 ----
    if (pl.y > this.level.height + 120 || !isFinite(pl.x) || !isFinite(pl.y)) {
      this.session.registerFall();
      this.audio.fall();
      this.respawnAtCheckpoint();
    }
  }

  private doJump(dir: -1 | 0 | 1): void {
    const pl = this.player;
    const r = chargeRatio(pl.charge);
    const v = jumpVelocity(r, dir);
    pl.vx = v.x;
    pl.vy = v.y;
    pl.charging = false;
    pl.charge = 0;
    pl.onGround = false;
    pl.airBudget = PHYS.airBudget;
    pl.takeoffY = pl.y;
    if (dir !== 0) pl.facing = dir;
    this.audio.jump(r);
    this.particles.landDust(pl.x + pl.w / 2, pl.y + pl.h, false);
    if (this.showTips && !this.hasJumped) {
      this.hasJumped = true;
      markTipsSeen(this.storage);
    }
  }

  private onLanded(impactVy: number): void {
    const pl = this.player;
    const def = this.platformById(pl.groundId);

    // 弹簧：立刻反弹，不算落地
    if (def?.type === 'spring') {
      pl.vy = -PHYS.springVy;
      pl.onGround = false;
      pl.airBudget = PHYS.airBudget;
      pl.takeoffY = pl.y;
      this.springAnims.set(def.id, 0.35);
      this.audio.spring();
      this.particles.landDust(pl.x + pl.w / 2, pl.y + pl.h, false);
      return;
    }

    const hard = impactVy > 640;
    pl.landSquash = hard ? 1 : 0.55;
    this.audio.land(hard);
    this.particles.landDust(pl.x + pl.w / 2, pl.y + pl.h, hard);

    // 坠落判定：落点明显低于起跳点
    if (pl.y - pl.takeoffY > FALL_THRESHOLD) {
      this.session.registerFall();
    }

    // 碎裂平台：踩上开始倒计时
    if (def?.type === 'crumble' && !this.crumbles.has(def.id)) {
      this.crumbles.set(def.id, { phase: 'shaking', t: 0 });
    }
  }

  private onFinish(): void {
    if (this.state !== 'playing') return;
    this.state = 'finished';
    this.audio.chargeStop();
    this.audio.finish();
    this.finishFlash = 1;
    this.particles.finishRays(this.level.finish.x + this.level.finish.w / 2, this.level.finish.y + 60);
    const rec: BestRecord = {
      timeMs: Math.round(this.session.stats.timeMs),
      falls: this.session.stats.falls,
      collected: this.session.stats.collected,
      maxHeight: this.session.stats.maxHeight,
      date: new Date().toISOString(),
    };
    const { best, improved } = saveBestIfBetter(this.storage, rec);
    this.best = best;
    this.finishStats = { improved, best };
  }

  private updateCamera(dt: number): void {
    const target = clamp(this.player.y - VIEW_H * 0.58, 0, this.level.height - VIEW_H);
    const k = 1 - Math.pow(0.0015, dt);
    this.camY += (target - this.camY) * k;
    if (Math.abs(target - this.camY) < 0.3) this.camY = target;
  }

  zoneName(): string {
    return zoneNameAt(this.level, this.player.y + this.player.h);
  }

  /** 调试用：直接跳到终点（用于截图/验证结算流程） */
  debugFinish(): void {
    this.state = 'playing';
    this.player.x = this.level.finish.x + this.level.finish.w / 2 - this.player.w / 2;
    this.player.y = this.level.finish.y + 40;
    this.onFinish();
  }
}

export const VIEW = { w: VIEW_W, h: VIEW_H };
