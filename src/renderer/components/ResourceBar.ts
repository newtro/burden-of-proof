import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS } from '../../lib/constants';

export class ResourceBar extends Container {
  private cpFill: Graphics;
  private ppFill: Graphics;
  private cpText: Text;
  private ppText: Text;
  private barWidth: number;
  private barHeight: number;

  constructor(width: number = 240, height: number = 20) {
    super();
    this.barWidth = width;
    this.barHeight = height;

    const gap = 16;
    const totalW = width * 2 + gap;

    // CP label
    const cpLabel = new Text({ text: 'CP', style: this.labelStyle() });
    cpLabel.x = -totalW / 2 - 30;
    cpLabel.y = -this.barHeight / 2;
    this.addChild(cpLabel);

    // CP bar bg
    const cpBg = new Graphics();
    cpBg.roundRect(-totalW / 2, -this.barHeight / 2, width, this.barHeight, 4).fill(COLORS.barBg);
    this.addChild(cpBg);

    // CP bar fill
    this.cpFill = new Graphics();
    this.addChild(this.cpFill);

    // CP text
    this.cpText = new Text({ text: '50/100', style: this.valStyle() });
    this.cpText.anchor.set(0.5);
    this.cpText.x = -totalW / 2 + width / 2;
    this.cpText.y = 0;
    this.addChild(this.cpText);

    // PP label
    const ppLabel = new Text({ text: 'PP', style: this.labelStyle(COLORS.ppBar) });
    ppLabel.x = gap / 2 - 30;
    ppLabel.y = -this.barHeight / 2;
    this.addChild(ppLabel);

    // PP bar bg
    const ppBg = new Graphics();
    ppBg.roundRect(gap / 2, -this.barHeight / 2, width, this.barHeight, 4).fill(COLORS.barBg);
    this.addChild(ppBg);

    this.ppFill = new Graphics();
    this.addChild(this.ppFill);

    this.ppText = new Text({ text: '20/50', style: this.valStyle() });
    this.ppText.anchor.set(0.5);
    this.ppText.x = gap / 2 + width / 2;
    this.ppText.y = 0;
    this.addChild(this.ppText);
  }

  updateCP(value: number, max: number) {
    const totalW = this.barWidth * 2 + 16;
    const pct = Math.max(0, Math.min(1, value / max));
    this.cpFill.clear();
    this.cpFill.roundRect(-totalW / 2 + 1, -this.barHeight / 2 + 1, (this.barWidth - 2) * pct, this.barHeight - 2, 3).fill(COLORS.cpBar);
    this.cpText.text = `${value}/${max}`;
  }

  updatePP(value: number, max: number) {
    const gap = 16;
    const pct = Math.max(0, Math.min(1, value / max));
    this.ppFill.clear();
    this.ppFill.roundRect(gap / 2 + 1, -this.barHeight / 2 + 1, (this.barWidth - 2) * pct, this.barHeight - 2, 3).fill(COLORS.ppBar);
    this.ppText.text = `${value}/${max}`;
  }

  private labelStyle(color: number = COLORS.cpBar) {
    return new TextStyle({ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: color });
  }
  private valStyle() {
    return new TextStyle({ fontFamily: 'monospace', fontSize: 12, fill: COLORS.textLight });
  }
}
