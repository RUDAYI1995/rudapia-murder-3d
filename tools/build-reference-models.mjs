// 승인된 원본 재현용 모델만 개별 GLB로 내보낸다. 기존 게임 자산은 덮어쓰지 않는다.
import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { modelLibrary } from '../src/zone02/reconstruction/models.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob) {blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const dest=new URL('../public/assets/reconstruction/models/',import.meta.url);
await mkdir(dest,{recursive:true});
const exporter=new GLTFExporter(),inventory=[];
for(const [name,build] of Object.entries(modelLibrary)){
  const root=build();root.updateMatrixWorld(true);
  root.traverse(o=>{if(o.isMesh)o.geometry.normalizeNormals();});
  const glb=await exporter.parseAsync(root,{binary:true});
  await writeFile(new URL(`${name}.glb`,dest),Buffer.from(glb));
  let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  inventory.push({name,file:`${name}.glb`,bytes:glb.byteLength,triangles});
}
await writeFile(new URL('inventory.json',dest),JSON.stringify({description:'원본 중앙 홀 재현을 위해 직접 제작한 독립 3D 모델',models:inventory},null,2));
console.log(inventory.map(m=>`${m.name}: ${m.triangles} triangles, ${m.bytes} bytes`).join('\n'));
