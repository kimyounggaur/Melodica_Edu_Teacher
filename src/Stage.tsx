import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { fingerFor, pitchName, solfege } from './domain';
import type { NoteEvent, Position } from './domain';
import './stage.css';

const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const isWhite = (midi: number) => WHITE.has(((midi % 12) + 12) % 12);
const fingerMidis = (position: Position) => position === 'c-position' ? [60, 62, 64, 65, 67] : [65, 67, 69, 71, 72];
type Point = { x: number; y: number };
type KeyShape = { midi: number; x: number; width: number; black: boolean; whiteIndex: number };
export type HandMovement = { from: Position; to: Position; progress: number };
type KeyboardProps = {
  low?: number; high?: number; selected: number | null; pressed: number | null;
  position: Position; showNames: boolean; showFingers: boolean; showHand: boolean;
  reducedMotion: boolean; showGroups?: boolean; conceal?: boolean;
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

function segment(a: Point, b: Point) {
  return { length: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
}

function fingerOutline(points: Point[], width: number) {
  const radii = [.50, .47, .43, .39].map(r => width * r);
  const tangent = (i: number) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    return { x: (after.x - before.x) / length, y: (after.y - before.y) / length };
  };
  const left = points.map((p, i) => { const t = tangent(i); return { x: p.x - t.y * radii[i], y: p.y + t.x * radii[i] }; });
  const right = points.map((p, i) => { const t = tangent(i); return { x: p.x + t.y * radii[i], y: p.y - t.x * radii[i] }; });
  const tip = points[3], direction = tangent(3);
  const outline = [...left, { x: tip.x + direction.x * radii[3], y: tip.y + direction.y * radii[3] }, ...right.reverse()];
  let d = `M ${outline[0].x} ${outline[0].y}`;
  // A single continuous silhouette avoids separate capsule outlines at every joint.
  for (let i = 0; i < outline.length; i++) {
    const p0 = outline[(i + outline.length - 1) % outline.length], p1 = outline[i];
    const p2 = outline[(i + 1) % outline.length], p3 = outline[(i + 2) % outline.length];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return d + ' Z';
}

/** Educational hand illustration, with independently addressable joints and explicit contact targets. */
function Finger({ id, base, target, width, active, thumb = false, prefix }: {
  id: string; base: Point; target: Point; width: number; active: boolean; thumb?: boolean; prefix: string;
}) {
  const dx = target.x - base.x, dy = target.y - base.y;
  const bow = thumb ? -20 : (id === 'little' ? 11 : -7);
  const point = (ratio: number, curve: number): Point => ({
    x: base.x + dx * ratio + bow * curve,
    y: base.y + dy * ratio + (active ? 9 : 0) * Math.sin(ratio * Math.PI),
  });
  const p1 = point(thumb ? .47 : .38, 1), p2 = point(thumb ? .76 : .73, .7);
  const s1 = segment(base, p1), s2 = segment(p1, p2), s3 = segment(p2, target);
  const outline = fingerOutline([base, p1, p2, target], width);
  const clipId = `${prefix}-${id}-skin-mask`;
  const shape = (length: number, w: number, nail = false) => <>
    <rect x={-8} y={-w / 2} width={length + 18} height={w} rx={w / 2} className="hand-skin" />
    <path d={`M 5 ${-w * .32} Q ${length * .5} ${-w * .42} ${Math.max(6, length - 4)} ${-w * .3}`} className="hand-highlight" />
    {nail && <rect x={Math.max(1, length - w * .44)} y={-w * .28} width={w * .55} height={w * .56} rx={w * .18} className="hand-nail" />}
  </>;
  return <g id={`${prefix}-${id}`} className={`hand-finger ${active ? 'finger-active' : ''}`}>
    <defs><clipPath id={clipId}><path d={outline} /></clipPath></defs>
    <path d={outline} className="hand-finger-silhouette" />
    <g clipPath={`url(#${clipId})`}><g id={`${prefix}-${id}-${thumb ? 'base' : 'proximal'}`} className="hand-joint" style={{ transform: `translate(${base.x}px, ${base.y}px) rotate(${s1.angle}deg)` }}>
      {shape(s1.length, width)}
      <g id={`${prefix}-${id}-${thumb ? 'proximal' : 'middle'}`} className="hand-joint" style={{ transform: `translate(${s1.length}px, 0px) rotate(${s2.angle - s1.angle}deg)` }}>
        {shape(s2.length, width * .91)}
        <path d={`M 1 ${-width * .22} Q 7 0 1 ${width * .22}`} className="hand-crease" />
        <g id={`${prefix}-${id}-distal`} className="hand-joint" style={{ transform: `translate(${s2.length}px, 0px) rotate(${s3.angle - s2.angle}deg)` }}>
          {shape(s3.length, width * .79, true)}
          <path d={`M 1 ${-width * .17} Q 5 0 1 ${width * .17}`} className="hand-crease" />
        </g>
      </g>
    </g></g>
    <path d={outline} className="hand-finger-outline" />
  </g>;
}

function HandRig({ position, pressed, keyCenters, whiteWidth, showFingers, reducedMotion, prefix, movement }: {
  position: Position; pressed: number | null; keyCenters: Map<number, number>; whiteWidth: number;
  showFingers: boolean; reducedMotion: boolean; prefix: string;
  movement?: HandMovement;
}) {
  const [visualPosition, setVisualPosition] = useState(position);
  const [phase, setPhase] = useState<'ready' | 'lift' | 'translate' | 'settle'>('ready');
  const previous = useRef(position);
  const settled = useRef(position);
  const wasTimeline = useRef(false);
  const phaseRef = useRef<'ready' | 'lift' | 'translate' | 'settle'>('ready');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cleanup = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const changePhase = (next: typeof phase) => { phaseRef.current = next; setPhase(next); };
  useEffect(() => {
    cleanup();
    if (movement) {
      // The transport owns these coordinates. No independent timer may run during a cue.
      wasTimeline.current = true;
      changePhase('ready');
      return;
    }
    if (wasTimeline.current) {
      // On cue completion or cancellation, use the controller's settled from/to position.
      wasTimeline.current = false;
      previous.current = position; settled.current = position;
      setVisualPosition(position); changePhase('ready');
      return;
    }
    if (previous.current === position) {
      if (reducedMotion) { setVisualPosition(position); settled.current = position; changePhase('ready'); }
      return;
    }
    // A transport stop during a move restores its last settled origin immediately.
    if (phaseRef.current !== 'ready' && position === settled.current) {
      previous.current = position; setVisualPosition(position); changePhase('ready'); return;
    }
    previous.current = position;
    if (reducedMotion || pressed !== null) {
      setVisualPosition(position); settled.current = position; changePhase('ready'); return;
    }
    changePhase('lift');
    timers.current.push(setTimeout(() => { setVisualPosition(position); changePhase('translate'); }, 150));
    timers.current.push(setTimeout(() => changePhase('settle'), 610));
    timers.current.push(setTimeout(() => { settled.current = position; changePhase('ready'); }, 800));
    return cleanup;
  }, [position, reducedMotion, !!movement]);
  useEffect(() => {
    // A score-driven note must never wait for a decorative transition.
    if (!movement && pressed !== null) { cleanup(); setVisualPosition(position); settled.current = position; changePhase('ready'); }
  }, [pressed, position, !!movement]);
  useEffect(() => cleanup, []);
  const progress = movement ? Math.max(0, Math.min(1, Number.isFinite(movement.progress) ? movement.progress : 0)) : 0;
  const timelinePosition = movement && progress >= .8 ? movement.to : movement?.from;
  const resolvedPosition = timelinePosition ?? (wasTimeline.current ? position : visualPosition);
  const midis = fingerMidis(resolvedPosition);
  const centers = midis.map(m => keyCenters.get(m));
  if (centers.some(c => c === undefined)) return null;
  // Canonical hand coordinates use a 154-unit white key. The entire model scales with the keys.
  const scale = whiteWidth / 154;
  let origin = (centers[0] as number) - 77 * scale;
  let liftOffset = phase === 'lift' || phase === 'translate' ? -22 : 0;
  let renderedPhase: string = phase;
  if (movement) {
    const fromCenter = keyCenters.get(fingerMidis(movement.from)[0]);
    const toCenter = keyCenters.get(fingerMidis(movement.to)[0]);
    if (fromCenter === undefined || toCenter === undefined) return null;
    const translation = reducedMotion ? (progress >= .8 ? 1 : 0) : Math.max(0, Math.min(1, (progress - .3) / .5));
    origin = fromCenter + (toCenter - fromCenter) * translation - 77 * scale;
    const liftProgress = progress < .15 ? 0 : progress < .3 ? (progress - .15) / .15 : progress < .8 ? 1 : (1 - progress) / .2;
    liftOffset = reducedMotion ? 0 : -22 * Math.max(0, Math.min(1, liftProgress));
    renderedPhase = progress < .15 ? 'release' : progress < .3 ? 'lift' : progress < .8 ? 'translate' : progress < 1 ? 'settle' : 'ready';
  }
  const activeFinger = !movement && pressed !== null && phase === 'ready' ? fingerFor(pressed, resolvedPosition) : null;
  const configs = [
    { id: 'thumb', base: { x: 266, y: 445 }, target: { x: 77, y: 333 }, width: 62, thumb: true },
    { id: 'index', base: { x: 266, y: 430 }, target: { x: 231, y: 320 }, width: 62 },
    { id: 'middle', base: { x: 366, y: 432 }, target: { x: 385, y: 318 }, width: 65 },
    { id: 'ring', base: { x: 463, y: 449 }, target: { x: 539, y: 322 }, width: 60 },
    { id: 'little', base: { x: 552, y: 467 }, target: { x: 693, y: 334 }, width: 52 },
  ];
  return <g className={`hand-rig ${reducedMotion ? 'reduced-motion' : ''} ${movement || wasTimeline.current ? 'timeline-motion' : ''} phase-${renderedPhase}`} data-motion-phase={renderedPhase} aria-hidden="true" pointerEvents="none">
    <g className="hand-root" style={{ transform: `translate(${origin}px, ${liftOffset}px) scale(${scale})` }}>
      <g id={`${prefix}-handRoot`}>
        <path d="M 295 562 L 268 514 Q 214 486 230 442 Q 240 419 273 422 L 352 421 Q 407 423 460 438 L 544 454 Q 589 471 604 512 L 569 562 Z" className="hand-palm" />
        {configs.map((f, i) => <Finger key={f.id} {...f} target={{ x: f.target.x, y: f.target.y + (activeFinger === i + 1 ? 10 : 0) }} active={activeFinger === i + 1} prefix={prefix} />)}
        <path id={`${prefix}-palm`} d="M 291 558 L 271 515 Q 248 483 260 455 Q 273 434 305 432 Q 362 430 414 438 Q 494 448 554 477 Q 583 497 578 525 L 566 558" className="hand-palm-top" />
        <path d="M 306 477 Q 370 459 421 483 M 335 507 Q 424 486 503 513 M 291 514 Q 322 490 314 461" className="palm-crease" />
        {showFingers && configs.map((f, i) => <g key={f.id} id={`${prefix}-label-${i + 1}`} className={`hand-number ${activeFinger === i + 1 ? 'active' : ''}`} transform={`translate(${f.target.x},${f.target.y - 48})`}>
          <path d="M 0 19 L 0 30" />
          <circle r={24} /><text textAnchor="middle" dy=".35em">{i + 1}</text>
        </g>)}
        {activeFinger && <g className="finger-contact" transform={`translate(${configs[activeFinger - 1].target.x},${configs[activeFinger - 1].target.y + 10})`}>
          <ellipse rx="25" ry="8" /><circle r="5" />
        </g>}
      </g>
    </g>
  </g>;
}

export function Keyboard({ low = 60, high = 72, selected, pressed, position, showNames, showFingers, showHand, reducedMotion, showGroups = false, conceal = false, movement, onDown, onUp }: KeyboardProps) {
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
      <rect x={k.x} y={140 + (isPressed ? 5 : 0)} width={k.width - (k.black ? 0 : 2)} height={k.black ? 168 : 280} rx={k.black ? 8 : 5} className="key-surface" />
      {!k.black && <path d={`M ${k.x + 8} 411 H ${k.x + k.width - 10}`} className="key-front-edge" />}
      {k.black && <path d={`M ${k.x + 9} 153 H ${k.x + k.width - 9} V 303`} className="black-key-shine" />}
      {isSelected && <path d={`M ${k.x + k.width / 2 - 12} ${k.black ? 290 : 402} l 12 12 12 -12`} className="key-selection-mark" />}
      {!conceal && !k.black && showFingers && finger && <circle cx={k.x + k.width / 2} cy={385} r={17} className="key-finger-dot" />}
      {!conceal && !k.black && showFingers && finger && <text x={k.x + k.width / 2} y={391} className="key-finger-number" textAnchor="middle">{finger}</text>}
    </g>;
  };
  const groups = shapes.filter(k => !k.black && (k.midi % 12 === 0 || k.midi % 12 === 5)).map(k => {
    const size = k.midi % 12 === 0 ? 2 : 3;
    const last = shapes.find(other => other.midi === k.midi + (size === 2 ? 3 : 6));
    if (!last) return null;
    const x1 = k.x + width * .72, x2 = last.x + last.width;
    return <g key={k.midi} className="black-key-group"><path d={`M ${x1} 110 V 91 H ${x2} V 110`} /><text x={(x1 + x2) / 2} y={76} textAnchor="middle">검은건반 {size}개</text></g>;
  });
  return <svg className={`melodica-keyboard ${reducedMotion ? 'reduced-motion' : ''}`} viewBox={showGroups ? '20 48 1320 530' : '20 108 1320 465'} role="group" aria-label={conceal ? '건반 찾기 문제' : '멜로디카 학습용 확대 건반'}>
    <defs><linearGradient id={`${uid}-case`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#285d61" /><stop offset="1" stopColor="#173f44" /></linearGradient></defs>
    <rect x="36" y="118" width="1288" height="346" rx="26" className="instrument-shadow" />
    <rect x="36" y="112" width="1288" height="346" rx="26" fill={`url(#${uid}-case)`} />
    <rect x="57" y="134" width="1247" height="313" rx="8" className="key-bed" />
    {shapes.filter(k => !k.black).map(key)}
    {shapes.filter(k => k.black).map(key)}
    {!conceal && <g className="position-bracket" pointerEvents="none">
      {(() => { const targets = fingerMidis(position).map(m => centers.get(m)); if (targets.some(x => x === undefined)) return null; const left = targets[0] as number, right = targets[4] as number; return <><path d={`M ${left} 482 V 490 H ${right} V 482`} /><text x={(left + right) / 2} y={519} textAnchor="middle">{position === 'c-position' ? '도 자리 · 도에 손 1' : '파 자리 · 파에 손 1'}</text></>; })()}
    </g>}
    {showGroups && groups}
    {!conceal && showHand && <HandRig position={position} pressed={pressed} keyCenters={centers} whiteWidth={width} showFingers={showFingers} reducedMotion={reducedMotion} prefix={uid} movement={movement} />}
    {!conceal && showNames && <g className="keyboard-note-labels" pointerEvents="none">
      {whites.map(midi => <g key={midi} transform={`translate(${centers.get(midi)},${468})`}><rect x={-Math.min(width * .39, 55)} y={-24} width={Math.min(width * .78, 110)} height="38" rx="10" /><text textAnchor="middle" dy=".08em">{solfege(midi)}</text></g>)}
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
