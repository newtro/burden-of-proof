import { Application, Container } from 'pixi.js';
import { COLORS } from '../lib/constants';
import { MenuScene } from './scenes/MenuScene';
import { CourtroomScene } from './scenes/CourtroomScene';
import { PreTrialScene } from './scenes/PreTrialScene';
import { JurySelectionScene } from './scenes/JurySelectionScene';
import { DeckReviewScene } from './scenes/DeckReviewScene';

export type SceneName = 'menu' | 'pretrial' | 'jurySelection' | 'deckReview' | 'courtroom' | 'verdict';

export class Game {
  public app: Application;
  private sceneContainer: Container;
  private currentScene: SceneName = 'menu';
  private scenes: Map<SceneName, Container> = new Map();
  private _initialized = false;

  constructor() {
    this.app = new Application();
    this.sceneContainer = new Container();
  }

  async init(canvas: HTMLCanvasElement) {
    if (this._initialized) return;
    await this.app.init({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: COLORS.background,
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.app.stage.addChild(this.sceneContainer);

    // Create scenes
    const menu = new MenuScene(this);
    const pretrial = new PreTrialScene(this);
    const jurySelection = new JurySelectionScene(this);
    const deckReview = new DeckReviewScene(this);
    const courtroom = new CourtroomScene(this);
    this.scenes.set('menu', menu.container);
    this.scenes.set('pretrial', pretrial.container);
    this.scenes.set('jurySelection', jurySelection.container);
    this.scenes.set('deckReview', deckReview.container);
    this.scenes.set('courtroom', courtroom.container);

    this.switchScene('menu');
    this._initialized = true;
  }

  switchScene(name: SceneName) {
    this.sceneContainer.removeChildren();
    const scene = this.scenes.get(name);
    if (scene) {
      this.sceneContainer.addChild(scene);
      this.currentScene = name;
    }
  }

  get width() { return this.app.screen.width; }
  get height() { return this.app.screen.height; }

  destroy() {
    this.app.destroy(true);
    this._initialized = false;
  }
}
