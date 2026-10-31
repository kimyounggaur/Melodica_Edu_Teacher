import { useEffect, useId, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { fingerFor, pitchName, solfege } from './domain';
import type { NoteEvent, Position } from './domain';
import { MelodicaShellV2 } from './MelodicaShellV2';
import { RightHandRigV2 } from './RightHandRigV2';
import './stage.css';

const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const isWhite = (midi: number) => WHITE.has(((midi % 12) + 12) % 12);
const fingerMidis = (position: Position) => position === 'c-position' ? [60, 62, 64, 65, 67] : [65, 67, 69, 71, 72];
type KeyShape = { midi: number; x: number; width: number; black: boolean; whiteIndex: number };
export type HandMovement = { from: Position; to: Position; progress: number };
type KeyboardProps = {
  low?: number; high?: number; selected: number | null; pressed: number | null;
  position: Position; showNames: boolean; showFingers: boolean; showHand: boolean;
  reducedMotion: boolean; showGroups?: boolean; conceal?: boolean;
  handView?: 'full' | 'keys';
  movement?: HandMovement;
  onDown: (midi: number, source: string) => void;
  onUp: (source: string) => void;
};

function keyGeometry(low: number, high: number) {
  const notes = Array.from({ length: Math.max(1, high - low + 1) }, (_, i) => low + i);
  const whites = notes.filter(isWhite);
  const width = 1232 / Math.max(1, whites.length);
  const shapes: KeyShape[] = [];
  let whiteIndex = 0;
  for (const midi of notes) {
    if (isWhite(midi)) {
      shapes.push({ midi, x: 64 + whiteIndex * width, width, black: false, whiteIndex });
      whiteIndex++;
    } else {
      shapes.push({ midi, x: 64 + whiteIndex * width - width * .29, width: width * .58, black: true, whiteIndex });
    }
  }
  return { shapes, width, whites };
}


export function Keyboard({ low = 60, high = 72, selected, pressed, position, showNames, showFingers, showHand, handView = 'full', reducedMotion, showGroups = false, conceal = false, movement, onDown, onUp }: KeyboardProps) {
  const uid = useId().replace(/:/g, '');
  const { shapes, width, whites } = keyGeometry(Math.max(0, low), Math.min(127, high));
  const centers = new Map(shapes.filter(k => !k.black).map(k => [k.midi, k.x + k.width / 2]));
  const sources = useRef(new Set<string>());
  const latestUp = useRef(onUp); latestUp.current = onUp;
  useEffect(() => () => { sources.current.forEach(s => latestUp.current(s)); sources.current.clear(); }, []);
  const start = (midi: number, e: ReactPointerEvent<SVGGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const source = `pointer:${e.pointerId}`;
    sources.current.add(source);
    e.currentTarget.setPointerCapture(e.pointerId);
    onDown(midi, source);
  };
  const end = (e: ReactPointerEvent<SVGGElement>) => {
    const source = `pointer:${e.pointerId}`;
    if (sources.current.delete(source)) onUp(source);
  };
  const keyboardDown = (midi: number, e: ReactKeyboardEvent<SVGGElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault(); e.stopPropagation(); const source = `keybutton:${midi}`; sources.current.add(source); onDown(midi, source);
    }
  };
  const keyboardUp = (midi: number, e: ReactKeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const source = `keybutton:${midi}`; if (sources.current.delete(source)) onUp(source); }
  };
  const key = (k: KeyShape) => {
    const isPressed = pressed === k.midi;
    const isSelected = !conceal && selected === k.midi;
    const finger = fingerFor(k.midi, position);
    return <g key={k.midi} className={`piano-key ${k.black ? 'black-key' : 'white-key'} ${isPressed ? 'is-down' : ''} ${isSelected ? 'is-selected' : ''}`}
      data-midi={k.midi} role="button" tabIndex={0} aria-label={conceal ? `${k.black ? '검은' : '흰'}건반 ${k.whiteIndex + 1}` : `${solfege(k.midi)} ${pitchName(k.midi)} 건반`}
      aria-pressed={isPressed} onPointerDown={e => start(k.midi, e)} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
      onKeyDown={e => keyboardDown(k.midi, e)} onKeyUp={e => keyboardUp(k.midi, e)} onBlur={() => { const source = `keybutton:${k.midi}`; if (sources.current.delete(source)) onUp(source); }}>
      <g className="key-travel" transform={`translate(0 ${isPressed ? (k.black ? 4 : 5) : 0})`}>
      <rect x={k.x} y={140} width={k.width - (k.black ? 0 : 2)} height={k.black ? 168 : 280} rx={k.black ? 7 : 4} className="key-surface" style={isSelected || isPressed ? undefined : { fill: `url(#${uid}-v2-${k.black ? 'black' : 'ivory'})` }} />
      {!k.black && <><path d={`M ${k.x + 2} 401 H ${k.x + k.width - 4} V 414 Q ${k.x + k.width - 4} 420 ${k.x + k.width - 10} 420 H ${k.x + 8} Q ${k.x + 2} 420 ${k.x + 2} 414 Z`} className="white-key-front" /><path d={`M ${k.x + 6} 403 H ${k.x + k.width - 8}`} className="key-front-edge" /></>}
      {k.black && <><path d={`M ${k.x + 2} 284 L ${k.x + 9} 298 H ${k.x + k.width - 9} L ${k.x + k.width - 2} 284 V 301 Q ${k.x + k.width - 2} 308 ${k.x + k.width - 8} 308 H ${k.x + 8} Q ${k.x + 2} 308 ${k.x + 2} 301 Z`} className="black-key-front" /><path d={`M ${k.x + 8} 151 H ${k.x + k.width - 8} V 284 M ${k.x + 10} 157 H ${k.x + k.width - 12}`} className="black-key-shine" /></>}
      {isSelected && <path d={`M ${k.x + k.width / 2 - 12} ${k.black ? 290 : 402} l 12 12 12 -12`} className="key-selection-mark" />}
      {!conceal && !k.black && showFingers && finger && <circle cx={k.x + k.width / 2} cy={385} r={17} className="key-finger-dot" />}
      {!conceal && !k.black && showFingers && finger && <text x={k.x + k.width / 2} y={391} className="key-finger-number" textAnchor="middle">{finger}</text>}
      </g>
    </g>;
  };
  const groups = shapes.filter(k => !k.black && (k.midi % 12 === 0 || k.midi % 12 === 5)).map(k => {
    const size = k.midi % 12 === 0 ? 2 : 3;
    const last = shapes.find(other => other.midi === k.midi + (size === 2 ? 3 : 6));
    if (!last) return null;
    const x1 = k.x + width * .72, x2 = last.x + last.width;
    return <g key={k.midi} className="black-key-group"><path d={`M ${x1} 110 V 91 H ${x2} V 110`} /><text x={(x1 + x2) / 2} y={76} textAnchor="middle">검은건반 {size}개</text></g>;
  });
  const fullHand = showHand && !conceal && handView === 'full';
  const viewport = fullHand ? (showGroups ? '20 48 1320 802' : '20 108 1320 742') : (showGroups ? '20 48 1320 550' : '20 108 1320 490');
  return <svg className={`melodica-keyboard ${fullHand ? 'whole-hand-view' : 'key-detail-view'} ${reducedMotion ? 'reduced-motion' : ''}`} viewBox={viewport} role="group" aria-label={conceal ? '건반 찾기 문제' : '멜로디카 학습용 확대 건반'}>
    <MelodicaShellV2 prefix={uid} />
    {shapes.filter(k => !k.black).map(key)}
    {shapes.filter(k => k.black).map(key)}
    {!conceal && <g className="position-bracket" pointerEvents="none">
      {(() => { const targets = fingerMidis(position).map(m => centers.get(m)); if (targets.some(x => x === undefined)) return null; const left = targets[0] as number, right = targets[4] as number; return <><path d={`M ${left} 482 V 490 H ${right} V 482`} /><text x={showHand ? (position === 'c-position' ? 1270 : 90) : (left + right) / 2} y={520} textAnchor={showHand ? (position === 'c-position' ? 'end' : 'start') : 'middle'}>{position === 'c-position' ? '도 자리 · 도에 손 1' : '파 자리 · 파에 손 1'}</text></>; })()}
    </g>}
    {showGroups && groups}
    {!conceal && showHand && <RightHandRigV2 position={position} pressed={pressed} keyCenters={centers} whiteWidth={width} showFingers={showFingers} reducedMotion={reducedMotion} prefix={uid} movement={movement} />}
    {!conceal && showNames && <g className="keyboard-note-labels" pointerEvents="none">
      {whites.map(midi => <g key={midi} transform={`translate(${centers.get(midi)},${182+(pressed===midi?5:0)})`}><rect x={-Math.min(width * .18, 28)} y={-22} width={Math.min(width * .36, 56)} height="34" rx="8" /><text textAnchor="middle" dy=".08em" style={{fontSize:Math.min(26,width*.30)}}>{solfege(midi)}</text></g>)}
    </g>}
  </svg>;
}

type StaffProps = { midi: number | null; events?: NoteEvent[]; tick?: number; showNames: boolean; conceal?: boolean; meter?: 3 | 4 };
const noteSteps = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
function staffY(midi: number) {
  const octave = Math.floor(midi / 12) - 1;
  const step = noteSteps[((midi % 12) + 12) % 12];
  // C4 is 2 diatonic steps below E4, the bottom staff line.
  return 146 - (((octave - 4) * 7 + step) - 2) * 11;
}
function ledgerLines(midi: number): number[] {
  const y = staffY(midi), list: number[] = [];
  for (let line = 168; line <= y + 1; line += 22) list.push(line);
  for (let line = 36; line >= y - 1; line -= 22) list.push(line);
  return list;
}

export function Staff({ midi, events, tick = -1, showNames, conceal = false, meter = 4 }: StaffProps) {
  const display: NoteEvent[] = events?.length ? events : midi !== null ? [{ id: 'single', kind: 'note', startTick: 0, durationTick: 960, midi }] : [];
  const many = display.length > 1;
  const xStart = many ? 198 : 480;
  const xGap = many ? Math.min(130, 1000 / Math.max(display.length - 1, 1)) : 0;
  const x = (index: number) => xStart + index * xGap;
  const allHigh = display.filter(e => e.kind === 'note' && typeof e.midi === 'number').map(e => e.midi as number);
  const minY = allHigh.length ? Math.min(...allHigh.map(staffY)) : 70;
  const maxY = allHigh.length ? Math.max(...allHigh.map(staffY)) : 146;
  const viewTop = Math.min(0, minY - 65), viewBottom = Math.max(244, maxY + 65);
  return <svg className={`melodica-staff ${many ? 'piece-staff' : 'single-staff'}`} viewBox={`0 ${viewTop} 1360 ${viewBottom - viewTop}`} role="img" aria-label={conceal ? '음 이름을 읽어보는 악보' : many ? '연습 악보' : midi !== null ? `${solfege(midi)} ${pitchName(midi)}의 오선 위치` : '음표를 선택하세요'}>
    <g className="staff-lines">{[58, 80, 102, 124, 146].map(y => <line key={y} x1="70" x2="1284" y1={y} y2={y} />)}</g>
    <text x="82" y="154" className="treble-clef">𝄞</text>
    {many && <g className="time-signature"><text x="159" y="98" textAnchor="middle">{meter}</text><text x="159" y="138" textAnchor="middle">4</text></g>}
    {!display.length && <text x="680" y="217" className="staff-empty" textAnchor="middle">건반을 눌러 음표를 만나보세요</text>}
    {display.map((event, index) => {
      const active = tick >= event.startTick && tick < event.startTick + event.durationTick;
      const xx = x(index);
      if (event.kind === 'rest' || event.midi === undefined) return <g key={event.id} className={`staff-note ${active && !conceal ? 'note-active' : ''}`}>
        {active && !conceal && <rect x={xx - 32} y="38" width="64" height="151" rx="20" className="note-highlight" />}
        {event.durationTick >= 3840 ? <rect x={xx - 17} y="80" width="34" height="11" className="rest-block" /> :
          event.durationTick >= 1920 ? <rect x={xx - 17} y="91" width="34" height="11" className="rest-block" /> :
            <text x={xx} y="145" textAnchor="middle" className="quarter-rest">𝄽</text>}
        {showNames && !conceal && <text x={xx} y="218" textAnchor="middle" className="staff-note-name">쉼</text>}
      </g>;
      const yy = staffY(event.midi), stemUp = yy >= 102;
      const stemX = xx + (stemUp ? 14 : -14);
      const isLong = event.durationTick >= 1920;
      const isWhole = event.durationTick >= 3840;
      const next = display[index + 1];
      const tied = next && event.tieGroupId && next.tieGroupId === event.tieGroupId;
      return <g key={event.id} className={`staff-note ${active && !conceal ? 'note-active' : ''}`}>
        {active && !conceal && <rect x={xx - 35} y={Math.min(36, yy - 50)} width="70" height={Math.max(152, yy + 75 - Math.min(36, yy - 50))} rx="23" className="note-highlight" />}
        {ledgerLines(event.midi).map(y => <line key={y} x1={xx - 26} x2={xx + 27} y1={y} y2={y} className="ledger-line" />)}
        {!isWhite(event.midi) && <text x={xx - 44} y={yy + 13} className="sharp-symbol">♯</text>}
        <ellipse cx={xx} cy={yy} rx="16" ry="11" transform={`rotate(-18 ${xx} ${yy})`} className={`note-head ${isLong ? 'open-note' : ''}`} />
        {!isWhole && <line x1={stemX} x2={stemX} y1={yy} y2={yy + (stemUp ? -70 : 70)} className="note-stem" />}
        {event.durationTick < 960 && <path d={stemUp ? `M ${stemX} ${yy - 70} q 35 20 18 48` : `M ${stemX} ${yy + 70} q 35 -20 18 -48`} className="note-flag" />}
        {tied && <path d={`M ${xx + 13} ${yy + 24} Q ${(xx + x(index + 1)) / 2} ${yy + 57} ${x(index + 1) - 12} ${yy + 24}`} className="note-tie" />}
        {showNames && !conceal && <text x={xx} y={Math.max(218, yy + 46)} textAnchor="middle" className="staff-note-name">{solfege(event.midi)}</text>}
      </g>;
    })}
    {many && display.map((event, index) => index > 0 && event.startTick > 0 && event.startTick % (meter * 960) === 0 ?
      <line key={`bar-${event.id}`} x1={(x(index - 1) + x(index)) / 2} x2={(x(index - 1) + x(index)) / 2} y1="58" y2="146" className="barline" /> : null)}
    {many && <g className="barline"><line x1="1290" x2="1290" y1="58" y2="146" /><line x1="1300" x2="1300" y1="58" y2="146" /></g>}
  </svg>;
}
