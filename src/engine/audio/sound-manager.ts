/**
 * Phase 9.3: Sound Design Hooks
 * Howler.js integration with event-based sound triggers.
 * Uses placeholder approach — sounds are optional, game works without them.
 */

import { Howl, Howler } from 'howler';

export type SoundEffect =
  | 'gavel'
  | 'card_play'
  | 'card_draw'
  | 'card_discard'
  | 'objection'
  | 'sustained'
  | 'overruled'
  | 'murmur'
  | 'gasp'
  | 'scribble'
  | 'combo'
  | 'level_up'
  | 'verdict_guilty'
  | 'verdict_not_guilty'
  | 'click'
  | 'hover'
  | 'phase_transition'
  | 'witness_break';

export type MusicTrack =
  | 'menu'
  | 'investigation'
  | 'trial_calm'
  | 'trial_tense'
  | 'deliberation'
  | 'verdict';

// Sound configuration — paths are placeholders. 
// In production, replace with actual audio files in /public/audio/
const SOUND_CONFIG: Record<SoundEffect, { src: string[]; volume: number; rate?: number }> = {
  gavel:           { src: ['/audio/sfx/gavel.mp3'], volume: 0.8 },
  card_play:       { src: ['/audio/sfx/card-play.mp3'], volume: 0.5 },
  card_draw:       { src: ['/audio/sfx/card-draw.mp3'], volume: 0.3 },
  card_discard:    { src: ['/audio/sfx/card-discard.mp3'], volume: 0.3 },
  objection:       { src: ['/audio/sfx/objection.mp3'], volume: 0.9 },
  sustained:       { src: ['/audio/sfx/sustained.mp3'], volume: 0.6 },
  overruled:       { src: ['/audio/sfx/overruled.mp3'], volume: 0.6 },
  murmur:          { src: ['/audio/sfx/murmur.mp3'], volume: 0.2 },
  gasp:            { src: ['/audio/sfx/gasp.mp3'], volume: 0.5 },
  scribble:        { src: ['/audio/sfx/scribble.mp3'], volume: 0.2 },
  combo:           { src: ['/audio/sfx/combo.mp3'], volume: 0.7 },
  level_up:        { src: ['/audio/sfx/level-up.mp3'], volume: 0.7 },
  verdict_guilty:  { src: ['/audio/sfx/verdict-guilty.mp3'], volume: 0.8 },
  verdict_not_guilty: { src: ['/audio/sfx/verdict-not-guilty.mp3'], volume: 0.8 },
  click:           { src: ['/audio/sfx/click.mp3'], volume: 0.3 },
  hover:           { src: ['/audio/sfx/hover.mp3'], volume: 0.1 },
  phase_transition:{ src: ['/audio/sfx/phase-transition.mp3'], volume: 0.6 },
  witness_break:   { src: ['/audio/sfx/witness-break.mp3'], volume: 0.7 },
};

const MUSIC_CONFIG: Record<MusicTrack, { src: string[]; volume: number; loop: boolean }> = {
  menu:          { src: ['/audio/music/menu.mp3'], volume: 0.3, loop: true },
  investigation: { src: ['/audio/music/investigation.mp3'], volume: 0.25, loop: true },
  trial_calm:    { src: ['/audio/music/trial-calm.mp3'], volume: 0.2, loop: true },
  trial_tense:   { src: ['/audio/music/trial-tense.mp3'], volume: 0.25, loop: true },
  deliberation:  { src: ['/audio/music/deliberation.mp3'], volume: 0.2, loop: true },
  verdict:       { src: ['/audio/music/verdict.mp3'], volume: 0.3, loop: false },
};

class SoundManager {
  private sounds: Map<SoundEffect, Howl> = new Map();
  private music: Map<MusicTrack, Howl> = new Map();
  private currentMusic: MusicTrack | null = null;
  private _enabled = true;
  private _musicEnabled = true;
  private _volume = 0.7;
  private _musicVolume = 0.5;
  private _initialized = false;

  get enabled() { return this._enabled; }
  get musicEnabled() { return this._musicEnabled; }
  get volume() { return this._volume; }
  get musicVolume() { return this._musicVolume; }

  /**
   * Initialize the sound manager. Call once.
   * Sounds are loaded lazily — if a file doesn't exist, it fails silently.
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;
    
    // Load settings from localStorage
    try {
      const settings = localStorage.getItem('bop-audio-settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        this._enabled = parsed.enabled ?? true;
        this._musicEnabled = parsed.musicEnabled ?? true;
        this._volume = parsed.volume ?? 0.7;
        this._musicVolume = parsed.musicVolume ?? 0.5;
      }
    } catch { /* ignore */ }

    Howler.volume(this._volume);
  }

  /** Play a sound effect. Fails silently if sound not loaded/available. */
  play(effect: SoundEffect): void {
    if (!this._enabled) return;
    
    let sound = this.sounds.get(effect);
    if (!sound) {
      const config = SOUND_CONFIG[effect];
      if (!config) return;
      sound = new Howl({
        src: config.src,
        volume: config.volume * this._volume,
        rate: config.rate ?? 1,
        onloaderror: () => {
          // Silently fail — sounds are optional
          this.sounds.delete(effect);
        },
      });
      this.sounds.set(effect, sound);
    }
    
    try {
      sound.play();
    } catch { /* silent */ }
  }

  /** Start playing a music track. Crossfades from current. */
  playMusic(track: MusicTrack): void {
    if (!this._musicEnabled) return;
    if (this.currentMusic === track) return;

    // Fade out current
    if (this.currentMusic) {
      const current = this.music.get(this.currentMusic);
      if (current) {
        current.fade(current.volume(), 0, 1000);
        const old = this.currentMusic;
        setTimeout(() => {
          current.stop();
          this.music.delete(old);
        }, 1000);
      }
    }

    // Start new
    const config = MUSIC_CONFIG[track];
    if (!config) return;

    let howl = this.music.get(track);
    if (!howl) {
      howl = new Howl({
        src: config.src,
        volume: 0,
        loop: config.loop,
        onloaderror: () => {
          this.music.delete(track);
        },
      });
      this.music.set(track, howl);
    }

    try {
      howl.play();
      howl.fade(0, config.volume * this._musicVolume, 1000);
    } catch { /* silent */ }
    
    this.currentMusic = track;
  }

  /** Stop all music */
  stopMusic(): void {
    if (this.currentMusic) {
      const current = this.music.get(this.currentMusic);
      if (current) {
        current.fade(current.volume(), 0, 500);
        setTimeout(() => current.stop(), 500);
      }
    }
    this.currentMusic = null;
  }

  /** Toggle sound effects */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.saveSettings();
  }

  /** Toggle music */
  setMusicEnabled(enabled: boolean): void {
    this._musicEnabled = enabled;
    if (!enabled) this.stopMusic();
    this.saveSettings();
  }

  /** Set master volume (0-1) */
  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    Howler.volume(this._volume);
    this.saveSettings();
  }

  /** Set music volume (0-1) */
  setMusicVolume(vol: number): void {
    this._musicVolume = Math.max(0, Math.min(1, vol));
    if (this.currentMusic) {
      const current = this.music.get(this.currentMusic);
      if (current) {
        const config = MUSIC_CONFIG[this.currentMusic];
        current.volume(config.volume * this._musicVolume);
      }
    }
    this.saveSettings();
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('bop-audio-settings', JSON.stringify({
        enabled: this._enabled,
        musicEnabled: this._musicEnabled,
        volume: this._volume,
        musicVolume: this._musicVolume,
      }));
    } catch { /* ignore */ }
  }

  /** Clean up all sounds */
  destroy(): void {
    this.sounds.forEach(s => s.unload());
    this.music.forEach(m => m.unload());
    this.sounds.clear();
    this.music.clear();
    this.currentMusic = null;
  }
}

// Singleton
export const soundManager = new SoundManager();
