import { PPQ, activeAt, frequency, positionAt, validatePiece, type Piece, type Position } from './domain.ts';

export type Frame = { tick: number; phase: 'COUNT_IN' | 'PLAYING'; beat: number; position: Position; activeMidi: number | null; attack: boolean };
export type StartOptions = { bpm: number; mode: 'silent' | 'demo' | 'follow'; sound: boolean; metronome: boolean; countIn: boolean; repeat: boolean; fromTick?: number; toTick?: number; onFrame: (frame: Frame) => void; onEnd: () => void };
type Voice = { oscillator: OscillatorNode; gain: GainNode };
type Scheduled = { at: number; duration: number; midi: number; click: boolean; accent?: boolean };

export class MusicEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.25;
  private voices = new Set<Voice>();
  private manual: { source: string; voice: Voice } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private raf = 0;
  private generation = 0;
  private running = false;
  private currentTick = 0;
  private options: StartOptions | null = null;
  private piece: Piece | null = null;
  private audioClock = false;
  private anchor = 0;
  private countStart = 0;
  private from = 0;
  private to = 0;
  private scheduled: Scheduled[] = [];
  private scheduleIndex = 0;

  async prepare(): Promise<void> {
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    if (this.context.state !== 'running') throw new Error('소리를 준비하지 못했습니다. 소리 준비를 다시 눌러 주세요.');
  }
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.015);
  }
  private voice(midi: number, at: number, duration?: number, click = false, accent = false): Voice | null {
    const ctx = this.context;
    if (!ctx || !this.master || ctx.state !== 'running') return null;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = click ? 'sine' : 'triangle';
    oscillator.frequency.value = click ? (accent ? 1500 : 1000) : frequency(midi);
    const level = click ? 0.3 : 0.4;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.008);
    if (duration != null) {
      gain.gain.setValueAtTime(level, at + Math.max(0.01, duration - 0.012));
      gain.gain.linearRampToValueAtTime(0, at + Math.max(0.02, duration));
    }
    oscillator.connect(gain); gain.connect(this.master);
    const voice = { oscillator, gain };
    this.voices.add(voice);
    oscillator.onended = () => { this.voices.delete(voice); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(at);
    if (duration != null) oscillator.stop(at + Math.max(0.02, duration) + 0.01);
    return voice;
  }
  private endVoice(voice: Voice): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(0, voice.gain.gain.value), now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 0.012);
      voice.oscillator.stop(now + 0.015);
    } catch { this.voices.delete(voice); }
  }
  audition(midi: number, source: string): void {
    if (this.running || !Number.isInteger(midi) || midi < 0 || midi > 127) return;
    if (this.manual) this.endVoice(this.manual.voice);
    const voice = this.voice(midi, this.context?.currentTime ?? 0);
    this.manual = voice ? { source, voice } : null;
  }
  release(source: string): void {
    if (this.manual?.source === source) { this.endVoice(this.manual.voice); this.manual = null; }
  }
  stop(): void {
    this.running = false;
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const voice of [...this.voices]) this.endVoice(voice);
    this.manual = null;
    this.scheduled = [];
    this.scheduleIndex = 0;
  }
  pause(): number {
    const tick = this.getTick();
    this.stop();
    this.currentTick = tick;
    return tick;
  }
  private now(): number { return this.audioClock && this.context ? this.context.currentTime : performance.now() / 1000; }
  private renderNow(): number {
    const now = this.now();
    if (this.audioClock && this.context && typeof this.context.getOutputTimestamp === 'function') {
      const stamp = this.context.getOutputTimestamp();
      const { contextTime, performanceTime } = stamp;
      if (typeof contextTime === 'number' && typeof performanceTime === 'number' && contextTime > 0 && performanceTime > 0)
        return Math.min(now, Math.max(0, contextTime + (performance.now() - performanceTime) / 1000));
    }
    return now;
  }
  private seconds(ticks: number): number { return ticks / PPQ * 60 / this.options!.bpm; }
  private getTick(): number {
    if (!this.running || !this.options) return this.currentTick;
    return Math.max(this.from, Math.min(this.to, this.from + (this.renderNow() - this.anchor) * PPQ * this.options.bpm / 60));
  }
  start(piece: Piece, options: StartOptions): void {
    this.stop();
    const errors = validatePiece(piece);
    if (errors.length) throw new Error(`수업 자료 오류: ${errors[0]}`);
    if (!Number.isFinite(options.bpm) || options.bpm < 40 || options.bpm > 120) throw new Error('속도는 40~120 BPM으로 선택해 주세요.');
    this.piece = piece;
    this.options = options;
    this.audioClock = options.mode !== 'silent' && (options.sound || options.metronome);
    if (this.audioClock && this.context?.state !== 'running') throw new Error('먼저 소리 준비를 눌러 주세요.');
    this.from = Math.max(0, options.fromTick ?? 0);
    this.to = Math.min(piece.totalTicks, options.toTick ?? piece.totalTicks);
    if (this.from >= this.to) throw new Error('재생 구간을 확인해 주세요.');
    // A selection must never begin or end in the middle of a sounding tie.
    for (const e of piece.events) if (e.tieGroupId) {
      const group = piece.events.filter(n => n.tieGroupId === e.tieGroupId);
      const first = Math.min(...group.map(n => n.startTick));
      const end = Math.max(...group.map(n => n.startTick + n.durationTick));
      if ((first < this.from && this.from < end) || (first < this.to && this.to < end)) throw new Error('붙임줄 전체를 포함하는 구간을 선택해 주세요.');
    }
    this.running = true;
    this.initializeLoop();
    const generation = this.generation;
    this.timer = setInterval(() => { if (generation === this.generation) this.pump(); }, 25);
    const draw = () => {
      if (!this.running || generation !== this.generation || !this.piece || !this.options) return;
      const now = this.renderNow();
      if (now >= this.anchor + this.seconds(this.to - this.from)) {
        if (this.options.repeat) this.initializeLoop(true);
        else {
          const done = this.options.onEnd;
          this.currentTick = this.to;
          this.stop(); done(); return;
        }
      }
      const tick = this.getTick();
      this.currentTick = tick;
      const event = activeAt(this.piece, tick);
      const countIn = this.renderNow() < this.anchor;
      const beat = countIn ? Math.max(1, Math.min(this.piece.meter, Math.floor((this.renderNow() - this.countStart) / (60 / this.options.bpm)) + 1)) : Math.floor(tick / PPQ) % this.piece.meter + 1;
      const firstTie = !event?.tieGroupId || this.piece.events.find(e => e.tieGroupId === event.tieGroupId)?.id === event.id;
      this.options.onFrame({ tick, phase: countIn ? 'COUNT_IN' : 'PLAYING', beat, position: positionAt(this.piece, tick), activeMidi: !countIn && event?.kind === 'note' ? event.midi ?? null : null, attack: !countIn && event?.kind === 'note' && firstTie && tick - event.startTick < PPQ * this.options.bpm / 60 * 0.11 });
      this.raf = requestAnimationFrame(draw);
    };
    this.pump();
    this.raf = requestAnimationFrame(draw);
  }
  private initializeLoop(repeating = false): void {
    const piece = this.piece!, options = this.options!;
    for (const voice of [...this.voices]) this.endVoice(voice);
    this.countStart = this.now() + 0.04;
    const useCountIn = repeating || options.countIn;
    this.anchor = this.countStart + (useCountIn ? piece.meter * 60 / options.bpm : 0);
    this.currentTick = this.from;
    this.scheduleIndex = 0;
    this.scheduled = [];
    if (!this.audioClock) return;
    if (useCountIn) for (let i = 0; i < piece.meter; i++) this.scheduled.push({ at: this.countStart + i * 60 / options.bpm, duration: 0.045, midi: 0, click: true, accent: i === 0 });
    if (options.metronome) for (let tick = this.from; tick < this.to; tick += PPQ) this.scheduled.push({ at: this.anchor + this.seconds(tick - this.from), duration: 0.035, midi: 0, click: true, accent: Math.floor(tick / PPQ) % piece.meter === 0 });
    if (options.sound) {
      const handled = new Set<string>();
      for (const event of piece.events) {
        if (event.kind !== 'note' || event.midi == null || event.startTick < this.from || event.startTick >= this.to) continue;
        if (event.tieGroupId && handled.has(event.tieGroupId)) continue;
        let duration = event.durationTick;
        if (event.tieGroupId) { handled.add(event.tieGroupId); duration = piece.events.filter(n => n.tieGroupId === event.tieGroupId).reduce((sum, n) => sum + n.durationTick, 0); }
        this.scheduled.push({ at: this.anchor + this.seconds(event.startTick - this.from), duration: this.seconds(duration) * (event.tieGroupId ? 1 : 0.94), midi: event.midi, click: false });
      }
    }
    this.scheduled.sort((a, b) => a.at - b.at);
  }
  private pump(): void {
    if (!this.audioClock || !this.running) return;
    const now = this.now();
    while (this.scheduleIndex < this.scheduled.length && this.scheduled[this.scheduleIndex].at <= now + 0.1) {
      const event = this.scheduled[this.scheduleIndex++];
      if (event.at < now - 0.15) { const ended = this.options?.onEnd; this.pause(); ended?.(); return; }
      this.voice(event.midi, Math.max(now, event.at), event.duration, event.click, event.accent);
    }
  }
  dispose(): void { this.stop(); void this.context?.close(); this.context = null; this.master = null; }
}
