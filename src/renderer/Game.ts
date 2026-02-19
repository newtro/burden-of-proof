import { Application, Container } from 'pixi.js';
import { COLORS } from '../lib/constants';
import { MenuScene } from './scenes/MenuScene';
import { CaseSelectScene } from './scenes/CaseSelectScene';
import { CourtroomScene } from './scenes/CourtroomScene';
import { PreTrialScene } from './scenes/PreTrialScene';
import { JurySelectionScene } from './scenes/JurySelectionScene';
import { DeckReviewScene } from './scenes/DeckReviewScene';
import { VerdictScene } from './scenes/VerdictScene';
import { DeliberationScene } from './scenes/DeliberationScene';

export type SceneName = 'menu' | 'caseSelect' | 'pretrial' | 'jurySelection' | 'deckReview' | 'courtroom' | 'deliberation' | 'verdict';

export class Game {
  public app: Application;
  private sceneContainer: Container;
  private currentScene: SceneName = 'menu';
  private scenes: Map<SceneName, Container> = new Map();
  private _initialized = false;

  // Keep references for special method calls
  private courtroomScene: CourtroomScene | null = null;
  private verdictScene: VerdictScene | null = null;
  private deliberationScene: DeliberationScene | null = null;

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
    const caseSelect = new CaseSelectScene(this);
    const pretrial = new PreTrialScene(this);
    const jurySelection = new JurySelectionScene(this);
    const deckReview = new DeckReviewScene(this);
    this.courtroomScene = new CourtroomScene(this);
    this.deliberationScene = new DeliberationScene(this);
    this.verdictScene = new VerdictScene(this);

    this.scenes.set('menu', menu.container);
    this.scenes.set('caseSelect', caseSelect.container);
    this.scenes.set('pretrial', pretrial.container);
    this.scenes.set('jurySelection', jurySelection.container);
    this.scenes.set('deckReview', deckReview.container);
    this.scenes.set('courtroom', this.courtroomScene.container);
    this.scenes.set('deliberation', this.deliberationScene.container);
    this.scenes.set('verdict', this.verdictScene.container);

    this.switchScene('menu');
    this._initialized = true;
  }

  switchScene(name: SceneName) {
    this.sceneContainer.removeChildren();
    const scene = this.scenes.get(name);
    if (scene) {
      this.sceneContainer.addChild(scene);
      this.currentScene = name;

      // Auto-start trial when entering courtroom
      if (name === 'courtroom' && this.courtroomScene) {
        this.courtroomScene.beginTrial();
      }
    }
  }

  getCourtroomScene(): CourtroomScene | null { return this.courtroomScene; }
  getVerdictScene(): VerdictScene | null { return this.verdictScene; }
  getDeliberationScene(): DeliberationScene | null { return this.deliberationScene; }

  get width() { return this.app.screen.width; }
  get height() { return this.app.screen.height; }

  destroy() {
    this.courtroomScene?.destroy();
    this.app.destroy(true);
    this._initialized = false;
  }
}
