// Source model: Fable 5
// 轻量粒子系统：落地尘土、蓄力火花、收集爆点、检查点光环、碎裂石屑。

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  shape: 'dot' | 'spark' | 'ring' | 'shard';
}

export class Particles {
  list: Particle[] = [];

  private spawn(p: Particle): void {
    if (this.list.length > 600) this.list.shift();
    this.list.push(p);
  }

  burst(
    x: number,
    y: number,
    count: number,
    opts: Partial<Particle> & { speed?: number; spread?: number; baseAngle?: number }
  ): void {
    const speed = opts.speed ?? 120;
    const spread = opts.spread ?? Math.PI * 2;
    const base = opts.baseAngle ?? 0;
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        maxLife: (opts.maxLife ?? 0.6) * (0.6 + Math.random() * 0.7),
        size: (opts.size ?? 3) * (0.6 + Math.random() * 0.8),
        color: opts.color ?? '#cbd2e0',
        gravity: opts.gravity ?? 300,
        shape: opts.shape ?? 'dot',
      });
    }
  }

  landDust(x: number, y: number, hard: boolean): void {
    this.burst(x, y, hard ? 16 : 8, {
      speed: hard ? 150 : 80,
      baseAngle: -Math.PI / 2,
      spread: Math.PI * 1.4,
      color: '#8b8fa3',
      gravity: 220,
      maxLife: 0.5,
    });
  }

  chargeSpark(x: number, y: number, ratio: number): void {
    this.burst(x, y, 1, {
      speed: 40 + 90 * ratio,
      baseAngle: -Math.PI / 2,
      spread: 1.2,
      color: ratio > 0.85 ? '#ffd76a' : '#7ec8ff',
      gravity: -160,
      maxLife: 0.4,
      size: 2.4,
      shape: 'spark',
    });
  }

  collectBurst(x: number, y: number): void {
    this.burst(x, y, 18, { speed: 170, color: '#ffcf4d', gravity: 60, maxLife: 0.7, shape: 'spark' });
  }

  checkpointRing(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x,
        y,
        vx: 0,
        vy: -20,
        life: -i * 0.12,
        maxLife: 0.8,
        size: 10,
        color: '#5ff0d0',
        gravity: 0,
        shape: 'ring',
      });
    }
  }

  crumbleDebris(x: number, y: number, w: number): void {
    for (let i = 0; i < 12; i++) {
      this.spawn({
        x: x + Math.random() * w,
        y: y + Math.random() * 16,
        vx: (Math.random() - 0.5) * 90,
        vy: 40 + Math.random() * 120,
        life: 0,
        maxLife: 0.9,
        size: 3 + Math.random() * 3,
        color: '#6d6f80',
        gravity: 700,
        shape: 'shard',
      });
    }
  }

  finishRays(x: number, y: number): void {
    this.burst(x, y, 40, { speed: 260, color: '#ffe9a0', gravity: -30, maxLife: 1.3, shape: 'spark' });
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      if (p.life > p.maxLife) {
        this.list.splice(i, 1);
        continue;
      }
      if (p.life < 0) continue;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camY: number): void {
    for (const p of this.list) {
      if (p.life < 0) continue;
      const k = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      const sy = p.y - camY;
      if (sy < -30 || sy > 580) continue;
      if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * k;
        ctx.beginPath();
        ctx.arc(p.x, sy, p.size + (1 - k) * 46, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'spark') {
        ctx.beginPath();
        ctx.arc(p.x, sy, p.size * k, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'shard') {
        ctx.fillRect(p.x - p.size / 2, sy - p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, sy, p.size * (0.5 + 0.5 * k), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
