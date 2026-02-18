import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { ResourceBar } from '../components/ResourceBar';
import { HandDisplay } from '../components/HandDisplay';
import { useGameStore } from '../../engine/state/store';

export class CourtroomScene {
  public container: Container;
  private resourceBar: ResourceBar;
  private handDisplay: HandDisplay;

  constructor(private game: Game) {
    this.container = new Container();
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.buildBackground(w, h);
    this.buildZones(w, h);

    // Resource bar
    this.resourceBar = new ResourceBar(200, 18);
    this.resourceBar.x = w / 2;
    this.resourceBar.y = h - 30;
    this.resourceBar.updateCP(50, 100);
    this.resourceBar.updatePP(20, 50);
    this.container.addChild(this.resourceBar);

    // Hand display
    this.handDisplay = new HandDisplay(w, h);
    this.container.addChild(this.handDisplay);

    // Subscribe to store
    useGameStore.subscribe((state) => {
      this.resourceBar.updateCP(state.trial.credibilityPoints, state.trial.maxCP);
      this.resourceBar.updatePP(state.trial.preparationPoints, state.trial.maxPP);
      this.handDisplay.setCards(state.deck.hand);
      this.handDisplay.updatePlayable(state.trial.credibilityPoints, state.trial.preparationPoints);
    });
  }

  private buildBackground(w: number, h: number) {
    // Courtroom floor
    const floor = new Graphics();
    floor.rect(0, 0, w, h).fill(COLORS.floor);
    this.container.addChild(floor);

    // Back wall
    const wall = new Graphics();
    wall.rect(0, 0, w, h * 0.35).fill(COLORS.wall);
    this.container.addChild(wall);

    // Wood paneling strip
    const paneling = new Graphics();
    paneling.rect(0, h * 0.35, w, 8).fill(COLORS.judgeBench);
    this.container.addChild(paneling);
  }

  private buildZones(w: number, h: number) {
    // Judge bench
    this.addZone(w * 0.35, h * 0.02, w * 0.3, h * 0.14, COLORS.judgeBench, 'JUDGE', w);

    // Judge character placeholder
    const judgeChar = new Graphics();
    judgeChar.circle(w * 0.5, h * 0.12, 25).fill(0x888888);
    judgeChar.circle(w * 0.5, h * 0.12, 25).stroke({ color: COLORS.gold, width: 2 });
    this.container.addChild(judgeChar);
    this.addLabel(w * 0.5, h * 0.17, 'Hon. Morrison', COLORS.gold);

    // Witness stand
    this.addZone(w * 0.15, h * 0.2, w * 0.16, h * 0.2, COLORS.witnessStand, 'WITNESS', w);

    // Witness placeholder
    const witnessChar = new Graphics();
    witnessChar.circle(w * 0.23, h * 0.28, 20).fill(0x777777);
    witnessChar.circle(w * 0.23, h * 0.28, 20).stroke({ color: COLORS.textDim, width: 1.5 });
    this.container.addChild(witnessChar);

    // Jury box (2 rows of 6)
    const juryX = w * 0.02;
    const juryY = h * 0.42;
    const juryW = w * 0.14;
    const juryH = h * 0.38;
    this.addZone(juryX, juryY, juryW, juryH, COLORS.juryBox, 'JURY BOX', w);

    // Juror seats (12 circles)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) {
        const jx = juryX + 20 + col * (juryW - 30) / 5;
        const jy = juryY + 30 + row * (juryH - 40) / 1.5;
        const seat = new Graphics();
        seat.circle(jx, jy, 12).fill(0x555555);
        seat.circle(jx, jy, 12).stroke({ color: COLORS.textDim, width: 1 });
        this.container.addChild(seat);
      }
    }

    // Prosecution table
    this.addZone(w * 0.55, h * 0.5, w * 0.2, h * 0.1, COLORS.counselTable, 'PROSECUTION', w);

    // Defense table
    this.addZone(w * 0.22, h * 0.5, w * 0.2, h * 0.1, COLORS.counselTable, 'DEFENSE', w);

    // Defense character (player)
    const defChar = new Graphics();
    defChar.circle(w * 0.32, h * 0.54, 18).fill(COLORS.cpBar);
    defChar.circle(w * 0.32, h * 0.54, 18).stroke({ color: COLORS.textLight, width: 1.5 });
    this.container.addChild(defChar);
    this.addLabel(w * 0.32, h * 0.58, 'You', COLORS.textLight);

    // Prosecution character
    const prosChar = new Graphics();
    prosChar.circle(w * 0.65, h * 0.54, 18).fill(COLORS.accent);
    prosChar.circle(w * 0.65, h * 0.54, 18).stroke({ color: COLORS.textLight, width: 1.5 });
    this.container.addChild(prosChar);
    this.addLabel(w * 0.65, h * 0.58, 'ADA Chen', COLORS.textDim);

    // Gallery area
    const gallery = new Graphics();
    gallery.rect(w * 0.78, h * 0.2, w * 0.2, h * 0.4).fill({ color: 0x3D2B1F, alpha: 0.3 });
    this.container.addChild(gallery);
    this.addLabel(w * 0.88, h * 0.38, 'Gallery', COLORS.textDim);

    // Phase indicator
    const phaseBar = new Graphics();
    phaseBar.roundRect(w * 0.35, h * 0.64, w * 0.3, 30, 4).fill({ color: COLORS.panelDark, alpha: 0.9 });
    phaseBar.roundRect(w * 0.35, h * 0.64, w * 0.3, 30, 4).stroke({ color: COLORS.gold, width: 1 });
    this.container.addChild(phaseBar);
    const phaseText = new Text({
      text: '⚖️  TRIAL IN SESSION  ⚖️',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 14, fill: COLORS.gold, letterSpacing: 2 }),
    });
    phaseText.anchor.set(0.5);
    phaseText.x = w * 0.5;
    phaseText.y = h * 0.64 + 15;
    this.container.addChild(phaseText);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private addZone(x: number, y: number, w: number, h: number, color: number, label: string, screenW?: number) {
    const zone = new Graphics();
    zone.roundRect(x, y, w, h, 6).fill({ color, alpha: 0.7 });
    zone.roundRect(x, y, w, h, 6).stroke({ color: COLORS.gold, width: 1, alpha: 0.3 });
    this.container.addChild(zone);
    this.addLabel(x + w / 2, y + h - 14, label, COLORS.textDim);
  }

  private addLabel(x: number, y: number, text: string, color: number) {
    const t = new Text({
      text,
      style: new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 11, fill: color, letterSpacing: 1 }),
    });
    t.anchor.set(0.5);
    t.x = x;
    t.y = y;
    this.container.addChild(t);
  }
}
