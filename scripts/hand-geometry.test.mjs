import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Compile the TSX module without starting another HTTP preview server.
const compiler = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, entries: [] } });
after(() => compiler.close());
const { computeRightHandGeometry, validateRightHandGeometry } = await compiler.ssrLoadModule('/src/RightHandRigV2.tsx');
const centers = [77, 231, 385, 539, 693];

test('right-hand projections keep joints finite, unextended and aligned to all five key centers', () => {
  for (const activeFinger of [null, 1, 2, 3, 4, 5]) {
    assert.deepEqual(validateRightHandGeometry(activeFinger), []);
    const digits = computeRightHandGeometry(activeFinger);
    assert.equal(digits.length, 5);
    digits.forEach((digit, i) => {
      assert.equal(digit.points.length, i === 0 ? 3 : 4, 'thumb has two joints; other fingers have three');
      const tip = digit.points.at(-1);
      assert.ok(Math.abs(tip.x - centers[i]) < .1, 'fingertip must remain on its white-key center');
      assert.ok(Math.hypot(tip.x - digit.target.x, tip.y - digit.target.y) < .1);
      for (let j = 0; j < digit.lengths.length; j++) {
        const a = digit.points[j], b = digit.points[j + 1];
        assert.ok(Math.hypot(b.x - a.x, b.y - a.y) <= digit.lengths[j] + .02);
        assert.ok(b.y <= a.y, 'depth flexion must not create a sideways folded-back finger');
      }
    });
  }
});

test('pressing one finger keeps all other fingertips at their resting targets', () => {
  const resting = computeRightHandGeometry(null);
  for (let active = 1; active <= 5; active++) {
    const pressed = computeRightHandGeometry(active);
    pressed.forEach((digit, i) => {
      assert.equal(digit.target.x, resting[i].target.x);
      assert.equal(digit.target.y - resting[i].target.y, i === active - 1 ? 13 : 0);
    });
  }
});
