import { GAME_WIDTH, GAME_HEIGHT } from '../../lib/constants';

export type LayoutMode = 'mobile' | 'tablet' | 'desktop';

export class LayoutManager {
  private baseWidth = GAME_WIDTH;
  private baseHeight = GAME_HEIGHT;

  getScale(screenWidth: number, screenHeight: number): number {
    return Math.min(screenWidth / this.baseWidth, screenHeight / this.baseHeight);
  }

  getLayout(screenWidth: number): LayoutMode {
    if (screenWidth < 768) return 'mobile';
    if (screenWidth < 1200) return 'tablet';
    return 'desktop';
  }

  getPosition(name: string, screenWidth: number, screenHeight: number) {
    const scale = this.getScale(screenWidth, screenHeight);
    const positions: Record<string, { x: number; y: number; w: number; h: number }> = {
      judgeBench:      { x: 960, y: 80,  w: 400, h: 120 },
      witnessStand:    { x: 640, y: 280, w: 200, h: 200 },
      juryBox:         { x: 100, y: 100, w: 200, h: 500 },
      prosecutionTable:{ x: 750, y: 520, w: 250, h: 120 },
      defenseTable:    { x: 450, y: 520, w: 250, h: 120 },
      handArea:        { x: 960, y: 920, w: 800, h: 200 },
      resourceBar:     { x: 960, y: 1030, w: 600, h: 40 },
    };
    const p = positions[name] ?? { x: 0, y: 0, w: 100, h: 100 };
    return {
      x: p.x * scale,
      y: p.y * scale,
      w: p.w * scale,
      h: p.h * scale,
      scale,
    };
  }
}

export const layoutManager = new LayoutManager();
