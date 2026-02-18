# Spec 04: Courtroom UI

## Rendering Architecture

PixiJS 8 canvas fills the game viewport. React overlay handles HUD elements (event log, dialogs, menus). Canvas and React communicate via Zustand store.

```
┌─────────────────────────────────────────────┐
│ React Root                                   │
│  ┌─────────────────────────────────────────┐ │
│  │ PixiJS Canvas (game scene)              │ │
│  │                                         │ │
│  │                                         │ │
│  └─────────────────────────────────────────┘ │
│  ┌──────┐  ┌──────────────┐  ┌───────────┐  │
│  │HUD   │  │ Card Detail  │  │ Event Log │  │
│  │Overlay│  │ Popover      │  │ Panel     │  │
│  └──────┘  └──────────────┘  └───────────┘  │
└─────────────────────────────────────────────┘
```

## Courtroom Layout (PixiJS Scene)

The courtroom is a single illustrated background with interactive sprite layers on top.

### Z-Layers (back to front)
1. **Background** — courtroom illustration (walls, ceiling, wood paneling)
2. **Furniture** — judge bench, tables, witness stand, jury box (static sprites)
3. **Characters** — judge portrait, witness portrait, juror portraits, opponent portrait
4. **Effects** — gavel animations, speech bubbles, highlight glows
5. **Cards** — card hand at bottom, played card animations
6. **UI Overlays** — resource bars, phase indicator, turn indicator

### Layout Coordinates (1920x1080 base, responsive scaling)

```
Judge Bench:       center-top (960, 80), width 400
Witness Stand:     center-left (640, 280), width 200
Jury Box:          far-left (60, 100 to 60, 600), 2 rows of 6
Prosecution Table: center-right-bottom (700, 520)
Defense Table:     center-left-bottom (500, 520)
Gallery:           far-right (background only)
Player Hand:       bottom-center (960, 900), card fan
Resource Bars:     bottom strip (960, 1020)
```

### Responsive Scaling

```typescript
class LayoutManager {
  private baseWidth = 1920;
  private baseHeight = 1080;
  
  getScale(screenWidth: number, screenHeight: number): number {
    return Math.min(screenWidth / this.baseWidth, screenHeight / this.baseHeight);
  }
  
  // Mobile: stack jury vertically on left, cards smaller
  // Tablet: standard layout, slightly compressed
  // Desktop: full layout
  getLayout(screenWidth: number): 'mobile' | 'tablet' | 'desktop' {
    if (screenWidth < 768) return 'mobile';
    if (screenWidth < 1200) return 'tablet';
    return 'desktop';
  }
}
```

## Key Components

### JurorPortrait (PixiJS Sprite)
```typescript
class JurorPortrait extends Container {
  private portrait: Sprite;        // Current expression
  private nameLabel: Text;
  private reactionIndicator: Sprite; // Arrow up/down (high jury reading)
  private seat: number;             // 0-11
  
  // Swap expression sprite with crossfade
  setExpression(expression: ExpressionType): void;
  
  // Pulse glow when reacting
  showReaction(intensity: 'subtle' | 'moderate' | 'strong'): void;
  
  // Visibility based on jury reading skill
  setVisibility(level: number): void;
  // Level 1: portrait only, expressions hidden (show neutral)
  // Level 2: show expressions for this juror
  // Level 3: show expressions + subtle shifts
  // Level 4: show opinion arrow
  // Level 5: show opinion number
}
```

### CardSprite (PixiJS Container)
```typescript
class CardSprite extends Container {
  private cardBack: Sprite;
  private cardFront: Container;    // Art + text + cost icons
  private glowFilter: GlowFilter;
  
  // States
  setPlayable(playable: boolean): void;     // Glow vs dim
  setHovered(hovered: boolean): void;        // Scale up + detail panel
  setSelected(selected: boolean): void;      // Raise up + highlight
  
  // Card data
  setCard(card: Card): void;
  
  // Interaction
  onPointerOver(): void;   // Show detail, scale up
  onPointerOut(): void;    // Hide detail, scale down
  onPointerDown(): void;   // Select for play
}
```

### HandDisplay (PixiJS Container)
```typescript
class HandDisplay extends Container {
  private cards: CardSprite[] = [];
  
  // Fan cards in arc at bottom of screen
  layoutCards(): void {
    const fanAngle = 30; // degrees total spread
    const cardSpacing = Math.min(120, 600 / this.cards.length);
    this.cards.forEach((card, i) => {
      const angle = ((i - (this.cards.length - 1) / 2) / this.cards.length) * fanAngle;
      card.rotation = angle * (Math.PI / 180);
      card.x = centerX + (i - (this.cards.length - 1) / 2) * cardSpacing;
      card.y = baseY - Math.cos(angle * Math.PI / 180) * 20;
    });
  }
  
  // Animate new cards drawn
  animateDrawn(cards: Card[]): void;
  
  // Animate card played (fly to target area)
  animatePlayed(cardId: string, target: Point): void;
}
```

### ResourceBar (PixiJS Container)
```typescript
class ResourceBar extends Container {
  // Two bars: CP (blue) and PP (green)
  // Numeric display + fill bar
  // Animate changes (pulse on gain, shake on loss)
  updateCP(value: number, max: number): void;
  updatePP(value: number, max: number): void;
}
```

## Animations (GSAP)

### Card Play Animation
```typescript
function animateCardPlay(card: CardSprite, target: Point): Timeline {
  return gsap.timeline()
    .to(card, { y: card.y - 50, duration: 0.2, ease: 'power2.out' })
    .to(card, { x: target.x, y: target.y, scale: 0.6, duration: 0.4, ease: 'power2.inOut' })
    .to(card, { alpha: 0, duration: 0.3, delay: 1.0 });
}
```

### Juror Reaction Wave
When evidence impacts jury, reactions ripple across jury box:
```typescript
function animateJuryReaction(jurors: JurorPortrait[], reactions: ExpressionType[]): void {
  jurors.forEach((juror, i) => {
    gsap.delayedCall(i * 0.1, () => {
      juror.setExpression(reactions[i]);
      juror.showReaction('moderate');
    });
  });
}
```

### Gavel Bang
```typescript
function animateGavel(judge: JudgeBench): void {
  // Gavel sprite swings down, screen shake, sound hook
  gsap.timeline()
    .to(judge.gavel, { rotation: -0.3, duration: 0.1 })
    .to(judge.gavel, { rotation: 0, duration: 0.05 })
    .call(() => AudioManager.play('gavel'));
}
```

## Dialog / Speech System

Witness testimony and judge rulings appear in styled speech bubbles:

```typescript
class DialogBox extends Container {
  private background: NineSliceSprite;  // Scalable bubble
  private text: Text;
  private tail: Sprite;                 // Points to speaker
  
  // Typewriter effect for dramatic testimony
  showText(text: string, speed: 'fast' | 'normal' | 'dramatic'): Promise<void>;
  
  // Position tail toward speaker
  pointTo(speaker: 'judge' | 'witness' | 'prosecution' | 'defense'): void;
}
```

## Scene Transitions

- **Pre-Trial → Trial:** Camera pan from investigation board to courtroom doors opening
- **Phase changes:** Brief overlay with phase name ("CROSS-EXAMINATION"), fade in/out
- **Verdict:** Dramatic zoom to jury foreperson, slow reveal

## Mobile Considerations

- Cards at bottom use swipe gesture to browse
- Tap to select, tap target to play
- Jury box collapses to scrollable strip on small screens
- Portrait mode: courtroom stacked vertically
- Landscape mode: standard layout scaled down
