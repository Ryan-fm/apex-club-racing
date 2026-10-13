import * as THREE from './vendor/three/build/three.module.min.js';

// Local CC0 photography maps. World projection keeps texel density stable on
// both swept curbs and differently sized architectural instances.
const loader=new THREE.TextureLoader(),cache=new Map(),pending=[];
export function cityTexture(asset,channel='color'){
 const key=`${asset}-${channel}`;if(cache.has(key))return cache.get(key);
 let complete;const ready=new Promise(resolve=>complete=resolve);pending.push(ready);
 const texture=loader.load(new URL(`./assets/city/${key}.jpg`,import.meta.url).href,()=>complete(),undefined,()=>complete());
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
 if(channel==='color')texture.colorSpace=THREE.SRGBColorSpace;
 cache.set(key,texture);return texture;
}
export function cityTexturesReady(){return Promise.all(pending);}
export function applyCitySurface(material,asset,scale=.04,program='surface'){
 material.map=cityTexture(asset);material.roughnessMap=cityTexture(asset,'roughness');material.normalMap=cityTexture(asset,'normal');material.normalScale.set(.17,.17);
 const before=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{
  before?.call(material,shader);
  shader.vertexShader='varying vec3 vCityWorld;varying vec3 vCityNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 cityPosition=vec4(transformed,1.);vec3 cityNormal=objectNormal;
   #ifdef USE_INSTANCING
    cityPosition=instanceMatrix*cityPosition;cityNormal=mat3(instanceMatrix)*cityNormal;
   #endif
   vCityWorld=(modelMatrix*cityPosition).xyz;vCityNormal=normalize(mat3(modelMatrix)*cityNormal);
  `);
  shader.fragmentShader=`varying vec3 vCityWorld;varying vec3 vCityNormal;
   vec2 cityUv(){vec3 n=abs(normalize(vCityNormal));return (n.y>max(n.x,n.z)?vCityWorld.xz:n.x>n.z?vCityWorld.zy:vCityWorld.xy)*${scale.toFixed(5)};}
  `+shader.fragmentShader;
  const albedo={concrete_floor_02:'sampledDiffuseColor.rgb=vec3(.42)+sampledDiffuseColor.rgb*.8;',pavement_03:'sampledDiffuseColor.rgb=vec3(.1)+sampledDiffuseColor.rgb*.9;',grass_ground:'sampledDiffuseColor.rgb*=vec3(.7,1.5,.65);',asphalt_pit_lane:'float cityAggregate=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));sampledDiffuseColor.rgb=vec3(cityAggregate)*vec3(.95,1.02,1.13)+vec3(.025);'}[asset]||'';
  for(const [chunk,uv]of [['map_fragment','vMapUv'],['roughnessmap_fragment','vRoughnessMapUv'],['normal_fragment_maps','vNormalMapUv']]){
   let code=THREE.ShaderChunk[chunk].replaceAll(uv,'cityUv()');if(chunk==='map_fragment')code=code.replace('diffuseColor *= sampledDiffuseColor;',albedo+'\ndiffuseColor *= sampledDiffuseColor;');shader.fragmentShader=shader.fragmentShader.replace(`#include <${chunk}>`,code);
  }
 };
 material.customProgramCacheKey=()=>`city-world-surface/${program}/${asset}/${scale}`;
 return material;
}
