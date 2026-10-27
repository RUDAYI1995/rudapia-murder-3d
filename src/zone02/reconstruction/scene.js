// 단일 원본 이미지의 보이는 공간을 조립한다. 가구는 개별 GLB, 건축은 실제 열린 벽과 창으로 구성한다.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createReferenceMaterials } from './materials.js';
import { makeColliders } from '../collide.js';
import { batchStatic } from '../batch.js';
import { mulberry32 } from '../noise.js';
import { COMPOSITION } from './composition.js';

export const REFERENCE_CAMERA=COMPOSITION.camera;
const CORRIDOR_ANGLE=COMPOSITION.corridor.angle;
const NAMES=['round-table','spindle-chair','aged-chandelier','paneled-sideboard','arched-window','molded-door-frame','wall-lantern','tripod-work-light','security-monitor','survivor'];

export async function createReferenceWorld(scene,onProgress){
  const M=await createReferenceMaterials(onProgress),loader=new GLTFLoader(),models={};
  onProgress('독립 3D 모델 10종 불러오는 중…');
  // 파일 로딩 실패는 호출자에게 전달해 누락된 모델을 기본 도형으로 대체하지 않는다.
  await Promise.all(NAMES.map(async name=>{
    const gltf=await loader.loadAsync(`/assets/reconstruction/models/${name}.glb`);
    gltf.scene.traverse(o=>{if(o.isMesh){const material=M[o.material.name];if(!material)throw new Error(`모델 재질 없음: ${name}/${o.material.name}`);o.material=material;o.castShadow=o.receiveShadow=true;if(o.material===M.glass)o.castShadow=false;}});
    models[name]=gltf.scene;
  }));
  const root=new T.Group();root.name='reference-reconstruction';scene.add(root);
  const col=makeColliders(),lights=[],corridorNodes=new Set();
  const corridor=o=>{corridorNodes.add(o);return o;};
  const add=(name,x,y,z,ry=0,scale=1)=>{const o=models[name].clone(true);o.position.set(x,y,z);o.rotation.y=ry;o.scale.setScalar(scale);root.add(o);return o;};
  const box=(w,h,d,mat,x,y,z,collision=false)=>{const geo=new T.BoxGeometry(w,h,d);if(mat.map){const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]],uv=geo.attributes.uv;for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*dims[f][0]/2.6,uv.getY(i)*dims[f][1]/2.6);}}const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);if(collision){col.addCenterBox(x,z,w,d,y-h/2,y+h/2,'wall');o.userData.collider=col.boxes.at(-1);}return o;};
  const point=(x,y,z,color,intensity,distance)=>{const l=new T.PointLight(color,intensity,distance,2);l.position.set(x,y,z);scene.add(l);lights.push(l);return l;};
  const floor=(w,d,x,z)=>{const map=M.stone.map.clone(),n=M.stone.normalMap.clone(),r=M.stone.roughnessMap.clone();for(const t of [map,n,r]){t.repeat.set(w/2.4,d/2.4);t.needsUpdate=true;}const mat=M.stone.clone();Object.assign(mat,{map,normalMap:n,roughnessMap:r});const mesh=new T.Mesh(new T.PlaneGeometry(w,d),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,0,z);mesh.receiveShadow=true;root.add(mesh);return mesh;};
  floor(8.4,26,4,12);corridor(floor(4.3,31,12.15,-1.5));floor(7,13,-3.5,18);floor(3.4,9,9.6,21.5);
  // 홀과 복도 사이의 경계도 새 출입구 위치에 맞춰 이동한다.
  box(.28,5.4,18,M.paper,8,2.7,8,true);
  // 왼쪽 벽은 창과 바깥 현관에 실제 구멍을 낸 단일 메시다.
  const wallShape=new T.Shape();wallShape.moveTo(-26,0);wallShape.lineTo(2,0);wallShape.lineTo(2,5.4);wallShape.lineTo(-26,5.4);wallShape.closePath();
  function opening(z,w,y0,h,arched){const p=new T.Path();const c=-z;p.moveTo(c-w/2,y0);p.lineTo(c-w/2,y0+h-(arched?w/2:0));if(arched)p.absarc(c,y0+h-w/2,w/2,Math.PI,0,true);else p.lineTo(c+w/2,y0+h);p.lineTo(c+w/2,y0);p.closePath();wallShape.holes.push(p);}
  for(const z of COMPOSITION.windows.centers)opening(z,1.72,COMPOSITION.windows.base,COMPOSITION.windows.height,true);
  opening(17.2,2.7,0,4.4,false);
  const leftGeo=new T.ExtrudeGeometry(wallShape,{depth:.28,bevelEnabled:false,curveSegments:36});
  // 벽 UV를 미터 기준으로 통일해 벽지 크기가 가구 크기와 독립적으로 유지된다.
  const u=leftGeo.attributes.uv;for(let i=0;i<u.count;i++)u.setXY(i,u.getX(i)/2.6,u.getY(i)/2.6);
  const left=new T.Mesh(leftGeo,M.paper);left.rotation.y=Math.PI/2;left.position.x=-.28;left.castShadow=left.receiveShadow=true;root.add(left);
  col.addBox(-.4,-2,0,26,0,5.4,'wall');
  box(8,5.4,.3,M.paper,4,2.7,-1,true);
  const ceiling=box(8.4,.22,26,M.plaster,4,5.5,12);
  const corridorCeiling=corridor(box(4.4,.2,31,M.plaster,12.2,3.85,-1.5));
  corridor(box(.28,3.8,31,M.paper,14.35,1.9,-1.5,true));
  corridor(box(.28,3.8,28,M.paper,10.0,1.9,-2,true));
  corridor(box(4.4,3.8,.25,M.paper,12.2,1.9,-17,true));
  box(3.1,2.7,.35,M.paper,9.4,4.05,17);
  box(.28,3.1,9,M.paper,11.1,1.55,21.5,true);
  // 목재 하부 벽과 몰딩을 별도 두께로 제작한다.
  const panel=(x,z,len,ry=0)=>{const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry;root.add(g);
    const q=(w,h,d,y,xx=0,zz=0)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),M.wood);m.position.set(xx,y,zz);m.castShadow=m.receiveShadow=true;g.add(m);};
    q(len,.94,.055,.53);q(len,.075,.12,1.05);q(len,.14,.13,.1);
    const n=Math.max(1,Math.round(len/.66));for(let i=0;i<n;i++){const xx=-len/2+(i+.5)*len/n,w=len/n-.1;q(w,.025,.03,.25,xx,.04);q(w,.025,.03,.86,xx,.04);for(const dx of [-w/2,w/2])q(.024,.6,.03,.55,xx+dx,.04);}return g;
  };
  panel(4,-.8,7.7);panel(.08,7.2,15.6,Math.PI/2);panel(7.82,8,17.8,-Math.PI/2);
  corridor(panel(14.15,-1.6,30.5,-Math.PI/2));corridor(panel(10.2,-1.8,27,Math.PI/2));
  for(const x of [.18,7.8]){
    box(.16,.18,25.5,M.trim,x,5.2,12);box(.21,.1,25.5,M.wood,x,5.03,12);
  }
  for(const z of [-.7,3.3,7.3,11.3,16.9,21,25])box(7.7,.14,.15,M.trim,4,5.23,z);
  for(const x of [2.3,4.8,7])box(.12,.12,25.6,M.trim,x,5.24,12);
  // 원본의 큰 문틀은 실제 통과 폭을 갖는다. 독립 모델을 배율만 바꿔 사용한다.
  const entrance=corridor(add('molded-door-frame',12.1,0,13.4));entrance.scale.set(3.1,1.32,1.9);
  for(const x of [10.12,14.2])corridor(box(.22,3.8,.4,M.trim,x,1.9,13.4));
  const curtainMat=M.fabric.clone();curtainMat.color.setHex(0x382b29);curtainMat.side=T.DoubleSide;
  for(const z of COMPOSITION.windows.centers){
    const window=add('arched-window',.07,COMPOSITION.windows.base,z,Math.PI/2);window.scale.y=COMPOSITION.windows.height/3.925;
    for(const side of [-1,1]){
      const geo=new T.PlaneGeometry(.7,4.55,20,50),pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){const yy=pos.getY(i),xx=pos.getX(i),t=(yy+2.275)/4.55;pos.setX(i,xx*(.45+.55*t)+side*.12*(1-t));pos.setZ(i,Math.sin((xx/.7+.5)*Math.PI*9)*(.035+t*.045));}
      geo.computeVertexNormals();const curtain=new T.Mesh(geo,curtainMat);curtain.rotation.y=Math.PI/2;curtain.scale.y=.95;curtain.position.set(.25,3.02,z+side*1.05);curtain.castShadow=curtain.receiveShadow=true;root.add(curtain);
    }
    const moon=new T.SpotLight(0xabcce0,95,28,.58,.6,1.5);moon.position.set(-1.2,4.3,z-.4);moon.target.position.set(7,0,z+3.8);moon.castShadow=z===6.5;moon.shadow.mapSize.set(1536,1536);moon.shadow.bias=-.0002;scene.add(moon,moon.target);lights.push(moon);
  }
  // 원본 속 창밖은 3D 나무 실루엣과 안개로 구성한다.
  const rnd=mulberry32(502),bark=M.trim.clone();bark.color.setHex(0x111c21);
  for(let i=0;i<22;i++){
    const x=-3-rnd()*15,z=-6+rnd()*29,h=5+rnd()*7;
    const trunk=new T.Mesh(new T.CylinderGeometry(.06,.16,h,7),bark);trunk.position.set(x,h/2,z);root.add(trunk);
    for(let j=0;j<4;j++){const branch=new T.Mesh(new T.CylinderGeometry(.015,.05,2+rnd()*2,5),bark);branch.position.set(x+(j%2?1:-1)*.5,h*(.45+j*.1),z);branch.rotation.z=(j%2?1:-1)*(.45+rnd()*.4);root.add(branch);}
  }
  const urnProfile=[[0,0],[.38,0],[.4,.08],[.24,.12],[.2,.55],[.34,.63],[.5,.72],[.43,.86],[.2,.91],[0,.91]];
  const urn=new T.Mesh(new T.LatheGeometry(urnProfile.map(p=>new T.Vector2(...p)),40),M.plaster);urn.position.set(-3.8,.02,15);urn.castShadow=urn.receiveShadow=true;root.add(urn);
  // 원탁·의자와 러그. 좌표는 원본의 고정 카메라에서 중심과 화면 점유율을 맞춘다.
  const tc=COMPOSITION.table;
  add('round-table',tc.x,.01,tc.z,0,tc.scale);col.addCircle(tc.x,tc.z,1.92*tc.scale,'reference-table');
  const rug=new T.Mesh(new T.PlaneGeometry(6.7,5.5),M.rug);rug.rotation.x=-Math.PI/2;rug.position.set(tc.x,.012,tc.z);rug.receiveShadow=true;root.add(rug);
  for(let i=0;i<11;i++){
    const a=i/11*Math.PI*2,r=2.15+(i%3)*.1,x=tc.x+Math.cos(a)*r,z=tc.z+Math.sin(a)*r;
    add('spindle-chair',x,.015,z,Math.atan2(tc.x-x,tc.z-z));col.addCircle(x,z,.26,'reference-chair');
  }
  add('spindle-chair',7.2,.01,8.2,-.8);add('spindle-chair',6.8,.01,11.1,-.5);
  const ch=COMPOSITION.chandelier;add('aged-chandelier',ch.x,ch.y,ch.z,.12,ch.scale);point(ch.x,3.7,ch.z,0xffca8b,7,10);
  const cb=COMPOSITION.cabinet,sideboard=add('paneled-sideboard',cb.x,.02,cb.z,cb.yaw,cb.scale);sideboard.rotation.x=cb.tilt;sideboard.scale.y=cb.heightScale;
  sideboard.updateMatrixWorld(true);const cbBox=new T.Box3().setFromObject(sideboard);col.addBox(cbBox.min.x,cbBox.min.z,cbBox.max.x,cbBox.max.z,0,cbBox.max.y,'reference-cabinet');
  const rug2=new T.Mesh(new T.PlaneGeometry(3.4,2.2),M.rug);rug2.rotation.set(-Math.PI/2,0,-.24);rug2.position.set(cb.x,.014,cb.z);rug2.receiveShadow=true;root.add(rug2);
  add('paneled-sideboard',.37,0,13.3,Math.PI/2,.86);add('security-monitor',.2,.98,13.3,Math.PI/2,.8);
  add('tripod-work-light',.4,-.02,11.8,.4,1);point(.55,1.25,11.6,0xffc071,12,7);
  // 모니터는 실제 화면 재질에 카메라 격자를 그린다. 방 전체 사진을 벽지처럼 붙이지 않는다.
  const screenCanvas=document.createElement('canvas');screenCanvas.width=512;screenCanvas.height=256;const sc=screenCanvas.getContext('2d');
  sc.fillStyle='#17252b';sc.fillRect(0,0,512,256);
  for(let k=0;k<6;k++){const x=(k%3)*170,y=Math.floor(k/3)*128;sc.strokeStyle='#7e9aa4';sc.strokeRect(x+4,y+4,162,120);for(let n=0;n<5;n++){sc.strokeStyle=`rgba(135,171,183,${.1+n*.06})`;sc.strokeRect(x+25+n*9,y+15+n*6,110-n*18,85-n*12);}}
  const st=new T.CanvasTexture(screenCanvas);st.colorSpace=T.SRGBColorSpace;M.screen.map=st;M.screen.emissiveMap=st;M.screen.needsUpdate=true;
  for(const x of [2.3,5.3,7]){add('wall-lantern',x,2.45,-.78);point(x,2.65,-.4,0xffb774,3.5,6);}
  add('wall-lantern',.18,2.6,8.8,Math.PI/2);point(.55,2.8,8.8,0xffb774,6,5);
  for(const z of [10,5,0,-5,-10]){
    for(const [x,ry]of [[10.25,Math.PI/2],[14.15,-Math.PI/2]]){
      corridor(add('wall-lantern',x,2.25,z,ry,.85));corridor(point(x+(x<12?.22:-.22),2.45,z,0xffac61,3.8,5.5));
      corridor(add('molded-door-frame',x,.01,z-1.4,ry,.86));
      // 좁은 복도 문은 입체 문짝과 틈으로 깊이를 만든다. 외부 플레이 공간은 이번 범위가 아니다.
      const door=corridor(box(.07,2.5,.83,M.wood,x+(x<12?.05:-.05),1.25,z-1.4));door.rotation.y=.08;
    }
    corridor(box(4.1,.1,.12,M.trim,12.2,3.68,z));
  }
  // 원본 오른쪽 끝의 사람은 실제 3D 실루엣이다.
  const watcher=corridor(add('survivor',12.2,.02,-10,Math.PI));watcher.scale.setScalar(.98);
  corridor(point(12.2,2.5,-14,0x9abfd2,25,10));
  for(let i=0;i<9;i++){
    const x=2+rnd()*9,z=-.75;
    if(i<3){const frame=box(.9+rnd()*.5,.75+rnd()*.3,.055,M.trim,x,2.4+rnd()*.7,z+.15);frame.rotation.z=(rnd()-.5)*.25;}
  }
  const paperMat=new T.MeshStandardMaterial({color:0x8c8678,roughness:1,side:T.DoubleSide});
  for(let i=0;i<85;i++){const p=new T.Mesh(new T.PlaneGeometry(.08+rnd()*.16,.08+rnd()*.24),paperMat);p.rotation.set(-Math.PI/2,0,rnd()*Math.PI);p.position.set(1+rnd()*14,.019+rnd()*.002,2+rnd()*14);p.receiveShadow=true;root.add(p);}
  // 낮은 해상도의 반사면을 얇게 합성해 실제 창·등불이 바닥의 젖은 부분에 비치게 한다.
  const reflector=new Reflector(new T.PlaneGeometry(16.5,34),{color:0x727879,textureWidth:768,textureHeight:768,clipBias:.003,multisample:0});
  reflector.rotation.x=-Math.PI/2;reflector.position.set(6.1,.008,7);reflector.material.transparent=true;reflector.material.depthWrite=false;
  reflector.material.uniforms.puddleMap={value:M.stone.roughnessMap};
  reflector.material.vertexShader='varying vec2 floorUv;\n'+reflector.material.vertexShader.replace('void main() {','void main() { floorUv = uv;');
  reflector.material.fragmentShader='uniform sampler2D puddleMap; varying vec2 floorUv;\n'+reflector.material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','float wet = texture2D(puddleMap, floorUv * vec2(7.0,14.0)).r; gl_FragColor = vec4(blendOverlay(base.rgb,color), (1.0-wet)*0.14);');
  reflector.userData.dynamic=true;root.add(reflector);
  // 달빛 줄기를 실제 창 위치에만 배치해 공간의 깊이를 드러낸다.
  const beamMat=new T.MeshBasicMaterial({color:0xa3c2da,transparent:true,opacity:.022,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
  for(const z of [2.5,6.5,10.5]){
    const positions=[.3,4.5,z-.7,.3,4.5,z+.7,8,.03,z+4.2,.3,4.5,z-.7,8,.03,z+4.2,8,.03,z+2.8];
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));const beam=new T.Mesh(geo,beamMat);beam.userData.dynamic=true;root.add(beam);
  }
  const particles=new Float32Array(1600*3);for(let i=0;i<particles.length;i+=3){particles[i]=rnd()*16;particles[i+1]=rnd()*5;particles[i+2]=rnd()*31-14;}
  const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(particles,3));const dust=new T.Points(pg,new T.PointsMaterial({color:0xa2b8c3,size:.012,transparent:true,opacity:.12,depthWrite:false}));root.add(dust);
  // 원본의 복도 소실점이 홀과 달라, 복도를 독립된 방향으로 조립한다. 충돌도 같은 변환을 적용한다.
  const pivot=new T.Vector3(12.1,0,13.4),rotation=new T.Matrix4().makeRotationY(CORRIDOR_ANGLE),corridorScale=new T.Vector3(...COMPOSITION.corridor.scale);
  const transform=new T.Matrix4().makeTranslation(...COMPOSITION.corridor.origin).multiply(rotation).multiply(new T.Matrix4().makeScale(...corridorScale)).multiply(new T.Matrix4().makeTranslation(...pivot.clone().negate()));
  for(const o of corridorNodes){
    const b=o.userData.collider;
    if(b){
      col.boxes.splice(col.boxes.indexOf(b),1);
      const w=b.maxX-b.minX,d=b.maxZ-b.minZ,n=Math.ceil(Math.max(w,d)/.35),alongZ=d>w;
      for(let i=0;i<n;i++){
        const cellW=alongZ?w:w/n,cellD=alongZ?d/n:d,sw=cellW*corridorScale.x,sd=cellD*corridorScale.z;
        const p=new T.Vector3(alongZ?(b.minX+b.maxX)/2:b.minX+(i+.5)*cellW,0,alongZ?b.minZ+(i+.5)*cellD:(b.minZ+b.maxZ)/2).applyMatrix4(transform);
        const c=Math.abs(Math.cos(CORRIDOR_ANGLE)),s=Math.abs(Math.sin(CORRIDOR_ANGLE));
        col.addCenterBox(p.x,p.z,c*sw+s*sd,s*sw+c*sd,b.y0*corridorScale.y,b.y1*corridorScale.y,'wall');
      }
    }
    o.applyMatrix4(transform);
  }
  const stats=batchStatic(root,new Set([ceiling,corridorCeiling]),14);
  const corridorInverse=transform.clone().invert(),zonePoint=new T.Vector3();
  const avatar=models.survivor.clone(true);avatar.name='reference-player';
  const find=name=>avatar.getObjectByName(name);
  avatar.userData={body:find('body'),head:find('head'),armL:find('armL'),armR:find('armR'),legL:find('legL'),legR:find('legR'),shinL:find('shinL'),shinR:find('shinR')};
  return {
    root,colliders:col,bounds:{minX:.38,maxX:28,minZ:-18,maxZ:26},spawn:{x:COMPOSITION.actor.x,z:COMPOSITION.actor.z},avatar,corridorTransform:transform,
    ctx:{M,updaters:[]},arch:{ceilings:[ceiling,corridorCeiling],roofs:[]},pool:{sources:[]},stats,
    setOverview(on){ceiling.visible=corridorCeiling.visible=!on;},
    update(dt,t,hero){zonePoint.set(hero.x,0,hero.z).applyMatrix4(corridorInverse);hero.zone=zonePoint.x>10&&zonePoint.x<14.4&&zonePoint.z<13.5?'corridor':'hall';dust.rotation.y=Math.sin(t*.018)*.003;},
  };
}

export function configureReferenceView(hero,game,world,camera){
  hero.flashPower=18;
  document.title='루다피아 · 원본 재현';document.body.classList.add('reference-view');game.ui.startButton(false);
  const style=document.createElement('style');style.textContent=`.reference-view #help,.reference-view #minimap,.reference-view #mapBtns,.reference-view #chatBar,.reference-view #gStart{display:none!important}.reference-view #click{display:none!important}.reference-view #status{font-size:10px;opacity:.55;background:transparent}.reference-view #view{object-fit:contain}#referenceUI{position:fixed;left:18px;top:16px;z-index:20;font:11px/1.7 'Malgun Gothic',sans-serif;color:#d0d4d1;text-shadow:0 1px 4px black}#referenceUI button{font:inherit;color:inherit;background:#10181bbd;border:1px solid #bac6c333;padding:5px 10px;margin:5px 5px 0 0;cursor:pointer}#referenceUI details{background:#080e12ad;padding:8px 12px;border:1px solid #ffffff18}#referenceUI summary{cursor:pointer;letter-spacing:.08em}#referenceOverlay{position:fixed;inset:0;z-index:19;width:100%;height:100%;object-fit:contain;background:#05090d;display:none}`;document.head.appendChild(style);
  const overlay=document.createElement('img');overlay.id='referenceOverlay';overlay.src='/assets/reconstruction/reference.png';overlay.alt='비교용 원본 이미지';document.body.appendChild(overlay);
  const panel=document.createElement('section');panel.id='referenceUI';panel.innerHTML='<details open><summary>루다피아 · 원본 재현</summary><div>개별 3D 모델 10종 · 실시간 공간</div><button data-action="camera">원본 구도</button><button data-action="walk">걸어보기</button><button data-action="corridor">복도</button><button data-action="reference">원본 사진 비교</button><div>WASD 이동 · Q/E 시점 · F 손전등 · R 원본 구도</div></details>';document.body.appendChild(panel);
  let fixed=true;
  const reset=()=>{fixed=true;hero.x=world.spawn.x;hero.z=world.spawn.z;hero.heading=COMPOSITION.actor.heading;hero.yaw=-.14;hero.pitch=.04;hero.camInit=false;overlay.style.display='none';};
  panel.querySelector('[data-action="camera"]').onclick=reset;
  panel.querySelector('[data-action="walk"]').onclick=()=>{fixed=false;overlay.style.display='none';};
  panel.querySelector('[data-action="corridor"]').onclick=()=>{fixed=false;const p=new T.Vector3(12.2,0,11.4).applyMatrix4(world.corridorTransform);hero.x=p.x;hero.z=p.z;hero.yaw=CORRIDOR_ANGLE;hero.heading=Math.PI+CORRIDOR_ANGLE;hero.camInit=false;overlay.style.display='none';};
  panel.querySelector('[data-action="reference"]').onclick=()=>{const on=overlay.style.display!=='block';overlay.style.display=on?'block':'none';panel.querySelector('[data-action="reference"]').textContent=on?'3D 화면으로 복귀':'원본 사진 비교';};
  window.addEventListener('keydown',e=>{if(e.code==='KeyR')reset();else if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){fixed=false;overlay.style.display='none';}});
  reset();
  return {updateCamera(){if(!fixed)return false;camera.fov=REFERENCE_CAMERA.fov;camera.updateProjectionMatrix();camera.position.set(...REFERENCE_CAMERA.position);camera.lookAt(...REFERENCE_CAMERA.target);return true;},pose(){const u=hero.model.userData;if(!fixed){u.head.rotation.x=0;u.armR.rotation.z=0;return;}u.body.rotation.x=.45;u.body.position.y=.77;u.head.rotation.x=.25;u.armR.rotation.x=-1.1;u.armR.rotation.z=-.15;u.armL.rotation.x=-.5;}};
}
