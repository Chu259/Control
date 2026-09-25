// Web Audio API offline sound generator & haptic feedback

class AudioService {
  private audioCtx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Authentic barcode scanner beep
  playScanBeep(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 note - crisp POS beep

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);

      // Haptic vibration for Android
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(45);
      }
    } catch {
      // Ignore audio failure
    }
  }

  // Positive chime for stock in / restock
  playSuccessChime(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(now + 0.35);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 40, 60]);
      }
    } catch {
      // Ignore
    }
  }

  // Low stock warning tone
  playWarningTone(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(370, now + 0.12); // F#4

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(now + 0.3);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }
    } catch {
      // Ignore
    }
  }

  playWarningBeep(): void {
    this.playWarningTone();
  }

  // Double chime for push notification & alerts
  playNotificationChime(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.setValueAtTime(880, now + 0.1); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.5, now); // E6 overtone
      osc2.frequency.setValueAtTime(1760, now + 0.1); // A6 overtone

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.38);
      osc2.start(now);
      osc2.stop(now + 0.38);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([70, 50, 90]);
      }
    } catch {
      // Ignore
    }
  }
}

export const Sound = new AudioService();
