const DEFAULT_SAMPLE_LIMIT = 12000;
const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const p = ratio => sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] || 0;
  return {avg: round(average(values)), p50: round(p(.5)), p95: round(p(.95)), p99: round(p(.99)), max: round(sorted.at(-1) || 0)};
}
// Simulation may cap catch-up work; diagnostics must retain the actual elapsed time.
export function frameTiming(seconds) {
  const raw = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return {frameMs: raw * 1000, dt: Math.min(raw, .08), droppedMs: Math.max(0, raw - .08) * 1000};
}
export function summarizePerformanceSamples(samples, {slowFrameMs = 50, verySlowFrameMs = 100} = {}) {
  const frames = samples.map(s => s.frameMs);
  const steps = samples.map(s => s.steps || 0);
  const names = new Set(samples.flatMap(s => Object.keys(s.phases || {})));
  const phases = {};
  for (const name of names) phases[name] = distribution(samples.map(s => s.phases?.[name] || 0));
  return {
    samples: samples.length, durationMs: round(frames.reduce((a, b) => a + b, 0)),
    frame: {...distribution(frames), slow: frames.filter(n => n > slowFrameMs).length, verySlow: frames.filter(n => n > verySlowFrameMs).length},
    physics: {avgSteps: round(average(steps)), maxSteps: Math.max(0, ...steps), droppedMs: round(samples.reduce((n, s) => n + (s.droppedMs || 0), 0))},
    phases, gpuMs: null,
    render: {calls: distribution(samples.map(s => s.renderInfo?.calls || 0)), triangles: distribution(samples.map(s => s.renderInfo?.triangles || 0))},
    uiWrites: distribution(samples.map(s => s.uiWrites || 0))
  };
}
export function comparableContext(a, b) {
  const keys = ['backend','width','height','dpr','scene','craft','quality','language','scenario','seed','inputHash'];
  return !!a && !!b && keys.every(key => a[key] === b[key]);
}
export function createPerformanceProbe({enabled = false, storageKey = 'apex-performance-baseline', sampleLimit = DEFAULT_SAMPLE_LIMIT,
  now = () => performance.now(), storage, documentRef = globalThis.document, renderer = null, getContext = () => ({}), reportIntervalMs = 500} = {}) {
  const buffer = [];
  let frame = null, panel = null, textNode = null, exportNode = null, report = summarizePerformanceSamples([]);
  let totalFrames = 0, lastReportAt = -Infinity, dirty = false, skipNext = false, runContext = null, runId = 0;
  let savedCache = null;
  const ordered = () => totalFrames <= sampleLimit ? buffer.slice() : [...buffer.slice(totalFrames % sampleLimit), ...buffer.slice(0, totalFrames % sampleLimit)];
  function summary() {
    if (dirty) { report = summarizePerformanceSamples(ordered()); dirty = false; }
    return {...report, totalFrames, retainedFrames: buffer.length, runId, context: runContext || getContext()};
  }
  function readSaved() {
    try { return JSON.parse((storage || globalThis.localStorage)?.getItem(storageKey) || 'null') || {}; } catch { return {}; }
  }
  function startRun(context = {}) {
    if (!enabled) return;
    buffer.length = 0; totalFrames = 0; frame = null; dirty = true; skipNext = true;
    runContext = {...getContext(), ...context}; runId++; lastReportAt = -Infinity;
    savedCache = readSaved();
  }
  function makePanel() {
    if (!enabled || panel || !documentRef?.body) return;
    panel = documentRef.createElement('aside'); panel.id = 'perfPanel'; panel.dataset.noTranslate = '';
    panel.innerHTML = '<strong>APEX PERF · RACE ONLY</strong><pre></pre><div><button type="button" data-perf-save="baseline">Save baseline</button><button type="button" data-perf-save="candidate">Save candidate</button></div><div><button type="button" data-perf-export>Export JSON</button></div><output id="perfExport" hidden></output>';
    textNode = panel.querySelector('pre'); exportNode = panel.querySelector('output');
    panel.addEventListener('click', event => {
      const label = event.target?.dataset?.perfSave;
      if (label) save(label);
      else if (event.target?.hasAttribute('data-perf-export')) {
        const payload = JSON.stringify(exportReport(), null, 2);
        exportNode.textContent = payload; exportNode.hidden = false;
        const link = documentRef.createElement('a'); link.download = 'apex-performance.json';
        const url = URL.createObjectURL(new Blob([payload], {type:'application/json'})); link.href = url; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
    documentRef.body.append(panel);
  }
  function beginFrame(frameMs, extra = {}) {
    if (!enabled) return;
    makePanel();
    frame = {frameMs, phases: {}, steps: 0, counters: {}, ...extra};
  }
  function measure(name, callback) {
    if (!enabled || !frame) return callback();
    const start = now();
    try { return callback(); } finally { if(frame)frame.phases[name] = (frame.phases[name] || 0) + now() - start; }
  }
  function endFrame(extra = {}) {
    if (!enabled || !frame) return;
    const phase = extra.phase || 'racing';
    if (phase !== 'racing') { skipNext = true; frame = null; return; }
    if (skipNext) { skipNext = false; frame = null; return; }
    frame.renderInfo = renderer ? {...renderer.info?.render} : {};
    Object.assign(frame, extra);
    runContext ||= getContext();
    buffer[totalFrames % sampleLimit] = frame; totalFrames++; dirty = true;
    const time = now();
    if (textNode && time - lastReportAt >= reportIntervalMs) {
      lastReportAt = time; const s = summary(), context = runContext;
      const baseline = savedCache?.baseline;
      const delta = baseline?.schema === 2 && comparableContext(baseline.context, context) ? `\nvs baseline p95 ${round(s.frame.p95 - baseline.frame.p95)}ms` : '';
      textNode.textContent = `backend ${context.backend || 'webgl2'} · ${context.width || 0}x${context.height || 0} @${context.dpr || 1}\np50 ${s.frame.p50}ms · p95 ${s.frame.p95}ms · p99 ${s.frame.p99}ms\n>50ms ${s.frame.slow} · >100ms ${s.frame.verySlow} · max ${s.frame.max}ms\n${s.samples} race frames · GPU timing unavailable${delta}`;
    }
    frame = null;
  }
  function exportReport() { return {schema: 2, ...summary(), savedAt: new Date().toISOString(), frames: ordered()}; }
  function save(label = 'baseline') {
    if (!enabled || !buffer.length) return false;
    const payload = exportReport(), next = {...readSaved(), [label]: payload};
    try { const store = storage || globalThis.localStorage; if(!store)return false; store.setItem(storageKey, JSON.stringify(next)); savedCache = next; return true; } catch { return false; }
  }
  return {enabled, beginFrame, measure, endFrame, startRun, save, readSaved, summary, exportReport, samples: ordered,
    addCounter(name, amount=1){if(frame)frame.counters[name]=(frame.counters[name]||0)+amount;},
    setSteps(value){if(frame)frame.steps=value;}};
}
