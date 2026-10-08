export function createDomWriter({onWrite = () => {}} = {}) {
  const values = new WeakMap();
  function changed(node, key, value) {
    let map = values.get(node);
    if (!map) {
      map = new Map();
      values.set(node, map);
    }
    if (map.get(key) === value) return false;
    map.set(key, value);
    onWrite();
    return true;
  }
  const text = (node, value) => {
    const next = String(value);
    if (node && changed(node, 'textContent', next)) node.textContent = next;
  };
  const html = (node, value) => {
    const next = String(value);
    if (node && changed(node, 'innerHTML', next)) node.innerHTML = next;
  };
  const attr = (node, name, value) => {
    const next = String(value);
    if (node && changed(node, `attr:${name}`, next)) node.setAttribute(name, next);
  };
  const hidden = (node, value) => {
    const next = !!value;
    if (node && changed(node, 'hidden', next)) node.hidden = next;
  };
  const style = (node, name, value) => {
    const next = String(value);
    if (node && changed(node, `style:${name}`, next)) node.style[name] = next;
  };
  const classToggle = (node, name, value) => {
    const next = !!value;
    if (node && changed(node, `class:${name}`, next)) node.classList.toggle(name, next);
  };
  return {text, html, attr, hidden, style, classToggle};
}

export function cacheRaceNodes(root = document) {
  const node = selector => root.querySelector(selector);
  return {
    speed: node('#speed'),
    sector: node('#sector'),
    lap: node('#lap'),
    rank: node('#rank'),
    boostFill: node('#boostFill'),
    shieldFill: node('#shieldFill'),
    weaponFill: node('#weaponFill'),
    boostValue: node('#boostValue'),
    shieldValue: node('#shieldValue'),
    weaponValue: node('#weaponValue'),
    courseProgress: node('#courseProgress'),
    mapPlayer: node('#mapPlayer'),
    raceTime: node('#raceTime'),
    miniButton: node('[data-drive="mini"]'),
    miniState: node('#miniState'),
    stuntPrompt: node('#stuntPrompt'),
    boostCountdown: node('#boostCountdown'),
    boostTitle: node('#boostTitle'),
    boostStatus: node('.boost-status'),
    driftFill: node('#driftFill'),
    driftPercent: node('#driftPercent'),
    driftLabel: node('#driftLabel'),
    driftHint: node('#driftHint'),
    blueScore: node('#blueScore'),
    redScore: node('#redScore'),
    leaderboard: node('#leaderboard'),
    empStatus: node('#empStatus'),
    empButton: node('[data-drive="emp"]')
  };
}
