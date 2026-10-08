export function createInputFrame({
  racing,
  lesson,
  keys,
  mobile,
  actions,
  autoThrottle,
  toggleDrift,
  driftLatched,
  lastSteer,
  dt
}) {
  const keyboardSteer = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const keyboardTurning = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].some(code => keys.has(code));
  const rawSteer = racing ? (keyboardTurning ? keyboardSteer : mobile.steer(dt)) : 0;
  const throttle = racing && (lesson || autoThrottle || keys.has('KeyW') || keys.has('ArrowUp') || mobile.down('throttle'));
  const brake = racing && (keys.has('KeyS') || keys.has('ArrowDown') || mobile.down('brake'));
  const driftHeld = racing && (mobile.down('drift') || (toggleDrift ? driftLatched : keys.has('Space')));
  return {
    rawSteer,
    throttle,
    brake,
    driftHeld,
    driftSteer: rawSteer || (!toggleDrift ? 0 : lastSteer),
    commands: {
      mini: racing && actions.has('KeyE'),
      nitro: racing && (actions.has('ShiftLeft') || actions.has('ShiftRight')),
      emp: racing && actions.has('KeyQ'),
      restart: racing && actions.has('KeyR')
    }
  };
}
