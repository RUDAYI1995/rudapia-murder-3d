// 원본에서 수동으로 읽은 창문 기준점을 이용해 카메라를 맞춘다. 픽셀 품질 전체를 평가하는 도구는 아니다.
import * as T from 'three';

const width=1344,height=768;
const observations=[
  [10.5,'top',[399,45]],[10.5,'base',[399,306]],
  [6.5,'top',[517,84]],[6.5,'base',[517,301]],
  [2.5,'top',[592,128]],[2.5,'base',[592,298]],
  [11.325,'base',[365,310]],[9.675,'base',[431,305]],
];
function camera(p){const [x,z,yaw,pitch,fov]=p;const c=new T.PerspectiveCamera(fov,width/height,.08,400);c.position.set(x,1.8,z);c.rotation.set(pitch,yaw,0,'YXZ');c.updateMatrixWorld();return c;}
function points(p){const c=camera(p);return observations.map(([z,level,target])=>{const v=new T.Vector3(.07,level==='top'?1.2+p[5]:1.2,z).project(c);return {target,actual:[(v.x+1)*width/2,(1-v.y)*height/2]};});}
function cost(p){if(p[0]<2||p[0]>15||p[1]<17||p[1]>34||p[2]<-.1||p[2]>.8||p[3]<-.4||p[3]>.05||p[4]<35||p[4]>85||p[5]<2.8||p[5]>5)return 1e10;return points(p).reduce((sum,q)=>sum+(q.target[0]-q.actual[0])**2+(q.target[1]-q.actual[1])**2,0);}
function fit(){let simplex=[[9.7,22,.3,-.15,60,4]];const steps=[.8,2,.05,.03,4,.3];for(let i=0;i<6;i++){const p=[...simplex[0]];p[i]+=steps[i];simplex.push(p);}for(let it=0;it<1800;it++){
  simplex.sort((a,b)=>cost(a)-cost(b));const center=Array(6).fill(0);for(const p of simplex.slice(0,-1))p.forEach((v,i)=>center[i]+=v/6);
  const worst=simplex[6],reflect=center.map((v,i)=>2*v-worst[i]);
  if(cost(reflect)<cost(simplex[0])){const expand=center.map((v,i)=>v+2*(reflect[i]-v));simplex[6]=cost(expand)<cost(reflect)?expand:reflect;}
  else if(cost(reflect)<cost(simplex[5]))simplex[6]=reflect;
  else{const contract=center.map((v,i)=>v+.5*(worst[i]-v));if(cost(contract)<cost(worst))simplex[6]=contract;else simplex=simplex.map((p,k)=>k?p.map((v,i)=>(v+simplex[0][i])/2):p);}
}return simplex.sort((a,b)=>cost(a)-cost(b))[0];}
const p=fit(),c=camera(p),direction=new T.Vector3();c.getWorldDirection(direction);
const project=v=>{v=v.clone().project(c);return [(v.x+1)*width/2,(1-v.y)*height/2];};
function minimize(start,step,fn){let simplex=[start];for(let i=0;i<start.length;i++){const q=[...start];q[i]+=step[i];simplex.push(q);}const n=start.length;for(let k=0;k<1600;k++){
  simplex.sort((a,b)=>fn(a)-fn(b));const mean=Array(n).fill(0);for(const q of simplex.slice(0,n))q.forEach((v,i)=>mean[i]+=v/n);const worst=simplex[n],r=mean.map((v,i)=>2*v-worst[i]);
  if(fn(r)<fn(simplex[0])){const e=mean.map((v,i)=>v+2*(r[i]-v));simplex[n]=fn(e)<fn(r)?e:r;}else if(fn(r)<fn(simplex[n-1]))simplex[n]=r;else{const v=mean.map((v,i)=>v+.5*(worst[i]-v));if(fn(v)<fn(worst))simplex[n]=v;else simplex=simplex.map((q,j)=>j?q.map((v,i)=>(v+simplex[0][i])/2):q);}
}return simplex.sort((a,b)=>fn(a)-fn(b))[0];}
const tableBounds=q=>{const [x,z,s,depth]=q,pts=Array.from({length:160},(_,i)=>project(new T.Vector3(x+Math.cos(i/160*Math.PI*2)*1.92*s,.855*s,z+Math.sin(i/160*Math.PI*2)*1.92*s*depth)));return [Math.min(...pts.map(v=>v[0])),Math.max(...pts.map(v=>v[0])),Math.min(...pts.map(v=>v[1])),Math.max(...pts.map(v=>v[1]))];};
const tableTarget=[449,770,327,377];const table3=minimize([4.4,14.2,.9],[.4,.5,.1],q=>q[2]<.4||q[2]>1.6?1e9:tableBounds([...q,1]).reduce((s,v,i)=>s+(v-tableTarget[i])**2,0));const table=[...table3,1];
const cabinetLocal=[[-1.125,1.1,.42],[1.125,1.1,.42],[-1.125,.13,.42],[1.125,.13,.42]];
const cabinetTarget=[[711,456],[968,421],[711,634],[970,559]];
function cabinetPoints(q){const [x,z,yaw,rx,s,sy]=q,m=new T.Matrix4().compose(new T.Vector3(x,.02,z),new T.Quaternion().setFromEuler(new T.Euler(rx,yaw,0,'YXZ')),new T.Vector3(s,sy,s));return cabinetLocal.map(v=>project(new T.Vector3(...v).applyMatrix4(m)));}
const cabinetCost=q=>{if(q[4]<.5||q[4]>1.6||q[5]<.5||q[5]>1.8||q[2]<0||q[2]>1.3||Math.abs(q[3])>.6)return 1e9;return cabinetPoints(q).reduce((s,v,i)=>s+(v[0]-cabinetTarget[i][0])**2+(v[1]-cabinetTarget[i][1])**2,0);};
const cabinet=minimize([7.1,18.3,.65,0,1,1],[.3,.3,.1,.05,.1,.1],cabinetCost);
console.log(JSON.stringify({camera:{position:c.position.toArray(),target:c.position.clone().addScaledVector(direction,14).toArray(),fov:p[4]},windowBase:1.2,windowHeight:p[5],selectedAnchorRmse:Math.sqrt(cost(p)/observations.length),anchors:points(p),table:{position:[table[0],.01,table[1]],scale:table[2],depth:table[3],targetBounds:tableTarget,actualBounds:tableBounds(table)},cabinet:{parameters:cabinet,target: cabinetTarget,actual:cabinetPoints(cabinet)}},null,2));
