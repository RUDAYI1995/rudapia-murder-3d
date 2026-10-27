// 원본 장면의 개별 조형 원본. Node에서 GLB로 내보내며 런타임에서 같은 재질 이름을 사용한다.
import * as T from 'three';

const colors = { wood: 0x39291e, trim: 0x281e17, brass: 0x695037, wax: 0xb1a88f, glow: 0xfac58a, metal: 0x202427, fabric: 0x363332, glass: 0x7197aa, skin: 0x8a7361, hair: 0x171615, jacket: 0x252b29, pants: 0x202421, rubber: 0x151817, screen: 0x8aafbf };
const mats = Object.fromEntries(Object.entries(colors).map(([name, color]) => [name, new T.MeshStandardMaterial({ name, color, roughness: name === 'brass' ? 0.4 : 0.8, metalness: ['brass', 'metal'].includes(name) ? 0.7 : 0 })]));
function mesh(parent, geo, material, x=0,y=0,z=0) {
  const m = new T.Mesh(geo, mats[material]); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; parent.add(m); return m;
}
function box(p,w,h,d,mat,x=0,y=0,z=0,bevel=0.008) {
  const s=new T.Shape(); s.moveTo(-w/2,-h/2); s.lineTo(w/2,-h/2); s.lineTo(w/2,h/2); s.lineTo(-w/2,h/2); s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:Math.max(0.001,d-2*bevel),bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,curveSegments:4});
  g.translate(0,0,-(d-2*bevel)/2); return mesh(p,g,mat,x,y,z);
}
function cylinder(p,rt,rb,h,mat,x=0,y=0,z=0,n=24) {return mesh(p,new T.CylinderGeometry(rt,rb,h,n),mat,x,y,z);}
function lathe(p,pts,mat,x=0,y=0,z=0) {return mesh(p,new T.LatheGeometry(pts.map(v=>new T.Vector2(...v)),32),mat,x,y,z);}
function tube(p,points,r,mat,segments=40) {return mesh(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),segments,r,8,false),mat);}
function sphere(p,r,mat,x,y,z,scale=[1,1,1]) {const m=mesh(p,new T.SphereGeometry(r,24,18),mat,x,y,z);m.scale.set(...scale);return m;}
function group(name){const g=new T.Group();g.name=name;return g;}

export function roundTable(){
  const g=group('round-table');
  lathe(g,[[0,0],[0.75,0],[0.8,0.055],[0.62,0.12],[0.35,0.19],[0.19,0.35],[0.23,0.58],[0.55,0.68],[1.85,0.69],[1.92,0.73],[1.92,0.8],[1.86,0.84],[0,0.84]],'wood');
  cylinder(g,1.85,1.85,.012,'wood',0,.849,0,128);
  for(let i=0;i<4;i++){const leg=group('carved-foot');g.add(leg);leg.rotation.y=i*Math.PI/2;tube(leg,[[0,0.35,0],[0.45,0.18,0],[0.8,0.07,0],[1.1,0.08,0]],0.065,'wood');}
  for(const r of [1.78,1.84,1.9]) {const ring=mesh(g,new T.TorusGeometry(r,0.009,6,160),'brass',0,0.815,0);ring.rotation.x=Math.PI/2;}
  // 분리된 판재 이음과 테두리 리벳은 위에서 보이는 원탁의 크기 기준을 제공한다.
  for(let x=-1.6;x<1.8;x+=0.26){const len=Math.sqrt(Math.max(0,1.78**2-x*x))*2;box(g,0.005,0.001,len,'trim',x,0.857,0,0);}
  cylinder(g,.46,.46,.016,'metal',.12,.87,-.1,64);
  const tray=mesh(g,new T.TorusGeometry(.46,.017,8,64),'brass',.12,.884,-.1);tray.rotation.x=Math.PI/2;
  for(const [x,z]of [[-.7,.3],[.6,.65],[1.15,-.4]]){
    cylinder(g,.11,.095,.012,'wax',x,.87,z,32);
    cylinder(g,.023,.029,.06,'brass',x+.07,.9,z+.04,12);
  }
  for(const [x,z,a]of [[-.35,-.62,.4],[.85,.14,-.6],[-1,.5,.1]]){const sheet=box(g,.2,.002,.27,'wax',x,.861,z,0);sheet.rotation.y=a;}
  lathe(g,[[.045,0],[.055,.02],[.047,.1],[.018,.15],[.018,.23],[.024,.24]],'glass',-.18,.89,-.2);
  lathe(g,[[.075,0],[.08,.02],[.025,.05],[.018,.16],[.065,.18],[.08,.2]],'brass',.37,.89,-.18);
  cylinder(g,.022,.024,.2,'wax',.37,1.19,-.18,12);
  return g;
}
export function chair(){
  const g=group('spindle-chair');
  box(g,0.47,0.055,0.46,'wood',0,0.47,0);
  box(g,0.4,0.035,0.36,'fabric',0,0.51,0.015,0.018);
  for(const x of [-0.19,0.19])for(const z of [-0.18,0.18]) {
    lathe(g,[[0.02,0],[0.028,0.03],[0.018,0.13],[0.03,0.2],[0.019,0.3],[0.026,0.45]],'wood',x,0,z);
  }
  for(const x of [-0.2,0.2])tube(g,[[x,0.42,-0.18],[x,0.76,-0.23],[x*1.1,1.05,-0.27]],0.023,'wood');
  const rail=box(g,0.48,0.09,0.05,'wood',0,1.03,-0.27,0.012);rail.rotation.x=0.1;
  for(const x of [-0.13,-0.065,0,0.065,0.13])tube(g,[[x,0.54,-0.2],[x,0.78,-0.245],[x,0.99,-0.27]],0.011,'wood',16);
  for(const x of [-0.18,0.18])box(g,0.02,0.02,0.36,'wood',x,0.18,0);
  box(g,0.36,0.02,0.025,'wood',0,0.2,-0.16);
  return g;
}
export function chandelier(){
  const g=group('aged-chandelier');
  lathe(g,[[0.06,0],[0.21,0.05],[0.25,0.12],[0.12,0.25],[0.12,0.45],[0.22,0.55],[0.11,0.66],[0.08,1.05]],'brass');
  for(let i=0;i<16;i++) {const link=mesh(g,new T.TorusGeometry(0.036,0.009,6,12),'metal',0,1.08+i*0.058,0);link.rotation.y=i%2*Math.PI/2;}
  for(let i=0;i<10;i++){
    const a=i*Math.PI*2/10,arm=group('curved-candle-arm');g.add(arm);arm.rotation.y=a;
    const end=0.78+(i%2)*0.2, y=0.28+(i%2)*0.21;
    tube(arm,[[0.12,0.35,0],[0.42,0.11,0],[end,0.12,0],[end+0.1,y,0],[end,y+0.1,0]],0.018,'brass');
    lathe(arm,[[0.015,0],[0.07,0.02],[0.08,0.04],[0.04,0.065]],'brass',end,y+0.07,0);
    cylinder(arm,0.024,0.027,0.23,'wax',end,y+0.23,0,12);
    sphere(arm,0.022,'glow',end,y+0.365,0,[0.6,1.6,0.6]);
    sphere(arm,0.017,'brass',end,y-0.05,0,[0.7,2.5,0.7]);
    tube(arm,[[0.13,0.61,0],[0.42,0.64,0],[0.48,0.39,0],[0.3,0.36,0]],0.009,'brass',24);
  }
  sphere(g,0.07,'brass',0,-0.09,0,[0.65,1.8,0.65]);return g;
}
export function cabinet(){
  const g=group('paneled-sideboard');
  box(g,2.25,0.93,0.66,'wood',0,0.59,0,0.015);
  box(g,2.4,0.075,0.76,'wood',0,1.095,0,0.012);
  box(g,2.34,0.065,0.7,'trim',0,0.13,0);
  for(const x of [-0.7,0,0.7]){
    box(g,0.63,0.69,0.035,'trim',x,0.6,0.35);
    box(g,0.54,0.6,0.025,'wood',x,0.6,0.377);
    box(g,0.41,0.45,0.018,'trim',x,0.6,0.397);
    box(g,0.36,0.39,0.02,'wood',x,0.6,0.41);
    const handle=mesh(g,new T.TorusGeometry(0.028,0.007,6,14),'brass',x+0.21,0.72,0.425);
    handle.rotation.x=0.2;
    for(const y of [0.35,0.85])box(g,0.03,0.06,0.02,'metal',x-0.29,y,0.4);
  }
  for(const x of [-0.95,0.95])for(const z of [-0.23,0.23])lathe(g,[[0.06,0],[0.07,0.035],[0.045,0.09],[0.05,0.16]],'wood',x,0,z);
  return g;
}
export function windowModel(){
  const g=group('arched-window'); const w=1.65, y0=0, archBase=3.1, top=3.925;
  for(const x of [-w/2,w/2])box(g,0.12,archBase,0.18,'trim',x,archBase/2,0);
  const arc=Array.from({length:41},(_,i)=>{const a=Math.PI-i/40*Math.PI;return [Math.cos(a)*w/2,archBase+Math.sin(a)*w/2,0];});
  tube(g,arc,0.07,'trim');
  box(g,w+0.25,0.12,0.32,'wood',0,0,0.03);
  box(g,w,0.09,0.15,'trim',0,3.08,0);
  box(g,0.048,3.85,0.11,'trim',0,1.92,0);
  for(const y of [0.65,1.3,1.95,2.6])box(g,w,0.042,0.1,'trim',0,y,0);
  for(const x of [-0.4,0.4])box(g,0.035,3.08,0.1,'trim',x,1.54,0);
  for(const sign of [-1,1])tube(g,[[0,3.1,0],[sign*0.28,3.55,0],[sign*0.52,3.72,0]],0.025,'trim');
  const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,archBase);shape.absarc(0,archBase,w/2,0,Math.PI,false);shape.closePath();
  const glass=mesh(g,new T.ShapeGeometry(shape,40),'glass',0,0,-0.045);glass.name='window-glass';
  return g;
}
export function doorFrame(){
  const g=group('molded-door-frame');
  for(const x of [-0.6,0.6])for(const [w,z]of [[0.15,0],[0.04,0.1],[0.026,0.14]])box(g,w,2.9,0.1,'wood',x,1.45,z);
  for(const [h,y,z]of [[0.18,2.95,0],[0.04,2.85,0.11],[0.06,3.07,0.06]])box(g,1.39,h,0.16,'wood',0,y,z);
  return g;
}
export function wallLamp(){
  const g=group('wall-lantern');
  box(g,0.1,0.3,0.04,'brass',0,0,-0.07);
  tube(g,[[0,-0.06,0],[0,-0.09,0.14],[0,0.03,0.2]],0.018,'brass',16);
  for(const y of [0.04,0.25])box(g,0.18,0.025,0.16,'metal',0,y,0.2);
  for(const x of [-0.08,0.08])for(const z of [0.13,0.27])box(g,0.012,0.2,0.012,'metal',x,0.145,z);
  box(g,0.12,0.17,0.1,'glow',0,0.145,0.2);
  const cap=mesh(g,new T.ConeGeometry(0.14,0.11,4),'metal',0,0.31,0.2);cap.rotation.y=Math.PI/4;
  return g;
}
export function workLight(){
  const g=group('tripod-work-light');
  cylinder(g,0.012,0.018,1.18,'brass',0,0.61,0,12);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;tube(g,[[0,0.5,0],[Math.cos(a)*0.29,0.015,Math.sin(a)*0.29]],0.013,'brass',2);}
  box(g,0.3,0.23,0.12,'metal',0,1.24,0);box(g,0.25,0.17,0.015,'glow',0,1.24,0.069);
  for(const x of [-0.12,0.12])box(g,0.02,0.28,0.02,'brass',x,1.24,0.01);
  return g;
}
export function monitor(){
  const g=group('security-monitor');
  box(g,0.82,0.51,0.18,'metal',0,0.4,0);box(g,0.73,0.42,0.014,'screen',0,0.41,0.1);
  box(g,0.06,0.18,0.06,'metal',0,0.1,0);box(g,0.4,0.025,0.22,'metal',0,0.025,0);
  for(const x of [0.28,0.32])sphere(g,0.008,'glow',x,0.17,0.105);
  return g;
}

// 의상은 단순 캡슐 대신 둘레 단면을 이어 만든 메시와 봉제선·옷깃·머리카락으로 조형한다.
function garment(p,rings,mat,x=0,y=0,z=0){
  const verts=[],uv=[],indices=[],n=40;
  for(let j=0;j<rings.length;j++){const [h,rx,rz]=rings[j];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,fold=1+0.025*Math.sin(a*9+j*1.5)+0.015*Math.sin(a*17-j);verts.push(Math.cos(a)*rx*fold,h,Math.sin(a)*rz*fold);uv.push(i/n,j/(rings.length-1));}}
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return mesh(p,geo,mat,x,y,z);
}
export function survivor(){
  const g=group('survivor');const body=group('body');body.position.y=0.92;g.add(body);
  garment(body,[[-0.05,0.19,0.13],[0.03,0.2,0.145],[0.17,0.19,0.13],[0.35,0.22,0.15],[0.51,0.25,0.13],[0.59,0.16,0.11]],'jacket');
  for(const x of [-0.095,0.095]){
    const thigh=group(x<0?'legL':'legR');thigh.position.x=x;body.add(thigh);
    garment(thigh,[[0,0.09,0.11],[-0.1,0.085,0.095],[-0.25,0.072,0.08],[-0.43,0.065,0.075]],'pants');
    const shin=group(x<0?'shinL':'shinR');shin.position.y=-0.43;thigh.add(shin);
    garment(shin,[[0,0.064,0.075],[-0.2,0.055,0.064],[-0.38,0.052,0.06]],'pants');
    box(shin,0.125,0.1,0.25,'rubber',0,-0.4,0.05,0.035);
  }
  const head=group('head');head.position.set(0,0.75,0);body.add(head);
  cylinder(head,0.054,0.058,0.13,'skin',0,-0.14,0);
  sphere(head,0.123,'skin',0,0.005,0,[0.82,1.2,0.92]);
  sphere(head,0.125,'hair',0,0.05,-0.025,[0.86,1.08,1]);
  sphere(head,0.065,'hair',0,-0.06,-0.12,[0.85,0.8,1]);
  tube(head,[[0,-0.04,-0.14],[0.025,-0.15,-0.18],[0.02,-0.28,-0.14],[-0.015,-0.33,-0.12]],0.045,'hair');
  const rand=i=>Math.sin(i*37.17)*0.5;
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2;tube(head,[[Math.cos(a)*0.11,0.12,-0.015+Math.sin(a)*0.1],[Math.cos(a)*0.12,0.015,-0.03+Math.sin(a)*0.11],[rand(i)*0.06,-0.08,-0.13]],0.002,'hair',14);}
  for(const x of [-0.23,0.23]){
    const arm=group(x<0?'armL':'armR');arm.position.set(x,0.51,0);body.add(arm);
    garment(arm,[[0,0.075,0.09],[-0.18,0.067,0.072],[-0.32,0.055,0.06]],'jacket');
    garment(arm,[[-0.31,0.055,0.06],[-0.48,0.047,0.052],[-0.59,0.04,0.045]],'jacket',0,0,0.02);
    sphere(arm,0.05,'skin',0,-0.62,0.025,[0.8,1.25,0.65]);
    if(x>0){const flash=cylinder(arm,0.035,0.024,0.19,'metal',0,-0.63,0.12,24);flash.rotation.x=Math.PI/2;const lens=cylinder(arm,0.026,0.026,0.01,'glass',0,-0.63,0.22,24);lens.rotation.x=Math.PI/2;}
  }
  for(const x of [-0.105,0.105])tube(body,[[x,0.58,-0.11],[x*1.8,0.36,-0.16],[x*1.4,0.03,-0.13]],0.025,'trim',20);
  garment(body,[[.01,.1,.02],[.07,.145,.06],[.18,.16,.075],[.35,.15,.07],[.46,.12,.04],[.49,.08,.015]],'jacket',0,0,-.16);
  for(const x of [-.11,.11])tube(body,[[x,.04,-.2],[x*1.25,.17,-.23],[x*1.15,.36,-.22],[x*.8,.46,-.19]],.003,'fabric',20);
  tube(body,[[-.14,.58,.05],[-.09,.62,-.03],[0,.62,-.09],[.09,.62,-.03],[.14,.58,.05]],.025,'jacket',28);
  for(const x of [-0.085,0.085])tube(body,[[x,-0.01,0.132],[x,0.26,0.145],[x,0.47,0.13]],0.002,'fabric',15);
  return g;
}

export const modelLibrary = { 'round-table':roundTable, 'spindle-chair':chair, 'aged-chandelier':chandelier, 'paneled-sideboard':cabinet, 'arched-window':windowModel, 'molded-door-frame':doorFrame, 'wall-lantern':wallLamp, 'tripod-work-light':workLight, 'security-monitor':monitor, survivor };
