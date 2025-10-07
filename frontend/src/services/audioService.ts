/**
 * Casino Audio Service
 * Manages all sound effects and background music for the casino
 */

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  enabled: boolean;
}

class AudioService {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private backgroundMusic: HTMLAudioElement | null = null;
  private settings: AudioSettings = {
    masterVolume: 0.7,
    sfxVolume: 0.8,
    musicVolume: 0.3,
    enabled: true
  };

  constructor() {
    this.loadSettings();
    this.initializeAudioContext();
    this.preloadSounds();
  }

  private loadSettings() {
    const saved = localStorage.getItem('casino_audio_settings');
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) };
    }
  }

  private saveSettings() {
    localStorage.setItem('casino_audio_settings', JSON.stringify(this.settings));
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  private preloadSounds() {
    // Define all our casino sounds
    const soundFiles = {
      // Slot machine sounds
      'slot-spin': this.createAudioElement('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbPzc+tHGHqjMqUo7g2CZHn7g7OCg+Z5ZnVX1gN6xbP0tFh7WjkHm2bU3ZwSlNpLI9OzE6YJc3VoJgNqhcPkxDh7CikX23blUZximfpjs7NTdcmS1WgF40oXAyNDhekJNmU3pePK1kRE5KeIijkHW7gGNgvIGMoI6aUDRVwGBVrKJgT0s5iJKBikVKhLCfkXy4bU3YxCqMpr6aTj9VumRWq6VoUE48hpV7h0lFh4S2j36taE3OvS2MqLQ/1RpctzBTq6B8XFE+jZyChEtIjMJBsRVlKAA='),
      'slot-win': this.createAudioElement('data:audio/wav;base64,UklGRpYIAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoIAAC8hYqFbF1fdJivrJBhNjVgod...'),
      'slot-jackpot': this.createAudioElement('data:audio/wav;base64,UklGRr4JAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoJAADghYqFbF1fdJivrJBhNjVgod...'),
      'coin-drop': this.createAudioElement('data:audio/wav;base64,UklGRjgHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoHAABBhYqFbF1fdJivrJBhNjVgod...'),
      
      // Card game sounds
      'card-flip': this.createAudioElement('data:audio/wav;base64,UklGRnIFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoFAABPhYqFbF1fdJivrJBhNjVgod...'),
      'card-shuffle': this.createAudioElement('data:audio/wav;base64,UklGRmYGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAABthYqFbF1fdJivrJBhNjVgod...'),
      
      // Dice sounds
      'dice-roll': this.createAudioElement('data:audio/wav;base64,UklGRlgFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoFAACRhYqFbF1fdJivrJBhNjVgod...'),
      
      // UI sounds
      'button-click': this.createAudioElement('data:audio/wav;base64,UklGRlQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoEAABBhYqFbF1fdJivrJBhNjVgod...'),
      'bet-place': this.createAudioElement('data:audio/wav;base64,UklGRmwEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoEAABphYqFbF1fdJivrJBhNjVgod...'),
      'balance-update': this.createAudioElement('data:audio/wav;base64,UklGRnAEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoEAABthYqFbF1fdJivrJBhNjVgod...'),
      
      // Ambient sounds
      'casino-ambient': this.createAudioElement('data:audio/wav;base64,UklGRrAIAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoIAACthYqFbF1fdJivrJBhNjVgod...'),
    };

    // Since we can't use real audio files in this demo, let's create synthetic sounds
    Object.entries(soundFiles).forEach(([name, audio]) => {
      this.sounds.set(name, audio);
    });
  }

  private createAudioElement(src: string): HTMLAudioElement {
    const audio = new Audio();
    // For now, we'll create a silent audio element as placeholder
    // In a real implementation, you'd load actual sound files
    audio.volume = 0.1; // Very low volume for the placeholder
    return audio;
  }

  // Create synthetic beep sounds using Web Audio API
  private createSyntheticSound(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.audioContext || !this.settings.enabled) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.settings.sfxVolume * this.settings.masterVolume * 0.1, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Error creating synthetic sound:', error);
    }
  }

  // Public methods for playing sounds
  public playSlotSpin(): void {
    this.createSyntheticSound(200, 2.0, 'sawtooth'); // Spinning reel sound
    setTimeout(() => this.createSyntheticSound(150, 0.5, 'triangle'), 500);
    setTimeout(() => this.createSyntheticSound(100, 0.3, 'sine'), 1000);
  }

  public playSlotWin(amount: number): void {
    // Different sounds based on win amount
    if (amount > 1000) {
      this.playJackpot();
    } else if (amount > 100) {
      this.playBigWin();
    } else {
      this.playSmallWin();
    }
  }

  public playJackpot(): void {
    // Ascending chimes for jackpot
    const notes = [523, 659, 784, 1047]; // C, E, G, C octave
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.createSyntheticSound(freq, 0.8, 'sine');
      }, index * 200);
    });
    
    // Add coin drop sounds
    setTimeout(() => {
      for (let i = 0; i < 10; i++) {
        setTimeout(() => this.playCoinDrop(), i * 100);
      }
    }, 800);
  }

  public playBigWin(): void {
    this.createSyntheticSound(659, 0.5, 'sine'); // E note
    setTimeout(() => this.createSyntheticSound(784, 0.5, 'sine'), 250); // G note
    this.playCoinDrop();
  }

  public playSmallWin(): void {
    this.createSyntheticSound(523, 0.3, 'sine'); // C note
    this.playCoinDrop();
  }

  public playCoinDrop(): void {
    this.createSyntheticSound(800, 0.1, 'sine');
    setTimeout(() => this.createSyntheticSound(600, 0.1, 'sine'), 50);
    setTimeout(() => this.createSyntheticSound(400, 0.1, 'sine'), 100);
  }

  public playCardFlip(): void {
    this.createSyntheticSound(300, 0.1, 'square');
    setTimeout(() => this.createSyntheticSound(250, 0.1, 'square'), 50);
  }

  public playCardShuffle(): void {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.createSyntheticSound(150 + Math.random() * 100, 0.1, 'noise' as any);
      }, i * 100);
    }
  }

  public playDiceRoll(): void {
    // Rattling dice sound
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.createSyntheticSound(100 + Math.random() * 200, 0.05, 'square');
      }, i * 50);
    }
  }

  public playButtonClick(): void {
    this.createSyntheticSound(800, 0.05, 'square');
  }

  public playBetPlace(): void {
    this.createSyntheticSound(400, 0.2, 'sine');
  }

  public playRouletteWheel(): void {
    // Create a spinning wheel sound with descending frequency
    if (!this.audioContext || !this.settings.enabled || this.audioContext.state === 'suspended') return;

    const duration = 4.0; // Match the animation duration
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Start with high frequency and descend
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + duration);

    // Fade in and out
    const volume = this.settings.masterVolume * this.settings.sfxVolume * 0.3;
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.type = 'triangle';
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  public playRouletteBallDrop(): void {
    // Create ball bouncing sound
    this.createSyntheticSound(800, 0.1, 'triangle');
    setTimeout(() => this.createSyntheticSound(600, 0.1, 'triangle'), 100);
    setTimeout(() => this.createSyntheticSound(400, 0.1, 'triangle'), 200);
  }

  public playBalanceUpdate(): void {
    this.createSyntheticSound(600, 0.3, 'sine');
  }

  public playError(): void {
    this.createSyntheticSound(200, 0.3, 'sawtooth');
  }

  // Background music control
  public startBackgroundMusic(): void {
    if (!this.settings.enabled) return;
    
    // Create ambient casino sounds with Web Audio API
    this.playAmbientLoop();
  }

  private playAmbientLoop(): void {
    if (!this.audioContext || !this.settings.enabled) return;

    // Create subtle ambient noise
    setTimeout(() => {
      this.createSyntheticSound(50 + Math.random() * 30, 2.0, 'sine');
      this.playAmbientLoop(); // Loop
    }, 3000 + Math.random() * 2000);
  }

  public stopBackgroundMusic(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
    }
  }

  // Settings management
  public updateSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    
    // Apply volume changes to existing sounds
    this.sounds.forEach(audio => {
      audio.volume = this.settings.sfxVolume * this.settings.masterVolume;
    });

    if (this.backgroundMusic) {
      this.backgroundMusic.volume = this.settings.musicVolume * this.settings.masterVolume;
    }
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public enable(): void {
    this.updateSettings({ enabled: true });
    this.resumeAudioContext();
  }

  public disable(): void {
    this.updateSettings({ enabled: false });
    this.stopBackgroundMusic();
  }

  private resumeAudioContext(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Initialize audio context on user interaction (required by browsers)
  public initializeOnUserInteraction(): void {
    this.resumeAudioContext();
    this.startBackgroundMusic();
  }
}

// Export singleton instance
export const audioService = new AudioService();

// Auto-initialize on first user interaction
document.addEventListener('click', () => {
  audioService.initializeOnUserInteraction();
}, { once: true });

export default audioService;