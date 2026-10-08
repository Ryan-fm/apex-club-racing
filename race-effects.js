import * as THREE from 'three';
// Particles and tyre marks live in world space: the kart drives away from them.
export function createRaceEffects(scene) {
  const count=640,positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),alphas=new Float32Array(count);
  const lives=new Float32Array(count),durations=new Float32Array(count),velocities=new Float32Array(count*3);
  const g=new THREE.BufferGeometry();
  for(const [name,array,size] of [['position',positions,3],['color',colors,3],['size',sizes,1],['alpha',alphas,1]])g.setAttribute(name,new THREE.BufferAttribute(array,size).setUsage(THREE.DynamicDrawUsage));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,
    uniforms:{pixelScale:{value:700}},
    vertexShader:`attribute float size; attribute float alpha; varying vec3 vColor; varying float vAlpha; uniform float pixelScale; void main(){vColor=color;vAlpha=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*pixelScale/max(1.,-p.z),1.,65.);}`,
    fragmentShader:`varying vec3 vColor; varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(.15,1.,d);gl_FragColor=vec4(vColor,vAlpha*a);}`});
  const points=new THREE.Points(g,mat);points.frustumCulled=false;scene.add(points);
  const markCount=480,markPositions=new Float32Array(markCount*18),markAlphas=new Float32Array(markCount*6),markLife=new Float32Array(markCount);
  const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.BufferAttribute(markPositions,3));mg.setAttribute('alpha',new THREE.BufferAttribute(markAlphas,1));
  const mm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`attribute float alpha;varying float a;void main(){a=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying float a;void main(){gl_FragColor=vec4(.022,.035,.046,a);}`});
  const marks=new THREE.Mesh(mg,mm);marks.frustumCulled=false;scene.add(marks);
  let cursor=0,markCursor=0,emission=0,previous=[null,null],activeParticles=0,activeMarks=0,particlePositionDirty=false,particleStaticDirty=false,particleAlphaDirty=false,markPositionDirty=false,markAlphaDirty=false;
  const p=new THREE.Vector3(),v=new THREE.Vector3(),tint=new THREE.Color();
  function emit(position,velocity,color,size,life){
    const i=cursor++%count,pi=i*3;
    positions[pi]=position.x;positions[pi+1]=position.y;positions[pi+2]=position.z;
    velocities[pi]=velocity.x;velocities[pi+1]=velocity.y;velocities[pi+2]=velocity.z;
    colors[pi]=color.r;colors[pi+1]=color.g;colors[pi+2]=color.b;
    sizes[i]=size;lives[i]=durations[i]=life;particlePositionDirty=true;particleStaticDirty=true;particleAlphaDirty=true;
  }
  function mark(a,b,side){
    if(a.distanceToSquared(b)>100)return;
    const i=markCursor++%markCount,base=i*18,wx=side.x*.65,wy=side.y*.65,wz=side.z*.65;
    const verts=[a.x-wx,a.y-wy,a.z-wz,a.x+wx,a.y+wy,a.z+wz,b.x-wx,b.y-wy,b.z-wz,b.x-wx,b.y-wy,b.z-wz,a.x+wx,a.y+wy,a.z+wz,b.x+wx,b.y+wy,b.z+wz];
    markPositions.set(verts,base);markLife[i]=1;markPositionDirty=true;markAlphaDirty=true;
  }
  return {
    reset(){lives.fill(0);alphas.fill(0);markLife.fill(0);markAlphas.fill(0);previous=[null,null];emission=0;activeParticles=0;activeMarks=0;g.attributes.alpha.needsUpdate=true;mg.attributes.alpha.needsUpdate=true;},
    stats(){return {particles:activeParticles,marks:activeMarks};},
    update(dt,player,state,frame,boosting){
      mat.uniforms.pixelScale.value=innerHeight;
      activeParticles=0;activeMarks=0;particlePositionDirty=false;particleStaticDirty=false;particleAlphaDirty=false;markPositionDirty=false;markAlphaDirty=false;
      for(let i=0;i<count;i++){
        if(lives[i]<=0){if(alphas[i]!==0){alphas[i]=0;particleAlphaDirty=true;}continue;}
        lives[i]=Math.max(0,lives[i]-dt);alphas[i]=lives[i]/(durations[i]||1)*.8;activeParticles++;particlePositionDirty=true;particleAlphaDirty=true;
        for(let j=0;j<3;j++)positions[i*3+j]+=velocities[i*3+j]*dt;
        velocities[i*3+1]+=dt*1.8;
      }
      for(let i=0;i<markCount;i++){
        if(markLife[i]<=0){if(markAlphas[i*6]!==0){for(let j=0;j<6;j++)markAlphas[i*6+j]=0;markAlphaDirty=true;}continue;}
        markLife[i]=Math.max(0,markLife[i]-dt/5);activeMarks++;markAlphaDirty=true;
        for(let j=0;j<6;j++)markAlphas[i*6+j]=markLife[i]*.38;
      }
      emission+=dt;
      if(emission>=1/45){
        emission=0;
        for(let side=-1;side<=1;side+=2){
          const fx=player.userData.fx;
          const wheel=p.set(side*(fx?.wheelX??5.5),-3.3,fx?.wheelZ??-4.4).applyQuaternion(player.quaternion).add(player.position).clone();
          // Project onto the track plane, independent of the visual hop/bank.
          wheel.addScaledVector(frame.normal,-wheel.clone().sub(frame.p).dot(frame.normal)+.18);
          const idx=side===-1?0:1;
          if(state.drift.active){
            if(previous[idx])mark(previous[idx],wheel,frame.side);
            previous[idx]=wheel.clone();
            tint.setHex(state.drift.charge>=.78?0xffa82b:state.drift.charge>=.32?0x28dfff:0xffe3a4);
            for(let n=0;n<3;n++){
              v.copy(frame.tan).multiplyScalar(-18-Math.random()*15).addScaledVector(frame.side,side*(4+Math.random()*10)).addScaledVector(frame.normal,2+Math.random()*5);
              emit(wheel,v,tint,.32+Math.random()*.6,.2+Math.random()*.35);
            }
            v.copy(frame.normal).multiplyScalar(3).addScaledVector(frame.tan,-5);emit(wheel.clone().addScaledVector(frame.normal,1.6),v,new THREE.Color(.65,.73,.75),2+Math.random()*1.5,.5);
          }else previous[idx]=null;
          if(boosting&&!state.drift.active){
            p.set(side*(fx?.nozzleX??2.1),fx?.nozzleY??-1.3,fx?.nozzleZ??-9).applyQuaternion(player.quaternion).add(player.position);
            v.copy(frame.tan).multiplyScalar(-22).addScaledVector(frame.normal,Math.random()*2);
            emit(p,v,tint.setHex(state.nitro>0?0x43cfff:0xffa83e),1.6,.23);
          }
        }
      }
      if(particlePositionDirty)g.attributes.position.needsUpdate=true;
      if(particleStaticDirty){g.attributes.color.needsUpdate=true;g.attributes.size.needsUpdate=true;}
      if(particleAlphaDirty)g.attributes.alpha.needsUpdate=true;
      if(markPositionDirty)mg.attributes.position.needsUpdate=true;
      if(markAlphaDirty)mg.attributes.alpha.needsUpdate=true;
    }
  };
}
