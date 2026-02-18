export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
export const DEFAULT_HAND_SIZE = 5;
export const CARDS_PER_DRAW = 2;
export const MAX_CP = 100;
export const MAX_PP = 50;
export const STARTING_CP = 50;
export const STARTING_PP = 20;

export const COLORS = {
  // Card type colors
  evidence: 0x3B82F6,    // blue
  objection: 0xEF4444,   // red
  tactic: 0xF59E0B,      // gold
  witness: 0x22C55E,     // green
  wild: 0xA855F7,        // purple

  // UI colors
  background: 0x1A1A2E,
  panelDark: 0x16213E,
  panelMid: 0x0F3460,
  accent: 0xE94560,
  gold: 0xD4AF37,
  textLight: 0xF5F5F5,
  textDim: 0x999999,

  // Courtroom zones
  judgeBench: 0x5C3317,
  witnessStand: 0x7A4B2A,
  juryBox: 0x4A3728,
  counselTable: 0x3D2B1F,
  floor: 0x2C1810,
  wall: 0x8B7355,

  // Resource bars
  cpBar: 0x3B82F6,
  ppBar: 0x22C55E,
  barBg: 0x333333,
} as const;
