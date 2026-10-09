import * as THREE from 'three';
import {makeCraft,configureKart} from '../kart-model.js';
import {craftDefs} from '../kart-catalog.js';
const images=new Map();let renderer;
// One short-lived render per factory kart, shared across all four seats.
export function roomKartImage(index){
 if(images.has(index))return images.get(index);
 try{
  renderer??=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(480,320);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1.5,.1,150);camera.position.set(23,15,28);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xd9efff,0x35445a,2.4));const light=new THREE.DirectionalLight(0xffefd4,3);light.position.set(12,25,20);scene.add(light);
  const def=craftDefs[index],kart=makeCraft(def.color);configureKart(kart,def);scene.add(kart);renderer.render(scene,camera);
  const src=renderer.domElement.toDataURL();images.set(index,src);
  const geometries=new Set(),materials=new Set();kart.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  if(images.size===craftDefs.length){renderer.dispose();renderer=null;}return src;
 }catch{return '';}
}
