// Source model: Fable 5
// 渲染层：三层视差风暴背景、五类平台、原创角色“灯芯”、HUD 与各类界面。

import type { Game } from './game';
import { VIEW } from './game';
import { chargeRatio, PHYS } from '../engine/physics';
import { movingPlatformX, type PlatformDef } from './level';

const W = VIEW.w;
const H = VIEW.h;

// 简易确定性伪随机（用于背景元素布置）
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  len: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private rain: RainDrop[] = [];

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    for (let i = 0; i < 110; i++) {
      this.rain.push({
        x: Math.random() * (W + 200) - 100,
        y: Math.random() * H,
        speed: 620 + Math.random() * 380,
        len: 14 + Math.random() * 18,
      });
    }
  }

  draw(game: Game, dt: number): void {
    const ctx = this.ctx;
    const camY = game.camY;
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    this.drawSky(game, camY);
    this.drawFarLayer(game, camY);
    this.drawMidLayer(game, camY);
    this.drawNearLayer(game, camY);

    // ---- 世界层 ----
    ctx.save();
    ctx.translate(0, -camY);
    this.drawWindStreaks(game);
    for (const def of game.level.platforms) this.drawPlatform(game, def);
    this.drawCheckpoints(game);
    this.drawCollectibles(game);
    this.drawFinish(game);
    this.drawPlayer(game);
    ctx.restore();

    game.particles.draw(ctx, camY);
    this.drawRain(game, dt);

    // 闪电
    if (game.lightningFlash > 0) {
      ctx.fillStyle = `rgba(220,230,255,${game.lightningFlash * 0.28})`;
      ctx.fillRect(0, 0, W, H);
    }
    // 暗角
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(4,5,12,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    this.drawHUD(game);
    if (game.state === 'title') this.drawTitle(game);
    if (game.state === 'paused') this.drawPause();
    if (game.state === 'finished') this.drawResult(game);
    if (game.state === 'playing' && game.showTips && !game.hasJumped) this.drawTips();

    ctx.restore();
  }

  // ================= 背景 =================

  private drawSky(game: Game, camY: number): void {
    const ctx = this.ctx;
    // 越往上越暗紫、风暴感越强
    const prog = 1 - camY / (game.level.height - H); // 0=底部 1=顶部
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${18 + prog * 14},${16 + prog * 8},${38 + prog * 18})`);
    g.addColorStop(0.55, '#141628');
    g.addColorStop(1, '#0a0b16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 月亮（视差极小）
    const my = 90 + camY * 0.03;
    ctx.save();
    ctx.globalAlpha = 0.9;
    const mg = ctx.createRadialGradient(790, my, 4, 790, my, 90);
    mg.addColorStop(0, 'rgba(232,238,255,0.95)');
    mg.addColorStop(0.25, 'rgba(196,208,240,0.5)');
    mg.addColorStop(1, 'rgba(180,190,230,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(680, my - 110, 220, 220);
    ctx.fillStyle = '#dfe6fb';
    ctx.beginPath();
    ctx.arc(790, my, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c3ccec';
    ctx.beginPath();
    ctx.arc(783, my - 6, 5, 0, Math.PI * 2);
    ctx.arc(798, my + 8, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 第 1 层视差：远处翻滚的风暴云 */
  private drawFarLayer(game: Game, camY: number): void {
    const ctx = this.ctx;
    const f = 0.12;
    const t = game.worldTime;
    ctx.save();
    ctx.fillStyle = 'rgba(40,44,74,0.55)';
    for (let i = 0; i < 26; i++) {
      const wy = i * 220;
      const sy = wy - camY * f;
      const yy = ((sy % (H + 260)) + H + 260) % (H + 260) - 130;
      const r1 = hash(i * 3 + 1);
      const r2 = hash(i * 3 + 2);
      const cx = ((r1 * 1400 + t * (8 + r2 * 14)) % (W + 480)) - 240;
      const s = 60 + r2 * 90;
      ctx.beginPath();
      ctx.ellipse(cx, yy, s * 1.8, s * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s, yy + 12, s * 1.2, s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 第 2 层视差：远处废墟塔群剪影 */
  private drawMidLayer(game: Game, camY: number): void {
    const ctx = this.ctx;
    const f = 0.32;
    ctx.save();
    ctx.fillStyle = 'rgba(24,26,48,0.9)';
    for (let i = 0; i < 40; i++) {
      const wy = i * 300;
      const sy = wy - camY * f;
      if (sy < -320 || sy > H + 60) continue;
      const r = hash(i * 7 + 5);
      const bx = r * (W - 140);
      const bw = 60 + hash(i * 7 + 6) * 120;
      const bh = 160 + hash(i * 7 + 7) * 220;
      ctx.fillRect(bx, sy, bw, bh);
      // 破损的塔顶
      ctx.beginPath();
      ctx.moveTo(bx, sy);
      ctx.lineTo(bx + bw * 0.3, sy - 26 - r * 30);
      ctx.lineTo(bx + bw * 0.62, sy - 8);
      ctx.lineTo(bx + bw, sy);
      ctx.fill();
      // 窗洞微光
      ctx.fillStyle = 'rgba(120,150,220,0.12)';
      for (let wdx = 0; wdx < 3; wdx++) {
        if (hash(i * 13 + wdx) > 0.6) {
          ctx.fillRect(bx + 12 + wdx * (bw / 3.5), sy + 40 + hash(i + wdx) * 60, 8, 14);
        }
      }
      ctx.fillStyle = 'rgba(24,26,48,0.9)';
    }
    ctx.restore();
  }

  /** 第 3 层视差：近处悬链、断梁与巨齿轮剪影 */
  private drawNearLayer(game: Game, camY: number): void {
    const ctx = this.ctx;
    const f = 0.58;
    const t = game.worldTime;
    ctx.save();
    for (let i = 0; i < 46; i++) {
      const wy = i * 260 + hash(i) * 120;
      const sy = wy - camY * f;
      if (sy < -260 || sy > H + 160) continue;
      const r = hash(i * 17 + 3);
      const x = r * W;
      if (r < 0.38) {
        // 悬链（随风摆动）
        const sway = Math.sin(t * 1.1 + i) * (6 + game.windBase * 0.06);
        ctx.strokeStyle = 'rgba(14,15,30,0.95)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, sy - 80);
        ctx.quadraticCurveTo(x + sway, sy + 10, x + sway * 1.8, sy + 110);
        ctx.stroke();
        ctx.fillStyle = 'rgba(14,15,30,0.95)';
        ctx.beginPath();
        ctx.arc(x + sway * 1.8, sy + 116, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (r < 0.66) {
        // 断裂横梁
        ctx.fillStyle = 'rgba(16,18,34,0.95)';
        ctx.save();
        ctx.translate(x, sy);
        ctx.rotate((r - 0.5) * 0.5);
        ctx.fillRect(-70, -7, 140, 14);
        ctx.restore();
      } else {
        // 巨齿轮剪影（缓慢旋转）
        const rad = 34 + r * 40;
        ctx.save();
        ctx.translate(x, sy);
        ctx.rotate(t * 0.22 * (r > 0.8 ? 1 : -1));
        ctx.fillStyle = 'rgba(15,17,33,0.92)';
        for (let k = 0; k < 8; k++) {
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-6, -rad - 8, 12, 16);
        }
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(30,33,60,0.9)';
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /** 风区中的风向流线 */
  private drawWindStreaks(game: Game): void {
    if (Math.abs(game.wind) < 12) return;
    const ctx = this.ctx;
    const t = game.worldTime;
    const dir = Math.sign(game.wind);
    const strength = Math.min(1, Math.abs(game.wind) / 160);
    ctx.save();
    ctx.strokeStyle = `rgba(170,200,255,${0.1 + strength * 0.16})`;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 22; i++) {
      const r = hash(i * 31 + 7);
      const wy = game.camY + ((r * 700 + i * 37) % (H + 40)) - 20;
      const phase = (t * (140 + r * 220) * dir) % (W + 260);
      const x = dir > 0 ? phase - 130 : W + 130 - phase;
      const wob = Math.sin(t * 3 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(x, wy + wob);
      ctx.bezierCurveTo(x + 24 * dir, wy + wob - 3, x + 40 * dir, wy + wob + 3, x + 62 * dir, wy + wob);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawRain(game: Game, dt: number): void {
    const ctx = this.ctx;
    const slant = game.wind * 0.14;
    ctx.save();
    ctx.strokeStyle = 'rgba(160,180,225,0.32)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const d of this.rain) {
      d.y += d.speed * dt;
      d.x += slant * dt * 6;
      if (d.y > H + 20) {
        d.y = -30;
        d.x = Math.random() * (W + 200) - 100;
      }
      if (d.x > W + 120) d.x -= W + 240;
      if (d.x < -120) d.x += W + 240;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - slant * 0.06 * d.len, d.y - d.len);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ================= 平台 =================

  private drawPlatform(game: Game, def: PlatformDef): void {
    const ctx = this.ctx;
    const cs = game.crumbles.get(def.id);
    if (cs?.phase === 'broken') return;
    let x = def.type === 'moving' ? movingPlatformX(def, game.worldTime) : def.x;
    let y = def.y;
    if (def.y + def.h < game.camY - 60 || def.y > game.camY + H + 60) return;
    if (cs?.phase === 'shaking') {
      x += (Math.random() - 0.5) * 4;
      y += (Math.random() - 0.5) * 3;
    }
    const { w, h } = def;

    if (def.type === 'spring') {
      this.drawSpring(game, def, x, y);
      return;
    }

    if (def.type === 'oneway') {
      // 木板单向平台
      ctx.fillStyle = '#4d3b28';
      ctx.fillRect(x, y, w, 12);
      ctx.fillStyle = '#6b5138';
      ctx.fillRect(x, y, w, 6);
      ctx.fillStyle = '#3a2c1e';
      for (let i = 8; i < w; i += 26) ctx.fillRect(x + i, y, 3, 12);
      // 支架
      ctx.strokeStyle = '#33281c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 12);
      ctx.lineTo(x + 22, y + 26);
      ctx.moveTo(x + w - 8, y + 12);
      ctx.lineTo(x + w - 22, y + 26);
      ctx.stroke();
      // 向上箭头提示
      ctx.fillStyle = 'rgba(230,210,160,0.5)';
      const ax = x + w / 2;
      ctx.beginPath();
      ctx.moveTo(ax, y - 8);
      ctx.lineTo(ax - 5, y - 2);
      ctx.lineTo(ax + 5, y - 2);
      ctx.fill();
      return;
    }

    // 石制平台主体
    const isIce = !!def.ice;
    const body = isIce ? '#7fa8c9' : def.type === 'moving' ? '#4c5568' : '#43465c';
    const top = isIce ? '#cfe9f7' : def.type === 'moving' ? '#707c94' : '#63677f';
    ctx.fillStyle = body;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = top;
    ctx.fillRect(x, y, w, 6);
    // 砖缝
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let i = 18; i < w; i += 34) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 6);
      ctx.lineTo(x + i, y + h);
      ctx.stroke();
    }

    if (isIce) {
      // 冰面高光
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 3);
      ctx.lineTo(x + w * 0.4, y + 3);
      ctx.moveTo(x + w * 0.55, y + 3);
      ctx.lineTo(x + w * 0.7, y + 3);
      ctx.stroke();
      // 冰凌
      ctx.fillStyle = 'rgba(190,225,246,0.85)';
      for (let i = 10; i < w - 8; i += 30) {
        const dh = 6 + hash(def.id * 10 + i) * 10;
        ctx.beginPath();
        ctx.moveTo(x + i, y + h);
        ctx.lineTo(x + i + 4, y + h + dh);
        ctx.lineTo(x + i + 8, y + h);
        ctx.fill();
      }
    }

    if (def.type === 'moving') {
      // 侧面齿轮装饰
      const gx = x - 8;
      const gy = y + h / 2;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(game.worldTime * 2.2);
      ctx.fillStyle = '#8d99b5';
      for (let k = 0; k < 6; k++) {
        ctx.rotate(Math.PI / 3);
        ctx.fillRect(-2.5, -13, 5, 6);
      }
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4c5568';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // 轨道
      ctx.strokeStyle = 'rgba(140,150,180,0.18)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(def.x - (def.move?.dx ?? 0) + 10, y + h / 2);
      ctx.lineTo(def.x + w + (def.move?.dx ?? 0) - 10, y + h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (def.type === 'crumble') {
      // 裂纹
      const heavy = cs?.phase === 'shaking';
      ctx.strokeStyle = heavy ? 'rgba(255,180,120,0.85)' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = heavy ? 2 : 1.4;
      ctx.beginPath();
      const midX = x + w / 2;
      ctx.moveTo(midX - 14, y + 2);
      ctx.lineTo(midX - 4, y + 10);
      ctx.lineTo(midX - 10, y + h - 4);
      ctx.moveTo(midX + 12, y + 3);
      ctx.lineTo(midX + 5, y + 12);
      ctx.lineTo(midX + 14, y + h - 3);
      ctx.moveTo(x + 10, y + 8);
      ctx.lineTo(x + 20, y + 14);
      ctx.stroke();
    } else if (!isIce && def.type === 'normal' && def.w < 900) {
      // 青苔点缀
      ctx.fillStyle = 'rgba(72,120,96,0.5)';
      for (let i = 4; i < w - 10; i += 42) {
        if (hash(def.id * 3 + i) > 0.45) ctx.fillRect(x + i, y, 12 + hash(def.id + i) * 10, 3);
      }
    }
  }

  private drawSpring(game: Game, def: PlatformDef, x: number, y: number): void {
    const ctx = this.ctx;
    const anim = game.springAnims.get(def.id) ?? 0;
    const squish = anim > 0.25 ? 0.45 : anim > 0 ? 1.25 : 1;
    const w = def.w;
    // 底座
    ctx.fillStyle = '#3c3f52';
    ctx.fillRect(x, y + 14, w, 10);
    // 弹簧圈
    const coilH = 14 * squish;
    const cx = x + w / 2;
    ctx.strokeStyle = '#c98a4b';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const yy = y + 14 - (i + 0.5) * (coilH / 3);
      ctx.moveTo(cx - 20, yy);
      ctx.bezierCurveTo(cx - 20, yy - 5, cx + 20, yy - 5, cx + 20, yy);
    }
    ctx.stroke();
    // 顶板
    ctx.fillStyle = '#e0a55e';
    ctx.fillRect(cx - 26, y + 12 - coilH, 52, 7);
    ctx.fillStyle = 'rgba(255,235,190,0.8)';
    ctx.fillRect(cx - 26, y + 12 - coilH, 52, 2.4);
  }

  // ================= 互动元素 =================

  private drawCheckpoints(game: Game): void {
    const ctx = this.ctx;
    for (const cp of game.level.checkpoints) {
      if (cp.y < game.camY - 90 || cp.y > game.camY + H + 90) continue;
      const active = game.session.activatedCheckpoints.has(cp.id);
      const t = game.worldTime;
      // 灯柱
      ctx.fillStyle = '#2c2f42';
      ctx.fillRect(cp.x - 3, cp.y - 46, 6, 46);
      ctx.fillRect(cp.x - 12, cp.y - 2, 24, 4);
      // 灯笼
      const ly = cp.y - 52;
      if (active) {
        const glow = ctx.createRadialGradient(cp.x, ly, 2, cp.x, ly, 42);
        glow.addColorStop(0, 'rgba(95,240,208,0.85)');
        glow.addColorStop(1, 'rgba(95,240,208,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cp.x - 44, ly - 44, 88, 88);
      }
      ctx.fillStyle = active ? '#173f38' : '#23253a';
      ctx.strokeStyle = active ? '#5ff0d0' : '#4a4e6d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cp.x - 8, ly - 10);
      ctx.lineTo(cp.x + 8, ly - 10);
      ctx.lineTo(cp.x + 6, ly + 8);
      ctx.lineTo(cp.x - 6, ly + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (active) {
        // 火焰
        const fh = 6 + Math.sin(t * 9 + cp.id) * 2;
        ctx.fillStyle = '#8ffce4';
        ctx.beginPath();
        ctx.ellipse(cp.x, ly - 1, 3.2, fh, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawCollectibles(game: Game): void {
    const ctx = this.ctx;
    const t = game.worldTime;
    for (const c of game.level.collectibles) {
      if (game.session.collectedIds.has(c.id)) continue;
      if (c.y < game.camY - 60 || c.y > game.camY + H + 60) continue;
      const bob = Math.sin(t * 2.4 + c.id * 1.3) * 5;
      const y = c.y + bob;
      // 光晕
      const glow = ctx.createRadialGradient(c.x, y, 2, c.x, y, 26);
      glow.addColorStop(0, 'rgba(255,207,77,0.5)');
      glow.addColorStop(1, 'rgba(255,207,77,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(c.x - 26, y - 26, 52, 52);
      // 旋转齿轮
      ctx.save();
      ctx.translate(c.x, y);
      ctx.rotate(t * 1.6 + c.id);
      ctx.fillStyle = '#ffcf4d';
      for (let k = 0; k < 6; k++) {
        ctx.rotate(Math.PI / 3);
        ctx.fillRect(-2.6, -12.5, 5.2, 6);
      }
      ctx.beginPath();
      ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6a1e';
      ctx.beginPath();
      ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawFinish(game: Game): void {
    const ctx = this.ctx;
    const f = game.level.finish;
    if (f.y > game.camY + H + 120 || f.y + f.h < game.camY - 160) return;
    const cx = f.x + f.w / 2;
    const t = game.worldTime;
    // 顶部钟架
    ctx.strokeStyle = '#3a3d55';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - 70, f.y + f.h + 4);
    ctx.lineTo(cx - 46, f.y - 10);
    ctx.lineTo(cx + 46, f.y - 10);
    ctx.lineTo(cx + 70, f.y + f.h + 4);
    ctx.stroke();
    // 金钟光晕
    const glowSize = 60 + Math.sin(t * 2) * 8 + game.finishFlash * 80;
    const glow = ctx.createRadialGradient(cx, f.y + 55, 6, cx, f.y + 55, glowSize);
    glow.addColorStop(0, 'rgba(255,225,140,0.75)');
    glow.addColorStop(1, 'rgba(255,225,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - glowSize, f.y + 55 - glowSize, glowSize * 2, glowSize * 2);
    // 大钟（随风轻摆）
    const sway = Math.sin(t * 1.3) * 0.06;
    ctx.save();
    ctx.translate(cx, f.y - 4);
    ctx.rotate(sway);
    ctx.fillStyle = '#d9a93f';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.lineTo(30, 52);
    ctx.quadraticCurveTo(34, 64, 24, 64);
    ctx.lineTo(-24, 64);
    ctx.quadraticCurveTo(-34, 64, -30, 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4d67c';
    ctx.beginPath();
    ctx.moveTo(-3, 4);
    ctx.lineTo(-16, 50);
    ctx.lineTo(-8, 50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a6a1e';
    ctx.fillRect(-26, 58, 52, 6);
    // 钟锤
    ctx.fillStyle = '#6d5416';
    ctx.beginPath();
    ctx.arc(0, 70, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 文案
    ctx.fillStyle = 'rgba(255,232,160,0.85)';
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('敲响晨钟', cx, f.y + f.h + 24);
  }

  // ================= 角色 =================

  /** 原创角色「灯芯」：披风小灯守，蓄力压缩、跳跃拉伸、围巾随风 */
  private drawPlayer(game: Game): void {
    const ctx = this.ctx;
    const pl = game.player;
    const t = game.worldTime;
    const cx = pl.x + pl.w / 2;
    const bottom = pl.y + pl.h;
    const r = pl.charging ? chargeRatio(pl.charge) : 0;

    // 挤压/拉伸
    let sy = 1;
    let sx = 1;
    if (pl.charging) {
      sy = 1 - 0.3 * r;
      sx = 1 + 0.22 * r;
    } else if (!pl.onGround) {
      if (pl.vy < -140) {
        sy = 1.16;
        sx = 0.88;
      } else if (pl.vy > 260) {
        sy = 1.06;
        sx = 0.94;
      }
    } else if (pl.landSquash > 0) {
      sy = 1 - 0.22 * pl.landSquash;
      sx = 1 + 0.18 * pl.landSquash;
    }
    const idleBob = pl.onGround && !pl.charging ? Math.sin(t * 3.2) * 1.2 : 0;

    ctx.save();
    ctx.translate(cx, bottom + idleBob);
    ctx.scale(sx, sy);
    if (pl.facing < 0) ctx.scale(-1, 1);

    const bh = 34; // 基准身高

    // 蓄力光环
    if (pl.charging) {
      const cg = ctx.createRadialGradient(0, -14, 3, 0, -14, 30 + r * 16);
      cg.addColorStop(0, `rgba(126,200,255,${0.24 + r * 0.3})`);
      cg.addColorStop(1, 'rgba(126,200,255,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(-48, -62, 96, 96);
    }

    // 围巾（随风与速度飘动）
    const windPull = -(game.wind * 0.05 + pl.vx * 0.05) * (pl.facing as number);
    ctx.strokeStyle = '#c9553e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -bh + 12);
    for (let i = 1; i <= 3; i++) {
      const px = -6 - i * 6 + windPull * i * 0.5;
      const py = -bh + 12 + Math.sin(t * 7 + i * 1.4) * (2 + i) + i * 2.4 + Math.max(0, pl.vy * 0.012) * i;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 披风身体
    ctx.fillStyle = '#3d4a6b';
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.quadraticCurveTo(-12, -bh * 0.55, -8, -bh * 0.78);
    ctx.quadraticCurveTo(0, -bh - 2, 8, -bh * 0.78);
    ctx.quadraticCurveTo(12, -bh * 0.55, 9, 0);
    ctx.closePath();
    ctx.fill();
    // 披风侧光
    ctx.fillStyle = '#54648c';
    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.quadraticCurveTo(10, -bh * 0.5, 6, -bh * 0.76);
    ctx.quadraticCurveTo(9, -bh * 0.5, 7, -2);
    ctx.closePath();
    ctx.fill();

    // 兜帽
    ctx.fillStyle = '#2e3854';
    ctx.beginPath();
    ctx.arc(0, -bh * 0.76, 9.5, Math.PI * 0.9, Math.PI * 2.1);
    ctx.quadraticCurveTo(11, -bh * 0.62, 0, -bh * 0.58);
    ctx.quadraticCurveTo(-11, -bh * 0.62, -9.3, -bh * 0.79);
    ctx.fill();
    // 帽内阴影脸
    ctx.fillStyle = '#161a2b';
    ctx.beginPath();
    ctx.ellipse(1.4, -bh * 0.7, 6.4, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 发光眼睛（眨眼）
    const blink = Math.sin(t * 0.9) > 0.985 ? 0.15 : 1;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.ellipse(3.6, -bh * 0.71, 1.7, 2.1 * blink, 0, 0, Math.PI * 2);
    ctx.ellipse(-0.6, -bh * 0.71, 1.5, 1.9 * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    // 腰间小提灯（发光，蓄力时更亮）
    const lampGlow = 0.45 + r * 0.55 + Math.sin(t * 5) * 0.06;
    const lg = ctx.createRadialGradient(8, -10, 1, 8, -10, 15);
    lg.addColorStop(0, `rgba(255,196,92,${lampGlow})`);
    lg.addColorStop(1, 'rgba(255,196,92,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(-8, -26, 32, 32);
    ctx.fillStyle = '#20263a';
    ctx.fillRect(6.6, -15, 3, 4);
    ctx.fillStyle = '#ffc45c';
    ctx.fillRect(7, -11.5, 2.2, 3);

    // 小短腿（走路摆动 / 空中收起）
    ctx.strokeStyle = '#20263a';
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    const legSwing = pl.onGround && Math.abs(pl.vx) > 24 ? Math.sin(pl.walkPhase) * 4 : 0;
    const legLift = !pl.onGround ? -3 : 0;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(-4 + legSwing, 0 + legLift);
    ctx.moveTo(4, -4);
    ctx.lineTo(4 - legSwing, 0 + legLift);
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.restore();

    // 蓄力条（角色头顶）
    if (pl.charging) {
      const bw = 44;
      const bx = cx - bw / 2;
      const by = pl.y - 16;
      ctx.fillStyle = 'rgba(10,12,24,0.75)';
      ctx.fillRect(bx - 2, by - 2, bw + 4, 9);
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, '#57b8ff');
      grad.addColorStop(0.75, '#ffd76a');
      grad.addColorStop(1, '#ff8f5e');
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, bw * r, 5);
      if (r >= 1) {
        ctx.strokeStyle = '#fff2c0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 2, by - 2, bw + 4, 9);
      }
    }
  }

  // ================= HUD 与界面 =================

  private fmtTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    const ds = Math.floor((ms % 1000) / 100);
    return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}.${ds}`;
  }

  private drawHUD(game: Game): void {
    if (game.state === 'title') return;
    const ctx = this.ctx;
    const st = game.session.stats;
    ctx.save();
    ctx.font = '13px "Microsoft YaHei", monospace';
    ctx.textAlign = 'left';

    // 左上面板
    ctx.fillStyle = 'rgba(8,10,22,0.62)';
    this.roundRect(12, 12, 168, 78, 8);
    ctx.fill();
    ctx.fillStyle = '#cfd6ea';
    ctx.fillText(`⏱ 用时  ${this.fmtTime(st.timeMs)}`, 24, 34);
    ctx.fillText(`💥 坠落  ${st.falls}`, 24, 54);
    ctx.fillText(`⛰ 高度  ${st.maxHeight.toFixed(1)} m`, 24, 74);

    // 右上面板
    ctx.fillStyle = 'rgba(8,10,22,0.62)';
    this.roundRect(W - 180, 12, 168, 58, 8);
    ctx.fill();
    ctx.fillStyle = '#ffcf4d';
    ctx.fillText(`⚙ 齿轮  ${st.collected} / ${game.level.collectibles.length}`, W - 166, 34);
    ctx.fillStyle = '#9aa3c0';
    ctx.fillText(`📍 ${game.zoneName()}`, W - 166, 54);

    // 风力指示
    if (game.windBase > 0) {
      const wl = Math.min(1, Math.abs(game.wind) / 170);
      const dir = Math.sign(game.wind);
      ctx.fillStyle = 'rgba(8,10,22,0.62)';
      this.roundRect(W / 2 - 74, 12, 148, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#7ec8ff';
      ctx.textAlign = 'center';
      const arrows = dir > 0 ? '→'.repeat(1 + Math.round(wl * 2)) : '←'.repeat(1 + Math.round(wl * 2));
      ctx.fillText(`风 ${arrows}`, W / 2, 32);
    }

    // 检查点提示
    if (game.checkpointFlash > 0) {
      ctx.globalAlpha = Math.min(1, game.checkpointFlash * 2);
      ctx.fillStyle = '#5ff0d0';
      ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('检查点已点亮！', W / 2, 96);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private overlayBase(alpha = 0.66): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(5,6,14,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  private drawTitle(game: Game): void {
    const ctx = this.ctx;
    ctx.save();
    this.overlayBase(0.45);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8ddb0';
    ctx.font = 'bold 52px "Microsoft YaHei", serif';
    ctx.fillText('风 暴 钟 塔', W / 2, 150);
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#8d96b8';
    ctx.fillText('STORM CLOCKTOWER · 在黎明前登顶，敲响晨钟', W / 2, 184);

    ctx.fillStyle = 'rgba(10,12,26,0.8)';
    this.roundRect(W / 2 - 220, 226, 440, 196, 12);
    ctx.fill();
    ctx.fillStyle = '#cfd6ea';
    ctx.font = '15px "Microsoft YaHei", sans-serif';
    const lines = [
      'A / D 或 ← / →   地面移动、空中有限修正',
      '按住 空格 蓄力，松开起跳（越久跳得越高越远）',
      'R  重新开始      Esc  暂停',
      '小心横风、结冰地面与会碎裂的平台！',
    ];
    lines.forEach((s, i) => ctx.fillText(s, W / 2, 262 + i * 30));
    if (game.best) {
      ctx.fillStyle = '#ffcf4d';
      ctx.fillText(`历史最佳：${this.fmtTime(game.best.timeMs)} · 坠落 ${game.best.falls} 次`, W / 2, 262 + 4 * 30);
    }

    const pulse = 0.6 + Math.sin(game.worldTime * 3.4) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffe9a0';
    ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
    ctx.fillText('按任意键开始攀登', W / 2, 470);
    ctx.restore();
  }

  private drawTips(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,12,26,0.72)';
    this.roundRect(W / 2 - 190, H - 86, 380, 58, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe9a0';
    ctx.font = '15px "Microsoft YaHei", sans-serif';
    ctx.fillText('首次攀登提示：按住 空格 蓄力，松开跳跃', W / 2, H - 60);
    ctx.fillStyle = '#9aa3c0';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText('蓄力时按住 A/D 决定起跳方向', W / 2, H - 40);
    ctx.restore();
  }

  private drawPause(): void {
    const ctx = this.ctx;
    ctx.save();
    this.overlayBase(0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8ddb0';
    ctx.font = 'bold 40px "Microsoft YaHei", sans-serif';
    ctx.fillText('已 暂 停', W / 2, H / 2 - 20);
    ctx.fillStyle = '#9aa3c0';
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.fillText('Esc 继续 · R 重新开始', W / 2, H / 2 + 24);
    ctx.restore();
  }

  private drawResult(game: Game): void {
    const ctx = this.ctx;
    const st = game.session.stats;
    ctx.save();
    this.overlayBase(0.72);
    ctx.textAlign = 'center';

    ctx.fillStyle = '#ffe9a0';
    ctx.font = 'bold 42px "Microsoft YaHei", serif';
    ctx.fillText('晨钟已响 · 登顶成功', W / 2, 110);

    if (game.finishStats?.improved) {
      const pulse = 0.7 + Math.sin(game.worldTime * 5) * 0.3;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#5ff0d0';
      ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
      ctx.fillText('★ 新纪录！ ★', W / 2, 148);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(10,12,26,0.85)';
    this.roundRect(W / 2 - 210, 176, 420, 220, 12);
    ctx.fill();

    ctx.font = '17px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    const lx = W / 2 - 170;
    const rx = W / 2 + 170;
    const rows: Array<[string, string]> = [
      ['⏱ 通关用时', this.fmtTime(st.timeMs)],
      ['💥 坠落次数', `${st.falls} 次`],
      ['⛰ 最高高度', `${st.maxHeight.toFixed(1)} m`],
      ['⚙ 收集齿轮', `${st.collected} / ${game.level.collectibles.length}`],
    ];
    rows.forEach(([k, v], i) => {
      ctx.fillStyle = '#9aa3c0';
      ctx.fillText(k, lx, 214 + i * 36);
      ctx.fillStyle = '#e8e9f2';
      ctx.textAlign = 'right';
      ctx.fillText(v, rx, 214 + i * 36);
      ctx.textAlign = 'left';
    });

    const best = game.best;
    if (best) {
      ctx.fillStyle = '#ffcf4d';
      ctx.textAlign = 'center';
      ctx.font = '15px "Microsoft YaHei", sans-serif';
      ctx.fillText(
        `历史最佳：${this.fmtTime(best.timeMs)} · 坠落 ${best.falls} · 齿轮 ${best.collected}`,
        W / 2,
        214 + 4 * 36
      );
    }

    ctx.textAlign = 'center';
    const pulse = 0.6 + Math.sin(game.worldTime * 3.4) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffe9a0';
    ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
    ctx.fillText('按 R 再次攀登', W / 2, 452);
    ctx.restore();
  }
}

export { PHYS };
