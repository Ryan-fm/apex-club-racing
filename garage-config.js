export const GARAGE_KEY='apex-garage-v1';
export const DEFAULT_CUSTOMIZATION=Object.freeze({paint:null,finish:'gloss',livery:'solid',accent:'#f3e8ca',exhaust:'jet',flame:'#43cfff'});
export const FINISHES=['gloss','satin','chrome'];
export const LIVERIES=['solid','stripes','circuit'];
export const EXHAUSTS=['jet','pulse','off'];
const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function sanitizeCustomization(value={}){const v=value&&typeof value==='object'?value:{};return {paint:hex(v.paint)?v.paint:null,finish:FINISHES.includes(v.finish)?v.finish:'gloss',livery:LIVERIES.includes(v.livery)?v.livery:'solid',accent:hex(v.accent)?v.accent:DEFAULT_CUSTOMIZATION.accent,exhaust:EXHAUSTS.includes(v.exhaust)?v.exhaust:'jet',flame:hex(v.flame)?v.flame:DEFAULT_CUSTOMIZATION.flame};}
export function readGarage(storage){try{storage=storage||globalThis.localStorage;const raw=JSON.parse(storage.getItem(GARAGE_KEY));const cars={};for(let i=0;i<6;i++)if(raw?.cars?.[i])cars[i]=sanitizeCustomization(raw.cars[i]);return {cars};}catch{return {cars:{}};}}
export function saveCar(storage,index,value){if(!Number.isInteger(index)||index<0||index>5)return false;try{storage=storage||globalThis.localStorage;const state=readGarage(storage);state.cars[index]=sanitizeCustomization(value);storage.setItem(GARAGE_KEY,JSON.stringify(state));return true;}catch{return false;}}
