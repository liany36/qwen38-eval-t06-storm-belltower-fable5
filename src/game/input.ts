// Source model: Fable 5
// 键盘输入：按下/按住/松开 的轮询式查询。

const TRACKED = new Set([
  'KeyA',
  'KeyD',
  'KeyW',
  'KeyS',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'KeyR',
  'Escape',
]);

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  anyKeyPressed = false;

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (TRACKED.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        this.anyKeyPressed = true;
      }
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    target.addEventListener('blur', () => {
      this.down.clear();
    });
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  justPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  justReleased(code: string): boolean {
    return this.released.has(code);
  }

  /** 水平方向输入：-1/0/1 */
  dirX(): -1 | 0 | 1 {
    const left = this.isDown('KeyA') || this.isDown('ArrowLeft');
    const right = this.isDown('KeyD') || this.isDown('ArrowRight');
    if (left && !right) return -1;
    if (right && !left) return 1;
    return 0;
  }

  /** 每帧末调用，清空瞬时状态 */
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.anyKeyPressed = false;
  }
}
