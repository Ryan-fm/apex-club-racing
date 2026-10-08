import test from 'node:test';
import assert from 'node:assert/strict';
import {createInputFrame} from '../runtime/input-frame.js';

const mobile = ({held = [], steer = 0} = {}) => ({
  down: name => held.includes(name),
  steer: () => steer
});

test('input frame keeps physical keyboard defaults and one-shot commands separate', () => {
  const frame = createInputFrame({
    racing: true,
    lesson: false,
    keys: new Set(['ArrowUp', 'ArrowLeft', 'Space']),
    mobile: mobile(),
    actions: new Set(['KeyE', 'ShiftLeft']),
    autoThrottle: false,
    toggleDrift: false,
    driftLatched: false,
    lastSteer: 0,
    dt: 1 / 60
  });
  assert.equal(frame.throttle, true);
  assert.equal(frame.brake, false);
  assert.equal(frame.rawSteer, -1);
  assert.equal(frame.driftHeld, true);
  assert.deepEqual(frame.commands, {mini: true, nitro: true, emp: false, restart: false});
});

test('touch steering feeds raw steer and toggle drift keeps last direction for charging', () => {
  const frame = createInputFrame({
    racing: true,
    lesson: false,
    keys: new Set(),
    mobile: mobile({held: ['drift'], steer: .5}),
    actions: new Set(['KeyQ']),
    autoThrottle: true,
    toggleDrift: true,
    driftLatched: true,
    lastSteer: -1,
    dt: 1 / 60
  });
  assert.equal(frame.rawSteer, .5);
  assert.equal(frame.throttle, true);
  assert.equal(frame.driftHeld, true);
  assert.equal(frame.driftSteer, .5);
  assert.equal(frame.commands.emp, true);
});

test('paused or finished races produce no driving input', () => {
  const frame = createInputFrame({
    racing: false,
    lesson: false,
    keys: new Set(['ArrowUp', 'KeyD', 'Space']),
    mobile: mobile({held: ['throttle', 'drift'], steer: 1}),
    actions: new Set(['KeyE', 'ShiftLeft', 'KeyQ', 'KeyR']),
    autoThrottle: true,
    toggleDrift: false,
    driftLatched: false,
    lastSteer: 1,
    dt: 1 / 60
  });
  assert.equal(frame.rawSteer, 0);
  assert.equal(frame.throttle, false);
  assert.equal(frame.driftHeld, false);
  assert.deepEqual(frame.commands, {mini: false, nitro: false, emp: false, restart: false});
});
