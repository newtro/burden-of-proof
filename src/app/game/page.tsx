'use client';

import { useEffect, useRef } from 'react';

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<import('../../renderer/Game').Game | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function boot() {
      if (!canvasRef.current || gameRef.current) return;
      const { Game } = await import('../../renderer/Game');
      if (destroyed) return;
      const game = new Game();
      gameRef.current = game;
      await game.init(canvasRef.current);
    }

    boot();

    return () => {
      destroyed = true;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100vw', height: '100vh' }}
    />
  );
}
