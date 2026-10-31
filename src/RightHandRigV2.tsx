import { useEffect, useRef, useState } from 'react';
import { fingerFor } from './domain';
import type { Position } from './domain';
import './hand-v2.css';

export type HandMovement = { from: Position; to: Position; progress: number };

export type RightHandRigV2Props = {
  position: Position;
  pressed: number | null;
  keyCenters: Map<number, number>;
  whiteWidth: number;
  showFingers: boolean;
  reducedMotion: boolean;
  prefix: string;
  movement?: HandMovement;
};

export type Point = { x: number; y: number };
type Phase = 'ready' | 'lift' | 'translate' | 'settle';
export type DigitId = 'thumb' | 'index' | 'middle' | 'ring' | 'little';

type DigitSpec = {
  id: DigitId;
  base: Point;
  target: Point;
  lengths: number[];
  widths: number[];
  bend: number;
  thumb?: boolean;
};

const KEY_UNIT = 154;
const fingerMidis = (position: Position) =>
  position === 'c-position' ? [60, 62, 64, 65, 67] : [65, 67, 69, 71, 72];

const DIGITS: DigitSpec[] = [
  {
    id: 'thumb',
    base: { x: 250, y: 535 },
    target: { x: 77, y: 332 },
    lengths: [140, 132],
    widths: [63, 52, 39],
    bend: -7,
    thumb: true,
  },
  {
    id: 'index',
    base: { x: 305, y: 495 },
    target: { x: 231, y: 318 },
    lengths: [88, 70, 57],
    widths: [59, 53, 46, 34],
    bend: -6,
  },
  {
    id: 'middle',
    base: { x: 398, y: 490 },
    target: { x: 385, y: 312 },
    lengths: [100, 80, 58],
    widths: [62, 56, 48, 35],
    bend: 2,
  },
  {
    id: 'ring',
    base: { x: 490, y: 500 },
    target: { x: 539, y: 319 },
    lengths: [92, 73, 53],
    widths: [58, 52, 44, 33],
    bend: 5,
  },
  {
    id: 'little',
    base: { x: 575, y: 510 },
    target: { x: 693, y: 330 },
    lengths: [88, 75, 64],
    widths: [50, 44, 37, 29],
    bend: 7,
  },
];

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Top-view projection of a fixed-length finger. Flexion mostly happens on the
 * depth axis, so projected phalanges may shorten but never grow past their
 * anatomical lengths. A small one-direction bow keeps the contour organic
 * without turning depth flexion into a lateral zigzag.
 */
function solveChain(base: Point, target: Point, lengths: number[], bend: number): Point[] {
  const total = lengths.reduce((sum, value) => sum + value, 0);
  const reach = distance(base, target);
  const dx = target.x - base.x;
  const dy = target.y - base.y;
  const d = reach || 1;
  const normal = { x: -dy / d, y: dx / d };
  const createProjection = (bow: number) => {
    const points: Point[] = [base];
    let travelled = 0;
    for (const length of lengths) {
      travelled += length;
      const ratio = travelled / total;
      points.push({
        x: base.x + dx * ratio + normal.x * bow * Math.sin(Math.PI * ratio),
        y: base.y + dy * ratio + normal.y * bow * Math.sin(Math.PI * ratio),
      });
    }
    points[points.length - 1] = target;
    return points;
  };

  if (reach > total) bend = 0;
  let points = createProjection(Math.max(-8, Math.min(8, bend)));
  for (let pass = 0; pass < 8; pass += 1) {
    const stretched = lengths.some((length, index) => distance(points[index], points[index + 1]) > length + 0.01);
    if (!stretched) break;
    bend *= 0.58;
    points = createProjection(bend);
  }
  return points;
}

export type RightHandDigitGeometry = {
  id: DigitId;
  active: boolean;
  target: Point;
  points: Point[];
  lengths: number[];
};

/** Pure canonical geometry for alignment and projected-segment validation. */
export function computeRightHandGeometry(activeFinger: number | null): RightHandDigitGeometry[] {
  return DIGITS.map((spec, index) => {
    const active = activeFinger === index + 1;
    const target = { x: spec.target.x, y: spec.target.y + (active ? 13 : 0) };
    return {
      id: spec.id,
      active,
      target,
      points: solveChain(spec.base, target, spec.lengths, spec.bend * (active ? 1.22 : 1)),
      lengths: [...spec.lengths],
    };
  });
}

export function validateRightHandGeometry(activeFinger: number | null): string[] {
  const issues: string[] = [];
  for (const digit of computeRightHandGeometry(activeFinger)) {
    digit.points.forEach((point, index) => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) issues.push(`${digit.id}: point ${index} is not finite`);
    });
    digit.lengths.forEach((length, index) => {
      const projected = distance(digit.points[index], digit.points[index + 1]);
      if (projected > length + 0.05) issues.push(`${digit.id}: projected segment ${index} exceeds anatomy`);
      if (digit.points[index + 1].y > digit.points[index].y + 0.1) issues.push(`${digit.id}: segment ${index} reverses toward wrist`);
      if (distance(digit.points[index + 1], digit.target) > distance(digit.points[index], digit.target) + 0.1) {
        issues.push(`${digit.id}: segment ${index} moves away from contact`);
      }
    });
    if (distance(digit.points[digit.points.length - 1], digit.target) >= 0.1) issues.push(`${digit.id}: fingertip misses contact`);
  }
  return issues;
}

function tangent(points: Point[], index: number) {
  const before = points[Math.max(0, index - 1)];
  const after = points[Math.min(points.length - 1, index + 1)];
  const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
  return { x: (after.x - before.x) / length, y: (after.y - before.y) / length };
}

function appendSmooth(path: string, points: Point[]) {
  for (let index = 1; index < points.length; index += 1) {
    const p0 = points[Math.max(0, index - 2)];
    const p1 = points[index - 1];
    const p2 = points[index];
    const p3 = points[Math.min(points.length - 1, index + 1)];
    path += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}`;
    path += ` ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return path;
}

function fingerOutline(points: Point[], widths: number[]) {
  const left = points.map((point, index) => {
    const direction = tangent(points, index);
    const radius = widths[index] / 2;
    return { x: point.x - direction.y * radius, y: point.y + direction.x * radius };
  });
  const right = points.map((point, index) => {
    const direction = tangent(points, index);
    const radius = widths[index] / 2;
    return { x: point.x + direction.y * radius, y: point.y - direction.x * radius };
  });
  const direction = tangent(points, points.length - 1);
  const tipRadius = widths[widths.length - 1] / 2;
  const tip = points[points.length - 1];
  const cap = { x: tip.x + direction.x * tipRadius * 0.82, y: tip.y + direction.y * tipRadius * 0.82 };
  let path = `M ${left[0].x} ${left[0].y}`;
  path = appendSmooth(path, left);
  path += ` Q ${cap.x} ${cap.y} ${right[right.length - 1].x} ${right[right.length - 1].y}`;
  path = appendSmooth(path, [...right].reverse());
  return `${path} Q ${points[0].x - direction.x * widths[0] * 0.18} ${points[0].y - direction.y * widths[0] * 0.18} ${left[0].x} ${left[0].y} Z`;
}

function segmentPath(length: number, startWidth: number, endWidth: number) {
  const start = startWidth / 2;
  const end = endWidth / 2;
  return `M -5 ${-start} C ${length * 0.32} ${-start} ${length * 0.68} ${-end} ${length + 5} ${-end}`
    + ` L ${length + 5} ${end} C ${length * 0.68} ${end} ${length * 0.32} ${start} -5 ${start} Z`;
}

function angle(a: Point, b: Point) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

function usePressProgress(active: boolean, reducedMotion: boolean, enabled: boolean) {
  const [progress, setProgress] = useState(active && enabled ? 1 : 0);
  const progressRef = useRef(progress);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const target = active && enabled ? 1 : 0;
    if (reducedMotion || !enabled) {
      progressRef.current = target;
      setProgress(target);
      return;
    }
    const from = progressRef.current;
    if (Math.abs(target - from) < 0.001) {
      progressRef.current = target;
      setProgress(target);
      return;
    }
    let startedAt: number | null = null;
    const duration = 96 * Math.max(0.35, Math.abs(target - from));
    const update = (now: number) => {
      if (startedAt === null) startedAt = now;
      const elapsed = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - elapsed) ** 3;
      const next = from + (target - from) * eased;
      progressRef.current = next;
      setProgress(next);
      if (elapsed < 1) frameRef.current = requestAnimationFrame(update);
      else {
        frameRef.current = null;
        progressRef.current = target;
      }
    };
    frameRef.current = requestAnimationFrame(update);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [active, reducedMotion, enabled]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);
  return progress;
}

function JointSegments({ id, points, widths, thumb }: {
  id: string;
  points: Point[];
  widths: number[];
  thumb: boolean;
}) {
  const names = thumb ? ['mcp', 'ip'] : ['mcp', 'pip', 'dip'];
  const render = (index: number): React.ReactNode => {
    if (index >= points.length - 1) return null;
    const segmentAngle = angle(points[index], points[index + 1]);
    const parentAngle = index === 0 ? 0 : angle(points[index - 1], points[index]);
    const length = distance(points[index], points[index + 1]);
    const transform = index === 0
      ? `translate(${points[0].x}px, ${points[0].y}px) rotate(${segmentAngle}deg)`
      : `translate(${distance(points[index - 1], points[index])}px, 0px) rotate(${segmentAngle - parentAngle}deg)`;
    return <g
      id={`${id}-${names[index]}`}
      className={`rh2-joint rh2-${names[index]}`}
      style={{ transform }}
      data-joint={names[index]}
    >
      <path className="rh2-segment-glaze" d={segmentPath(length, widths[index], widths[index + 1])} />
      {index > 0 && <path className="rh2-joint-crease" d={`M 4 ${-widths[index] * 0.22} Q 10 0 4 ${widths[index] * 0.22}`} />}
      {render(index + 1)}
    </g>;
  };
  return <>{render(0)}</>;
}

function Digit({ spec, active, prefix, skinId, reducedMotion, pressEnabled }: {
  spec: DigitSpec;
  active: boolean;
  prefix: string;
  skinId: string;
  reducedMotion: boolean;
  pressEnabled: boolean;
}) {
  const pressProgress = usePressProgress(active, reducedMotion, pressEnabled);
  const pressOffset = 13 * pressProgress;
  const target = { x: spec.target.x, y: spec.target.y + pressOffset };
  const bend = spec.bend * (1 + 0.22 * pressProgress);
  const points = solveChain(spec.base, target, spec.lengths, bend);
  const outline = fingerOutline(points, spec.widths);
  const digitId = `${prefix}-rh2-${spec.id}`;
  const tip = points[points.length - 1];
  const previous = points[points.length - 2];
  const tipAngle = angle(previous, tip);
  const nailWidth = spec.widths[spec.widths.length - 1] * (spec.thumb ? 0.62 : 0.58);
  const nailLength = spec.thumb ? 29 : 25;

  return <g id={digitId} className={`rh2-digit rh2-${spec.id} ${active ? 'is-active' : ''}`}>
    <path d={outline} className="rh2-finger-silhouette" fill={`url(#${skinId})`} />
    <JointSegments id={digitId} points={points} widths={spec.widths} thumb={Boolean(spec.thumb)} />
    <g className="rh2-nail-wrap" transform={`translate(${tip.x},${tip.y}) rotate(${tipAngle})`}>
      <rect
        className="rh2-nail"
        x={-nailLength * 0.78}
        y={-nailWidth / 2}
        width={nailLength}
        height={nailWidth}
        rx={nailWidth * 0.32}
      />
      <path className="rh2-nail-shine" d={`M ${-nailLength * 0.62} ${-nailWidth * 0.22} Q ${-nailLength * 0.22} ${-nailWidth * 0.38} 2 ${-nailWidth * 0.12}`} />
    </g>
    {pressProgress > 0 && <path d={outline} className="rh2-press-warmth" style={{ opacity: 0.11 * pressProgress }} />}
  </g>;
}

export function RightHandRigV2({
  position,
  pressed,
  keyCenters,
  whiteWidth,
  showFingers,
  reducedMotion,
  prefix,
  movement,
}: RightHandRigV2Props) {
  const [visualPosition, setVisualPosition] = useState(position);
  const [phase, setPhase] = useState<Phase>('ready');
  const previous = useRef(position);
  const settled = useRef(position);
  const wasTimeline = useRef(false);
  const phaseRef = useRef<Phase>('ready');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cleanup = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const changePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    cleanup();
    if (movement) {
      wasTimeline.current = true;
      changePhase('ready');
      return;
    }
    if (wasTimeline.current) {
      wasTimeline.current = false;
      previous.current = position;
      settled.current = position;
      setVisualPosition(position);
      changePhase('ready');
      return;
    }
    if (previous.current === position) {
      if (reducedMotion) {
        setVisualPosition(position);
        settled.current = position;
        changePhase('ready');
      }
      return;
    }
    if (phaseRef.current !== 'ready' && position === settled.current) {
      previous.current = position;
      setVisualPosition(position);
      changePhase('ready');
      return;
    }
    previous.current = position;
    if (reducedMotion || pressed !== null) {
      setVisualPosition(position);
      settled.current = position;
      changePhase('ready');
      return;
    }
    changePhase('lift');
    timers.current.push(setTimeout(() => {
      setVisualPosition(position);
      changePhase('translate');
    }, 150));
    timers.current.push(setTimeout(() => changePhase('settle'), 610));
    timers.current.push(setTimeout(() => {
      settled.current = position;
      changePhase('ready');
    }, 800));
    return cleanup;
  }, [position, reducedMotion, Boolean(movement)]);

  useEffect(() => {
    if (!movement && pressed !== null) {
      cleanup();
      setVisualPosition(position);
      settled.current = position;
      changePhase('ready');
    }
  }, [pressed, position, Boolean(movement)]);

  useEffect(() => cleanup, []);

  const progress = movement
    ? Math.max(0, Math.min(1, Number.isFinite(movement.progress) ? movement.progress : 0))
    : 0;
  const timelinePosition = movement && progress >= 0.8 ? movement.to : movement?.from;
  const resolvedPosition = timelinePosition ?? (wasTimeline.current ? position : visualPosition);
  const centers = fingerMidis(resolvedPosition).map(midi => keyCenters.get(midi));
  if (centers.some(center => center === undefined)) return null;

  const scale = whiteWidth / KEY_UNIT;
  let origin = (centers[0] as number) - KEY_UNIT / 2 * scale;
  let liftOffset = phase === 'lift' || phase === 'translate' ? -22 : 0;
  let renderedPhase: string = phase;
  if (movement) {
    const fromCenter = keyCenters.get(fingerMidis(movement.from)[0]);
    const toCenter = keyCenters.get(fingerMidis(movement.to)[0]);
    if (fromCenter === undefined || toCenter === undefined) return null;
    const translation = reducedMotion
      ? (progress >= 0.8 ? 1 : 0)
      : Math.max(0, Math.min(1, (progress - 0.3) / 0.5));
    origin = fromCenter + (toCenter - fromCenter) * translation - KEY_UNIT / 2 * scale;
    const liftProgress = progress < 0.15
      ? 0
      : progress < 0.3
        ? (progress - 0.15) / 0.15
        : progress < 0.8
          ? 1
          : (1 - progress) / 0.2;
    liftOffset = reducedMotion ? 0 : -22 * Math.max(0, Math.min(1, liftProgress));
    renderedPhase = progress < 0.15
      ? 'release'
      : progress < 0.3
        ? 'lift'
        : progress < 0.8
          ? 'translate'
          : progress < 1
            ? 'settle'
            : 'ready';
  }

  const activeFinger = !movement && pressed !== null && phase === 'ready'
    ? fingerFor(pressed, resolvedPosition)
    : null;
  const geometry = computeRightHandGeometry(activeFinger);
  const skinId = `${prefix}-rh2-skin`;
  const palmId = `${prefix}-rh2-palm-skin`;

  return <g
    className={`right-hand-rig-v2 ${reducedMotion ? 'reduced-motion' : ''} ${movement || wasTimeline.current ? 'timeline-motion' : ''} phase-${renderedPhase}`}
    data-motion-phase={renderedPhase}
    aria-hidden="true"
    pointerEvents="none"
  >
    <defs>
      <linearGradient id={skinId} x1="0" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor="#f8dbc3" />
        <stop offset="0.48" stopColor="#efc5a4" />
        <stop offset="1" stopColor="#dca77e" />
      </linearGradient>
      <radialGradient id={palmId} cx="0.42" cy="0.28" r="0.86">
        <stop offset="0" stopColor="#f9ddc5" />
        <stop offset="0.62" stopColor="#edc09e" />
        <stop offset="1" stopColor="#dca479" />
      </radialGradient>
    </defs>
    <g
      className="rh2-hand-root"
      style={{ transform: `translate(${origin}px, ${liftOffset}px) scale(${scale})` }}
    >
      <g id={`${prefix}-rightHandRigV2`}>
        <ellipse className="rh2-contact-shadow" cx="424" cy="748" rx="158" ry="24" />
        {DIGITS.map((spec, index) => <Digit
          key={spec.id}
          spec={spec}
          active={geometry[index].active}
          prefix={prefix}
          skinId={skinId}
          reducedMotion={reducedMotion}
          pressEnabled={!movement}
        />)}
        <path
          id={`${prefix}-rh2-palm`}
          className="rh2-palm"
          fill={`url(#${palmId})`}
          d="M 237 551 C 236 526 248 505 267 494 C 282 486 296 486 309 493 C 324 479 344 476 363 484 C 382 473 405 474 425 484 C 446 478 470 484 488 497 C 510 491 535 501 551 518 C 575 516 598 532 610 552 C 628 580 620 616 604 650 C 588 685 575 724 568 768 L 567 830 L 340 830 C 338 780 330 737 310 700 C 291 667 260 638 244 602 C 236 584 232 566 237 551 Z"
        />
        <path
          className="rh2-palm-outline"
          d="M 237 551 C 236 526 248 505 267 494 C 282 486 296 486 309 493 C 324 479 344 476 363 484 C 382 473 405 474 425 484 C 446 478 470 484 488 497 C 510 491 535 501 551 518 C 575 516 598 532 610 552 C 628 580 620 616 604 650 C 588 685 575 724 568 768 L 567 830 M 340 830 C 338 780 330 737 310 700 C 291 667 260 638 244 602 C 236 584 232 566 237 551"
        />
        <path
          className="rh2-palm-light"
          d="M 278 525 C 313 499 354 497 394 505 C 438 495 494 505 536 531 C 567 550 583 581 576 613 C 530 578 482 561 430 558 C 373 554 326 570 283 598 C 264 578 263 545 278 525 Z"
        />
        <path className="rh2-thenar" d="M 258 548 C 286 522 329 530 347 566 C 367 608 345 654 310 681" />
        <path className="rh2-webbing" d="M 318 492 Q 339 511 366 484 M 414 485 Q 439 508 471 488 M 511 499 Q 536 523 563 517" />
        <path className="rh2-knuckle-line" d="M 298 505 Q 328 519 359 501 M 385 496 Q 420 512 454 496 M 477 503 Q 510 518 540 511" />
        <path className="rh2-hand-vein" d="M 389 720 C 390 662 407 609 434 568 M 434 568 C 454 546 477 526 502 507 M 431 570 C 418 536 406 512 396 492" />
        {showFingers && DIGITS.map((spec, index) => <g
          key={spec.id}
          id={`${prefix}-rh2-label-${index + 1}`}
          className={`rh2-finger-number ${activeFinger === index + 1 ? 'is-active' : ''}`}
          transform={`translate(${spec.target.x},${spec.target.y - 51})`}
        >
          <path d="M 0 20 L 0 31" />
          <circle r="23" />
          <text textAnchor="middle" dy=".35em">{index + 1}</text>
        </g>)}
        {activeFinger && <g
          className="rh2-finger-contact"
          transform={`translate(${DIGITS[activeFinger - 1].target.x},${DIGITS[activeFinger - 1].target.y + 13})`}
        >
          <ellipse rx="24" ry="7" />
          <circle r="4.8" />
        </g>}
      </g>
    </g>
  </g>;
}
