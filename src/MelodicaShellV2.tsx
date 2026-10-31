import './melodica-v2.css';

type ShellProps = { prefix: string };

/** Reusable finishes. All paint servers are scoped to the keyboard instance. */
export function MelodicaDefinitionsV2({ prefix }: ShellProps) {
  return <defs>
    <linearGradient id={`${prefix}-v2-case`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#5c9790" />
      <stop offset=".13" stopColor="#337975" />
      <stop offset=".54" stopColor="#215e61" />
      <stop offset=".9" stopColor="#184d52" />
      <stop offset="1" stopColor="#123f46" />
    </linearGradient>
    <linearGradient id={`${prefix}-v2-edge`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#0d343c" />
      <stop offset=".55" stopColor="#28575b" />
      <stop offset="1" stopColor="#102f37" />
    </linearGradient>
    <linearGradient id={`${prefix}-v2-rim`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#a8c4b8" />
      <stop offset=".13" stopColor="#d1d9c6" />
      <stop offset=".5" stopColor="#afbdad" />
      <stop offset="1" stopColor="#718e84" />
    </linearGradient>
    <linearGradient id={`${prefix}-v2-bed`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#10282e" />
      <stop offset="1" stopColor="#284548" />
    </linearGradient>
    <linearGradient id={`${prefix}-v2-ivory`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#e4e7df" />
      <stop offset=".08" stopColor="#fffef6" />
      <stop offset=".79" stopColor="#f9f8ee" />
      <stop offset=".94" stopColor="#eeeee1" />
      <stop offset="1" stopColor="#d4dace" />
    </linearGradient>
    <linearGradient id={`${prefix}-v2-black`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1a2f35" />
      <stop offset=".09" stopColor="#4d6061" />
      <stop offset=".24" stopColor="#283d43" />
      <stop offset=".88" stopColor="#172c33" />
      <stop offset="1" stopColor="#081d25" />
    </linearGradient>
    <linearGradient id={`${prefix}-v2-cream`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff9e4" />
      <stop offset=".35" stopColor="#e7e4ce" />
      <stop offset="1" stopColor="#a8b5a6" />
    </linearGradient>
    <linearGradient id={`${prefix}-v2-metal`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#e7e7cf" />
      <stop offset=".35" stopColor="#a8b9aa" />
      <stop offset=".65" stopColor="#d0d4bb" />
      <stop offset="1" stopColor="#6c8a80" />
    </linearGradient>
  </defs>;
}

function Fastener({ x, y, prefix }: { x: number; y: number; prefix: string }) {
  return <g transform={`translate(${x} ${y})`} className="melodica-v2-fastener">
    <circle r="3.9" fill={`url(#${prefix}-v2-metal)`} />
    <circle r="2.7" />
    <path d="M -1.7 1.2 L 1.7 -1.2" />
  </g>;
}

/**
 * Enlarged teaching instrument. The shell keeps the existing key coordinates:
 * white keys start at (64, 140) and end at y=420. Its details imply an air
 * instrument without asserting a particular commercial model or key count.
 */
export function MelodicaShellV2({ prefix }: ShellProps) {
  return <g className="melodica-v2-shell" pointerEvents="none" aria-hidden="true">
    <MelodicaDefinitionsV2 prefix={prefix} />
    <path d="M 61 122 H 1294 Q 1326 122 1327 154 V 433 Q 1327 468 1290 470 H 69 Q 34 468 33 436 V 155 Q 33 124 61 122 Z" className="melodica-v2-ground-shadow" />
    <path d="M 67 113 H 1291 Q 1325 113 1325 147 V 429 Q 1325 461 1291 463 H 67 Q 34 461 34 430 V 147 Q 34 113 67 113 Z" fill={`url(#${prefix}-v2-edge)`} className="melodica-v2-body-edge" />
    <path d="M 65 111 H 1293 Q 1323 111 1323 143 V 423 Q 1323 453 1292 456 H 66 Q 37 453 37 423 V 143 Q 37 112 65 111 Z" fill={`url(#${prefix}-v2-case)`} className="melodica-v2-body-paint" />
    <path d="M 57 122 Q 62 117 76 117 H 1284 Q 1307 117 1315 134" className="melodica-v2-top-reflection" />
    <path d="M 44 145 V 420 Q 44 444 69 447 H 1288 Q 1315 445 1315 420 V 145" className="melodica-v2-case-seam" />
    <path d="M 49 425 Q 51 444 74 446 H 1286 Q 1305 444 1310 430" className="melodica-v2-front-highlight" />
    <rect x="54" y="131" width="1254" height="311" rx="10" fill={`url(#${prefix}-v2-rim)`} />
    <rect x="57" y="134" width="1247" height="302" rx="7" fill={`url(#${prefix}-v2-bed)`} className="melodica-v2-keywell" />
    <path d="M 61 140 H 1300 M 61 425 H 1300" className="melodica-v2-well-seam" />

    <g className="melodica-v2-toprail">
      <path d="M 83 125 H 237 M 1124 125 H 1277" className="melodica-v2-rail-line" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={253 + i * 11} y="120" width="5" height="8" rx="2.5" className="melodica-v2-air-slot" />)}
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={986 + i * 11} y="120" width="5" height="8" rx="2.5" className="melodica-v2-air-slot" />)}
      <text x="680" y="128.5" textAnchor="middle" className="melodica-v2-wordmark">MELODICA</text>
      <path d="M 573 123.5 H 613 M 747 123.5 H 787" className="melodica-v2-brand-line" />
    </g>

    <g className="melodica-v2-inlet">
      <path d="M 34 244 Q 25 244 24 254 V 274 Q 25 283 34 283 H 48 V 244 Z" fill={`url(#${prefix}-v2-cream)`} />
      <path d="M 24 253 H 48 M 24 274 H 48" className="melodica-v2-inlet-seam" />
      <ellipse cx="48" cy="263.5" rx="10" ry="22" fill={`url(#${prefix}-v2-edge)`} />
      <ellipse cx="49" cy="263.5" rx="6.2" ry="16.5" className="melodica-v2-port-ring" />
      <ellipse cx="50" cy="263.5" rx="3.2" ry="11.5" className="melodica-v2-port-core" />
      <path d="M 27 249 Q 23 263 27 278" className="melodica-v2-socket-highlight" />
    </g>

    <g className="melodica-v2-lowerrail">
      <path d="M 90 438 H 216 M 1142 438 H 1230" className="melodica-v2-rail-line" />
      <path d="M 94 442 H 211 M 1147 442 H 1226" className="melodica-v2-rail-shadow" />
      <circle cx="1270" cy="439" r="9" className="melodica-v2-release-ring" />
      <circle cx="1270" cy="438" r="6.7" fill={`url(#${prefix}-v2-cream)`} />
      <path d="M 1267 437.5 H 1273 M 1267 440 H 1273 M 1269 435 H 1271" className="melodica-v2-release-mark" />
    </g>

    <Fastener x={49} y={139} prefix={prefix} />
    <Fastener x={1311} y={139} prefix={prefix} />
    <Fastener x={49} y={427} prefix={prefix} />
    <Fastener x={1311} y={427} prefix={prefix} />
  </g>;
}
