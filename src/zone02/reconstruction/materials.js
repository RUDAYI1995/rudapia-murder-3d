// 생성 서비스 없이 직접 작성한 색·요철·거칠기 재질. 조명은 재질에 굽지 않고 런타임에서 계산한다.
import * as T from 'three';
import { mulberry32 } from '../noise.js';

const SIZE=1024;
function canvas(){const c=document.createElement('canvas');c.width=c.height=SIZE;return c;}
function texture(c,srgb=true){const t=new T.CanvasTexture(c);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;}
function noiseField(seed){const rnd=mulberry32(seed),n=64,values=Float32Array.from({length:n*n},rnd);return(x,y,scale=1)=>{x=x*scale% n;y=y*scale%n;const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const at=(a,b)=>values[((b+n)%n)*n+(a+n)%n];return T.MathUtils.lerp(T.MathUtils.lerp(at(ix,iy),at(ix+1,iy),fx),T.MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),fx),fy);};}
function surface(kind){
  const color=canvas(),height=canvas(),rough=canvas(),ctx=color.getContext('2d'),hc=height.getContext('2d'),rc=rough.getContext('2d');
  const data=ctx.createImageData(SIZE,SIZE),hd=hc.createImageData(SIZE,SIZE),rd=rc.createImageData(SIZE,SIZE),noise=noiseField(kind==='wood'?18:27);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const i=(y*SIZE+x)*4,u=x/SIZE,v=y/SIZE;
    const broad=noise(u*64,v*64,0.25),detail=noise(u*64,v*64,2),fine=noise(u*64,v*64,8);
    let rgb,h=128,r=190;
    if(kind==='stone'){
      const tx=Math.floor(u*4),ty=Math.floor(v*4),dark=(tx+ty)%2===0;
      const edge=Math.min(u*4%1,1-u*4%1,v*4%1,1-v*4%1),grout=edge<0.012;
      const vein=Math.pow(Math.max(0,Math.sin(u*41+v*32+broad*18)),14)*20;
      const c=(dark?49:92)+(broad-0.5)*35+(detail-0.5)*17+vein;
      rgb=grout?[35,34,30]:[c,c*0.985,c*0.92];h=grout?100:148+fine*5;r=grout?230:85+broad*60;
    }else if(kind==='paper'){
      const sx=(u*8%1-.5)*2,sy=(v*8%1-.5)*2;
      const leaf=Math.exp(-Math.abs(sx)*6)*Math.pow(Math.cos(sy*5+Math.sin(sx*8)),8);
      const flower=Math.pow(Math.max(0,Math.cos(Math.atan2(sy,sx)*6)),4)*Math.exp(-Math.pow(Math.hypot(sx,sy)-.42,2)*70);
      const peeled=broad>0.58||noise(u*64,v*64,0.5)<0.23;
      const c=peeled?86+detail*18:75+detail*16-(leaf+flower)*15;
      rgb=peeled?[c,c*.96,c*.86]:[c*.91,c,c*.96];h=peeled?100+fine*22:149+flower*12;r=220+detail*25;
    }else if(kind==='wood'){
      const grain=Math.sin(u*170+Math.sin(v*7)*3+broad*14)*.5+.5;
      const c=30+grain*15+detail*9;rgb=[c*1.28,c*.9,c*.64];h=122+grain*15+fine*3;r=145+detail*58;
    }else{
      const weave=((x%4<2?1:0)+(y%4<2?1:0))*3;
      const c=38+detail*10+weave;rgb=[c*.83,c,c*.95];h=120+weave;r=225;
    }
    data.data.set([...rgb.map(n=>Math.max(0,Math.min(255,n))),255],i);hd.data.set([h,h,h,255],i);rd.data.set([r,r,r,255],i);
  }
  ctx.putImageData(data,0,0);hc.putImageData(hd,0,0);rc.putImageData(rd,0,0);
  const normal=canvas(),nc=normal.getContext('2d'),nd=nc.createImageData(SIZE,SIZE),at=(x,y)=>hd.data[(((y+SIZE)%SIZE)*SIZE+(x+SIZE)%SIZE)*4]/255;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const i=(y*SIZE+x)*4,dx=(at(x+1,y)-at(x-1,y))*2.5,dy=(at(x,y+1)-at(x,y-1))*2.5,n=new T.Vector3(-dx,dy,1).normalize();nd.data.set([(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255],i);}
  nc.putImageData(nd,0,0);
  return {map:texture(color),normalMap:texture(normal,false),roughnessMap:texture(rough,false)};
}
function rugMap(){
  const c=canvas(),ctx=c.getContext('2d');ctx.fillStyle='#332c2a';ctx.fillRect(0,0,SIZE,SIZE);
  const rnd=mulberry32(39);
  for(let i=0;i<8;i++){ctx.strokeStyle=i%2?'#786a54':'#282e2d';ctx.lineWidth=i%2?3:11;ctx.strokeRect(18+i*12,18+i*12,SIZE-36-i*24,SIZE-36-i*24);}
  for(let y=125;y<900;y+=48)for(let x=125;x<900;x+=48){ctx.strokeStyle=rnd()>.5?'#6a5b47':'#463e34';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-18);ctx.bezierCurveTo(x+27,y,x+12,y+12,x,y+18);ctx.bezierCurveTo(x-27,y,x-12,y-12,x,y-18);ctx.stroke();}
  for(let i=0;i<22000;i++){const k=rnd();ctx.fillStyle=`rgba(${k>.5?'190,180,155':'10,10,9'},${rnd()*.11})`;ctx.fillRect(rnd()*SIZE,rnd()*SIZE,1+rnd()*7,1);}
  return texture(c);
}
export async function createReferenceMaterials(onProgress){
  onProgress('원본 재현용 표면과 요철 제작 중…');
  const stone=surface('stone'),paper=surface('paper'),wood=surface('wood'),cloth=surface('cloth');
  const std=(name,params)=>new T.MeshStandardMaterial({name,...params});
  const M={
    stone: new T.MeshPhysicalMaterial({name:'stone',...stone,roughness:.67,metalness:.03,clearcoat:.16,clearcoatRoughness:.42,normalScale:new T.Vector2(.5,.5)}),
    paper:std('paper',{...paper,roughness:1,normalScale:new T.Vector2(.18,.18)}),
    wood:std('wood',{...wood,roughness:.9}),trim:std('trim',{...wood,color:0x79766b,roughness:.88}),
    plaster:std('plaster',{...paper,color:0x676961,roughness:1}),brass:std('brass',{color:0x716044,metalness:.75,roughness:.5}),
    metal:std('metal',{color:0x272b2b,metalness:.7,roughness:.63}),wax:std('wax',{color:0xb2a68d,roughness:.94}),
    glow:std('glow',{color:0xffdca0,emissive:0xffb35d,emissiveIntensity:2}),
    fabric:std('fabric',{...cloth,color:0x7b7161}),jacket:std('jacket',{...cloth,color:0x636d69}),pants:std('pants',{...cloth,color:0x575e56}),
    skin:std('skin',{color:0x77695b,roughness:.86}),hair:std('hair',{color:0x171b19,roughness:.6}),rubber:std('rubber',{color:0x151817,roughness:.95}),
    glass:new T.MeshPhysicalMaterial({name:'glass',color:0x9cb5c3,transparent:true,opacity:.12,roughness:.35,metalness:.1,depthWrite:false,normalMap:cloth.normalMap,normalScale:new T.Vector2(.035,.035),emissive:0x668699,emissiveIntensity:.17}),
    rug:std('rug',{map:rugMap(),roughness:1}),screen:std('screen',{color:0x668898,emissive:0x345563,emissiveIntensity:.8,roughness:.5}),
  };
  return M;
}
