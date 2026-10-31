import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PPQ, frequency, pitchName, solfege, fingerFor, positionAt,
  activeAt, safeRestartTick, validatePiece,
} from './domain.ts';
import type { NoteEvent, Piece } from './domain.ts';
import { MusicEngine } from './audio.ts';

const note = (id: string, startTick: number, midi: number, durationTick = PPQ): NoteEvent => ({
  id, kind: 'note', startTick, durationTick, midi,
  finger: fingerFor(midi, 'c-position'), positionId: 'c-position',
});
const steps = (): Piece => ({
  id: 'test-steps', title: '검증용 작은 계단', meter: 4,
  initialPositionId: 'c-position', totalTicks: 8 * PPQ,
  events: [60, 62, 64, 65, 67, 65, 64, 62].map((midi, i) => note(`n${i}`, i * PPQ, midi)),
});
const moved = (): Piece => ({
  id: 'test-move', title: '검증용 손자리 이동', meter: 4,
  initialPositionId: 'c-position', totalTicks: 8 * PPQ,
  events: [
    note('c', 0, 60, 2880),
    { id: 'rest', kind: 'rest', startTick: 2880, durationTick: 1920 },
    { id: 'f', kind: 'note', startTick: 4800, durationTick: 2880, midi: 65, finger: 1, positionId: 'f-position' },
  ],
  cues: [{ startTick: 3500, durationTick: 700, from: 'c-position', to: 'f-position' }],
});

test('음높이는 옥타브와 파샤프를 구별하며 A4=440Hz이다', () => {
  assert.equal(PPQ, 960);
  assert.equal(pitchName(60), 'C4');
  assert.equal(pitchName(72), 'C5');
  assert.ok(['F#4', 'F♯4'].includes(pitchName(66)));
  assert.equal(solfege(60), '도');
  assert.equal(frequency(69), 440);
  assert.ok(Math.abs(frequency(66) - 369.9944) < 0.001);
  assert.equal(frequency(72) / frequency(60), 2);
});

test('같은 파의 손번호는 현재 손자리에 따라 다르다', () => {
  assert.equal(fingerFor(65, 'c-position'), 4);
  assert.equal(fingerFor(65, 'f-position'), 1);
  assert.equal(fingerFor(69, 'c-position'), null);
  assert.equal(fingerFor(60, 'f-position'), null);
  assert.equal(fingerFor(66, 'c-position'), null);
});

test('원자료 작은 계단의 두 마디 음·운지·8박은 유효하다', () => {
  const piece = steps();
  assert.deepEqual(validatePiece(piece), []);
  assert.equal(piece.events.at(-1)?.midi, 62);
  assert.equal(activeAt(piece, 959)?.midi, 60);
  assert.equal(activeAt(piece, 960)?.midi, 62);
  assert.equal(activeAt(piece, 7680), null);
});

test('빈 시간과 중첩은 묵시적 쉼으로 숨기지 않는다', () => {
  const gap = steps();
  gap.events[1].startTick += 10;
  assert.ok(validatePiece(gap).length > 0);
  const overlap = steps();
  overlap.events[1].startTick -= 10;
  assert.ok(validatePiece(overlap).length > 0);
});

test('손자리 cue는 쉬는 구간에서 끝난 뒤에만 활성 위치를 바꾼다', () => {
  const piece = moved();
  assert.deepEqual(validatePiece(piece), []);
  assert.equal(positionAt(piece, 3499), 'c-position');
  assert.equal(positionAt(piece, 4199), 'c-position');
  assert.equal(positionAt(piece, 4200), 'f-position');
  assert.equal(positionAt(piece, 6000), 'f-position');
  const rest = activeAt(piece, 4000);
  assert.ok(rest === null || rest.kind === 'rest');
});

test('소리 구간의 손자리 이동과 cue 없는 위치 변경은 거부한다', () => {
  const soundingMove = moved();
  soundingMove.cues![0].startTick = 1000;
  assert.ok(validatePiece(soundingMove).length > 0);
  const falsePosition = steps();
  falsePosition.events[3].positionId = 'f-position';
  falsePosition.events[3].finger = 1;
  assert.ok(validatePiece(falsePosition).length > 0);
});

test('일시정지 재시작은 보통 현재 마디 처음이다', () => {
  assert.equal(safeRestartTick(steps(), 4500), 3840);
  assert.equal(safeRestartTick(steps(), 200), 0);
});

test('마디 경계가 붙임줄 중간이면 그룹 시작을 포함한 마디로 복귀한다', () => {
  const piece: Piece = {
    ...steps(), events: [
      note('before', 0, 60, 2880),
      { ...note('tie-a', 2880, 62), tieGroupId: 'tie-1' },
      { ...note('tie-b', 3840, 62), tieGroupId: 'tie-1' },
      { id: 'end-rest', kind: 'rest', startTick: 4800, durationTick: 2880 },
    ],
  };
  assert.deepEqual(validatePiece(piece), []);
  assert.equal(safeRestartTick(piece, 4500), 0);
  piece.events[2].midi = 64;
  piece.events[2].finger = 3;
  assert.ok(validatePiece(piece).length > 0);
});

test('마디 경계가 이동 cue 중간이면 이동 시작 마디로 복귀한다', () => {
  assert.equal(safeRestartTick(moved(), 4500), 0);
  assert.equal(positionAt(moved(), safeRestartTick(moved(), 4500)), 'c-position');
});

// Scheduling tests inspect Web Audio commands; they do not claim actual speaker listening.
class FakeParam {
  value = 0;
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  setTargetAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {}
}
class FakeGain { gain = new FakeParam(); connect() {} disconnect() {} }
class FakeOscillator {
  type = 'sine'; frequency = new FakeParam(); onended: (() => void) | null = null;
  starts: number[] = []; stops: number[] = [];
  connect() {} disconnect() {}
  start(at: number) { this.starts.push(at); }
  stop(at: number) { this.stops.push(at); }
}
class FakeContext {
  static last: FakeContext | null = null;
  currentTime = 0; state = 'running'; destination = {};
  oscillators: FakeOscillator[] = [];
  constructor() { FakeContext.last = this; }
  createGain() { return new FakeGain(); }
  createOscillator() { const node = new FakeOscillator(); this.oscillators.push(node); return node; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}
async function fakeAudio(run: (engine: MusicEngine) => Promise<void> | void) {
  const globals = globalThis as unknown as Record<string, unknown>;
  const originals = Object.fromEntries(['AudioContext', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, globals[key]]));
  globals.AudioContext = FakeContext;
  globals.requestAnimationFrame = () => 1;
  globals.cancelAnimationFrame = () => {};
  FakeContext.last = null;
  const engine = new MusicEngine();
  try { await run(engine); } finally { engine.dispose(); for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globals[key]; else globals[key] = value; } }
}
const playback = { bpm: 120, mode: 'demo' as const, sound: true, metronome: false, countIn: false, repeat: false, onFrame: () => {}, onEnd: () => {} };

test('붙임줄 두 음은 한 voice로 2박 지속하며 정지는 예약 voice도 취소한다', async () => {
  await fakeAudio(async engine => {
    await engine.prepare();
    const piece: Piece = { ...steps(), totalTicks: 1920, events: [
      { ...note('a', 0, 60), tieGroupId: 't' },
      { ...note('b', 960, 60), tieGroupId: 't' },
    ] };
    engine.start(piece, playback);
    const nodes = FakeContext.last!.oscillators;
    assert.equal(nodes.length, 1);
    assert.ok(Math.abs(nodes[0].stops[0] - nodes[0].starts[0] - 1.01) < 0.00001);
    engine.stop();
    assert.equal(nodes[0].stops.length, 2);
    assert.ok(nodes[0].stops[1] < nodes[0].starts[0]);
  });
});

test('동일 건반 유지 텅잉은 어택 네 번이며 완전무음은 오디오 자원을 만들지 않는다', async () => {
  await fakeAudio(async engine => {
    const piece: Piece = { ...steps(), totalTicks: 3840, events: [0, 1, 2, 3].map(i => ({ ...note(`t${i}`, i * 960, 60), keyHoldGroupId: 'held' })) };
    engine.start(piece, { ...playback, mode: 'silent', metronome: true });
    assert.equal(FakeContext.last, null);
    engine.stop();
    await engine.prepare();
    engine.start(piece, playback);
    const context = FakeContext.last!;
    for (const time of [0.5, 1, 1.5]) { context.currentTime = time; (engine as unknown as { pump(): void }).pump(); }
    assert.equal(context.oscillators.length, 4);
    engine.stop();
    assert.ok(context.oscillators.every(node => node.stops.length === 2));
  });
});

test('이전 입력 해제는 마지막 입력이 소유한 수동 음을 끊지 않는다', async () => {
  await fakeAudio(async engine => {
    await engine.prepare();
    engine.audition(60, 'keyboard:Digit1');
    engine.audition(62, 'pointer:7');
    const nodes = FakeContext.last!.oscillators;
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].stops.length, 1);
    engine.release('keyboard:Digit1');
    assert.equal(nodes[1].stops.length, 0);
    engine.release('pointer:7');
    assert.equal(nodes[1].stops.length, 1);
  });
});
