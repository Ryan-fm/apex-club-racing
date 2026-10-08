import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePerformanceSamples,createPerformanceProbe} from '../runtime/performance.js';

test('performance summary reports stable percentiles and slow frames', () => {
  const report = summarizePerformanceSamples([
    {frameMs: 16, steps: 2, phases: {simulation: 4, render: 7}},
    {frameMs: 17, steps: 2, phases: {simulation: 5, render: 8}},
    {frameMs: 52, steps: 7, phases: {simulation: 19, render: 20}},
    {frameMs: 111, steps: 10, phases: {simulation: 42, render: 38}}
  ]);
  assert.equal(report.samples, 4);
  assert.equal(report.frame.p50, 17);
  assert.equal(report.frame.p95, 111);
  assert.equal(report.frame.slow, 2);
  assert.equal(report.frame.verySlow, 1);
  assert.equal(report.physics.maxSteps, 10);
  assert.equal(report.phases.simulation.max, 42);
});

test('performance probe measures labelled phases without running when disabled', () => {
  let time = 0;
  const probe = createPerformanceProbe({enabled: true, now: () => time, documentRef: null, renderer: {info: {render: {calls: 3, triangles: 90, points: 12}}, domElement: {width: 800, height: 450}, getPixelRatio: () => 1.5}});
  probe.beginFrame(16.7);
  const value = probe.measure('simulation', () => { time += 4.25; return 'ok'; });
  probe.setSteps(3);
  probe.endFrame({backend: 'webgl2'});
  assert.equal(value, 'ok');
  assert.equal(probe.summary().phases.simulation.avg, 4.25);
  assert.equal(probe.summary().physics.avgSteps, 3);

  const disabled = createPerformanceProbe({enabled: false});
  assert.equal(disabled.measure('noop', () => 7), 7);
  disabled.beginFrame(100);
  disabled.endFrame();
  assert.equal(disabled.summary().samples, 0);
});

import {frameTiming,comparableContext} from '../runtime/performance.js';
test('real long frames remain visible while physics catch-up is bounded',()=>{
 const t=frameTiming(.18);assert.equal(t.frameMs,180);assert.equal(t.dt,.08);assert(Math.abs(t.droppedMs-100)<1e-9);
 const p=createPerformanceProbe({enabled:true,documentRef:null});p.beginFrame(t.frameMs,{droppedMs:t.droppedMs});p.endFrame({phase:'racing'});
 assert.equal(p.summary().frame.verySlow,1);assert.equal(p.summary().frame.max,180);assert.equal(p.summary().physics.droppedMs,100);
});
test('lobby, countdown and pause cannot dilute race measurements; resume skips its boundary',()=>{
 const p=createPerformanceProbe({enabled:true,documentRef:null});
 const tick=(ms,phase)=>{p.beginFrame(ms);p.endFrame({phase});};
 tick(500,'lobby');tick(400,'countdown');tick(700,'racing');tick(180,'racing');tick(5000,'paused');tick(5000,'racing');tick(16,'racing');
 assert.equal(p.summary().samples,2);assert.equal(p.summary().frame.max,180);
 p.startRun();tick(200,'racing');tick(17,'racing');assert.equal(p.summary().samples,1);assert.equal(p.summary().frame.max,17);
});
test('full sample buffer retains newest frames without making panel update every frame',()=>{
 let time=0,writes=0,reads=0;const pre={set textContent(v){writes++;}},output={};
 const panel={dataset:{},querySelector:s=>s==='pre'?pre:output,addEventListener(){}};
 const p=createPerformanceProbe({enabled:true,sampleLimit:24,reportIntervalMs:500,now:()=>time,storage:{getItem(){reads++;return null;}},documentRef:{body:{append(){}},createElement:()=>panel}});
 for(let i=0;i<240;i++){time+=16;p.beginFrame(i);p.endFrame({phase:'racing'});}
 assert.equal(p.samples().length,24);assert.equal(p.samples()[0].frameMs,216);assert(writes<=9,`panel wrote ${writes} times`);assert.equal(reads,0);
});
test('saved comparisons require equal scene, language, resolution and input tape',()=>{
 const a={scene:'citadel',language:'en',width:1280,height:720,inputHash:'a'};assert(comparableContext(a,{...a}));
 for(const key of ['scene','language','width','inputHash'])assert(!comparableContext(a,{...a,[key]:'different'}));
});
