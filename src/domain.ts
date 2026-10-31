export const PPQ = 960;
export type Position = 'c-position' | 'f-position';
export type NoteEvent = {
  id: string; kind: 'note' | 'rest'; startTick: number; durationTick: number;
  midi?: number; finger?: number | null; positionId?: Position;
  tieGroupId?: string; keyHoldGroupId?: string;
};
export type PositionCue = { startTick: number; durationTick: number; from: Position; to: Position };
export type Piece = {
  id: string; title: string; events: NoteEvent[]; totalTicks: number;
  initialPositionId: Position; meter: 3 | 4; cues?: PositionCue[];
};
export const POSITIONS: Record<Position, Record<number, number>> = {
  'c-position': { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 },
  'f-position': { 65: 1, 67: 2, 69: 3, 71: 4, 72: 5 },
};
const SOLFEGE = ['도', '도♯', '레', '레♯', '미', '파', '파♯', '솔', '솔♯', '라', '라♯', '시'];
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function solfege(midi: number): string { return SOLFEGE[((midi % 12) + 12) % 12]; }
export function pitchName(midi: number): string { return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`; }
export function frequency(midi: number): number { return 440 * 2 ** ((midi - 69) / 12); }
export function fingerFor(midi: number, position: Position): number | null { return POSITIONS[position]?.[midi] ?? null; }
export function isBlack(midi: number): boolean { return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12); }
export function rangeKeys(low: number, high: number): number[] { return Array.from({ length: Math.max(0, high - low + 1) }, (_, i) => low + i); }
export function positionAt(piece: Piece, tick: number): Position {
  return [...(piece.cues ?? [])].sort((a, b) => a.startTick - b.startTick)
    .reduce((position, cue) => cue.startTick + cue.durationTick <= tick ? cue.to : position, piece.initialPositionId);
}
export function activeAt(piece: Piece, tick: number): NoteEvent | null {
  return piece.events.find(e => e.startTick <= tick && e.startTick + e.durationTick > tick) ?? null;
}
export function safeRestartTick(piece: Piece, tick: number): number {
  const bar = piece.meter * PPQ;
  let start = Math.floor(Math.max(0, Math.min(tick, Math.max(0, piece.totalTicks - 1))) / bar) * bar;
  for (let iteration = 0; iteration <= piece.events.length + (piece.cues?.length ?? 0); iteration++) {
    let next = start;
    const groups = new Map<string, NoteEvent[]>();
    for (const e of piece.events) if (e.tieGroupId) groups.set(e.tieGroupId, [...(groups.get(e.tieGroupId) ?? []), e]);
    for (const group of groups.values()) {
      const first = Math.min(...group.map(e => e.startTick));
      const end = Math.max(...group.map(e => e.startTick + e.durationTick));
      if (first < start && start < end) next = Math.min(next, Math.floor(first / bar) * bar);
    }
    for (const cue of piece.cues ?? []) if (cue.startTick < start && start < cue.startTick + cue.durationTick)
      next = Math.min(next, Math.floor(cue.startTick / bar) * bar);
    if (next === start) return start;
    start = next;
  }
  return 0;
}
export function validatePiece(piece: Piece): string[] {
  const errors: string[] = [];
  const events = [...piece.events].sort((a, b) => a.startTick - b.startTick);
  const ids = new Set<string>();
  let end = 0;
  if (![3, 4].includes(piece.meter)) errors.push('지원하지 않는 박자');
  if (!Number.isInteger(piece.totalTicks) || piece.totalTicks <= 0) errors.push('잘못된 전체 길이');
  if (!POSITIONS[piece.initialPositionId]) errors.push('잘못된 시작 손자리');
  for (const e of events) {
    if (ids.has(e.id)) errors.push(`중복 ID: ${e.id}`);
    ids.add(e.id);
    if (!Number.isInteger(e.startTick) || !Number.isInteger(e.durationTick) || e.startTick < 0 || e.durationTick <= 0) errors.push(`잘못된 tick: ${e.id}`);
    if (e.startTick !== end) errors.push(`${e.startTick < end ? '중첩' : '빈 구간'}: ${e.id}`);
    end = e.startTick + e.durationTick;
    if (e.kind === 'note') {
      if (e.midi == null || !Number.isInteger(e.midi) || e.midi < 0 || e.midi > 127) errors.push(`잘못된 MIDI: ${e.id}`);
      const pos = positionAt(piece, e.startTick);
      if (e.positionId && e.positionId !== pos) errors.push(`손자리 타임라인 불일치: ${e.id}`);
      if (e.midi != null && e.finger != null && fingerFor(e.midi, pos) !== e.finger) errors.push(`손번호 불일치: ${e.id}`);
    } else if (e.midi != null || e.tieGroupId || e.keyHoldGroupId) errors.push(`쉼표의 음 정보: ${e.id}`);
  }
  if (end !== piece.totalTicks) errors.push('전체 길이 불일치');
  let position = piece.initialPositionId;
  let previousCueEnd = -1;
  for (const cue of [...(piece.cues ?? [])].sort((a, b) => a.startTick - b.startTick)) {
    if (!Number.isInteger(cue.startTick) || !Number.isInteger(cue.durationTick) || cue.durationTick <= 0 || cue.startTick < 0 || cue.startTick + cue.durationTick > piece.totalTicks) errors.push('잘못된 손자리 cue 길이');
    if (cue.startTick < previousCueEnd) errors.push('겹친 손자리 cue');
    if (cue.from !== position || !POSITIONS[cue.to]) errors.push('손자리 cue 시작 불일치');
    if (!events.some(e => e.kind === 'rest' && e.startTick <= cue.startTick && e.startTick + e.durationTick >= cue.startTick + cue.durationTick)) errors.push('쉼 밖의 손자리 이동');
    previousCueEnd = cue.startTick + cue.durationTick;
    position = cue.to;
  }
  for (const key of ['tieGroupId', 'keyHoldGroupId'] as const) {
    const groups = new Map<string, NoteEvent[]>();
    for (const e of events) if (e[key]) groups.set(e[key]!, [...(groups.get(e[key]!) ?? []), e]);
    for (const [id, group] of groups) {
      if (group.length < 2) errors.push(`한 음뿐인 ${key}: ${id}`);
      for (let i = 1; i < group.length; i++) if (group[i].midi !== group[0].midi || group[i].startTick !== group[i - 1].startTick + group[i - 1].durationTick) errors.push(`지속 그룹 불일치: ${id}`);
    }
  }
  return errors;
}
