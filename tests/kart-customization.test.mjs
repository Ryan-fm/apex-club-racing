import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {craftDefs} from '../kart-catalog.js';
const runtime=new URL('../vendor/three/build/three.module.min.js',import.meta.url).href,urls={};
for(const name of ['vehicle-finish','armored-kart','garage-config','kart-model','kart-customization']){
 let source=(await readFile(new URL(`../${name}.js`,import.meta.url),'utf8')).replaceAll("'three'",JSON.stringify(runtime));
 for(const [dependency,url]of Object.entries(urls))source=source.replaceAll(`'./${dependency}.js'`,JSON.stringify(url));
 urls[name]='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
}
const {makeCraft,configureKart}=await import(urls['kart-model']),{applyCustomization,animateExhaust}=await import(urls['kart-customization']);
test('all six garage cars accept body paint and liveries without replacing metal or rubber',()=>{
 const kart=makeCraft();
 for(const definition of craftDefs){configureKart(kart,definition);applyCustomization(kart,{paint:'#db436a',livery:'stripes',finish:'satin'},definition.color);let painted=0,rubber=0;
 kart.userData.model.traverse(o=>{if(o.material?.userData.bodyPaint){assert.equal(o.material.color.getHexString(),'db436a');painted++;}if(o.material?.roughness===.93)rubber++;});
 assert(painted>0);assert(rubber>0);assert(kart.userData.model.getObjectByName('Custom livery'));assert(kart.userData.model.getObjectByName('Race driver'));
 }
});
test('repeated customization replaces and disposes decals, and factory reset removes them',()=>{
 const kart=makeCraft();configureKart(kart,craftDefs[4]);applyCustomization(kart,{livery:'stripes'},0x1497a0);const old=kart.userData.model.getObjectByName('Custom livery');let disposed=0;old.children[0].geometry.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<10;i++)applyCustomization(kart,{livery:i%2?'circuit':'stripes'},0x1497a0);
 assert.equal(disposed,1);assert.equal(kart.userData.model.children.filter(o=>o.name==='Custom livery').length,1);
 applyCustomization(kart,undefined,0x1497a0);assert.equal(kart.userData.model.getObjectByName('Custom livery'),undefined);
});
test('exhaust choices affect visible flames and color, including disabling and restoring',()=>{
 const kart=makeCraft();configureKart(kart,craftDefs[0]);applyCustomization(kart,{flame:'#bb55ee',exhaust:'pulse'},0xffffff);animateExhaust(kart,.1,1,true);const first=kart.userData.engines[0];assert.equal(first.material.uniforms.tint.value.getHexString(),'bb55ee');const length=first.scale.y;
 animateExhaust(kart,.2,1,true);assert.notEqual(first.scale.y,length);
 applyCustomization(kart,{exhaust:'off'},0xffffff);animateExhaust(kart,0,1,true);assert.equal(first.visible,false);
 applyCustomization(kart,undefined,0xffffff);animateExhaust(kart,0,1,true);assert.equal(first.visible,true);
});
