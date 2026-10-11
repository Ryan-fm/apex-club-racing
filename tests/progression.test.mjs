import test from 'node:test';
import assert from 'node:assert/strict';
import {weekKey,normalizeProgress,carUnlocked,taskReady,WEEKLY_TASKS} from '../progression-rules.js';
import {sanitizeCustomization} from '../garage-config.js';
test('Shanghai weekly reset occurs Monday midnight and keeps owned rewards',()=>{
 const sunday=Date.parse('2026-10-11T15:59:59Z'),monday=sunday+1000;
 assert.equal(weekKey(sunday),'2026-10-05');assert.equal(weekKey(monday),'2026-10-12');
 const previous={week:'2026-10-05',total_seconds:7200,week_seconds:600,week_races:3,claimed:['warmup'],liveries:['ember']};
 const current=normalizeProgress(previous,monday);assert.equal(current.week_seconds,0);assert.equal(current.week_races,0);assert.deepEqual(current.claimed,[]);assert.ok(current.liveries.includes('ember'));assert.equal(current.total_seconds,7200);
});
test('car tiers unlock exactly at the required active driving threshold',()=>{const s=normalizeProgress();assert.ok(carUnlocked(s,0));assert.ok(carUnlocked(s,1));assert.equal(carUnlocked(s,5),false);s.total_seconds=899;assert.equal(carUnlocked(s,5),false);s.total_seconds=900;assert.ok(carUnlocked(s,5));assert.equal(carUnlocked(s,4),false);s.total_seconds=7200;assert.ok(carUnlocked(s,4));assert.equal(carUnlocked(s,6),false);});
test('claim state excludes incomplete tasks and duplicate claims',()=>{const s=normalizeProgress();const t=WEEKLY_TASKS[0];s.week_seconds=599;assert.equal(taskReady(s,t),false);s.week_seconds=600;assert.ok(taskReady(s,t));s.claimed.push(t.id);assert.equal(taskReady(s,t),false);});
test('new liveries retain sanitized colors and reject malformed style input',()=>{for(const livery of ['ember','aurora','champion'])assert.equal(sanitizeCustomization({livery}).livery,livery);assert.equal(sanitizeCustomization({livery:'<script>',paint:'red'}).livery,'solid');});
