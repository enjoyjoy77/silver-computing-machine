import * as T from './lib/three.module.min.js';
import {stickY,nextDepth,touchIntent} from './xr-policy.js';

// Shared state machine: controllers, hand target rays and deliberate near contact.
export function createXRInput({renderer,camera=()=>renderer.xr.getCamera(),rig,scene,targets,toys,choose,selected,panel,activate,status}){
 const ray=new T.Raycaster(),mat=new T.Matrix4(),bounds=new T.Box3();let two=null,owner=null,arrival=null;
 const states=[0,1].map(i=>{
  const c=renderer.xr.getController(i);rig.add(c);
  const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-6)]),new T.LineBasicMaterial({color:0x267b66}));c.add(line);
  const s={c,line,source:null,obj:null,kind:null,offset:new T.Matrix4(),blocked:false,touch:new Map(),latched:false};
  c.addEventListener('connected',e=>{release(s);s.source=e.data;s.blocked=true;line.visible=true});
  c.addEventListener('disconnected',()=>{release(s);s.source=null;s.touch.clear()});
  c.addEventListener('selectstart',()=>start(s,'select'));
  c.addEventListener('selectend',()=>{s.blocked=false;if(s.kind==='select')release(s)});
  c.addEventListener('squeezestart',()=>{if(!s.source?.hand)start(s,'squeeze')});
  c.addEventListener('squeezeend',()=>{s.blocked=false;if(s.kind==='squeeze')release(s)});
  return s;
 });
 function offset(s){s.c.updateWorldMatrix(true,false);s.obj.updateWorldMatrix(true,false);s.offset.copy(s.c.matrixWorld).invert().multiply(s.obj.matrixWorld)}
 function release(s){const held=!!s.obj;s.obj=null;s.kind=null;s.latched=false;if(!held)return;two=null;for(const o of states)if(o.obj)offset(o)}
 function reset(){for(const s of states){release(s);s.blocked=true;s.touch.clear();s.latched=false;s.near=null;s.uiCaptured=false}owner=null;arrival=null}
 function pick(s){scene.updateMatrixWorld(true);ray.ray.origin.setFromMatrixPosition(s.c.matrixWorld);ray.ray.direction.set(0,0,-1).transformDirection(s.c.matrixWorld);const hits=ray.intersectObjects(targets.filter(o=>o.visible),true);for(const h of hits){let o=h.object;while(o&&!targets.includes(o))o=o.parent;if(o)return {...h,o}}return null}
 function start(s,kind,near=null){
  if(!s.source||!s.c.visible||s.blocked||s.obj||s.uiCaptured)return;
  near=near||(s.source.hand?s.near:null);
  const h=near?{o:near}:pick(s);if(!h)return;
  arrival=null;
  if(h.o.userData.action){if(kind==='select'){s.uiCaptured=true;h.o.userData.action(h)}return}
  if(h.o===panel&&kind==='select'&&h.uv&&activate(h.uv)){s.uiCaptured=true;return}
  const other=states.find(x=>x!==s);
  // Controller scale requires both grips. Hands use two deliberate pinches.
  if(other.obj===h.o&&(!s.source.hand&&(kind!=='squeeze'||other.kind!=='squeeze')))return;
  s.obj=h.o;s.kind=kind;if(h.o!==panel){choose(h.o);owner=s}offset(s);
  if(other.obj===s.obj){const a=other.c.getWorldPosition(new T.Vector3()),b=s.c.getWorldPosition(new T.Vector3()),v=b.clone().sub(a);if(v.length()<.06){release(s);return}two={obj:s.obj,a:other,b:s,vec:v,mid:a.add(b).multiplyScalar(.5),pos:s.obj.position.clone(),q:s.obj.quaternion.clone(),scale:s.obj.scale.x};}
 }
 function bring(){const obj=selected();if(!obj)return;reset();const c=camera(),p=c.getWorldPosition(new T.Vector3()),d=c.getWorldDirection(new T.Vector3());p.addScaledVector(d,.65);p.y-=.2;arrival={obj,from:obj.position.clone(),to:p,t:0};status('選択した模型を手元へ呼びます')}
 function nearToy(points){for(const o of toys()){if(!o.visible)continue;bounds.setFromObject(o);if(points.some(p=>bounds.distanceToPoint(p)<.018))return o}return null}
 function update(dt,frame){
  const ref=renderer.xr.getReferenceSpace();
  for(const s of states){
   if(!s.source)continue;
   const tracked=frame&&ref&&frame.getPose(s.source.targetRaySpace,ref);
   if(!tracked){release(s);s.blocked=true;s.touch.clear();s.near=null;s.uiCaptured=false;if(owner===s)owner=null;continue}
   s.c.updateWorldMatrix(true,false);const gp=s.source.gamepad;
   if(!s.source.hand&&!(gp?.buttons?.[0]?.pressed||gp?.buttons?.[1]?.pressed)){s.blocked=false;s.uiCaptured=false}
   if(s.source.hand){
    const names=['thumb-tip','index-finger-tip','middle-finger-tip','ring-finger-tip','pinky-finger-tip'];
    const pts=names.map(n=>{const j=s.source.hand.get(n),p=j&&frame.getJointPose(j,ref);return p?new T.Vector3(p.transform.position.x,p.transform.position.y,p.transform.position.z).applyMatrix4(rig.matrixWorld):null});
    if(!pts[0]||!pts[1]){release(s);s.blocked=true;s.near=null;s.touch.clear();continue}
    const pinched=pts[0].distanceTo(pts[1])<.022;
    s.near=nearToy(pts.filter(Boolean));
    if(!pinched){s.blocked=false;if(s.latched)release(s)}
    // All five fingertips can touch panel buttons; contact alone never grabs models.
    if(!s.obj&&!pinched){for(let i=0;i<pts.length;i++){if(!pts[i]){s.touch.delete(i);continue}const p=panel.worldToLocal(pts[i].clone()),inside=Math.abs(p.x)<.15&&Math.abs(p.y)<.24;
      const prev=s.touch.has(i)?s.touch.get(i):null;s.touch.set(i,p.z);
      if(inside&&touchIntent(prev,p.z)&&!s.touch.get('lock')){activate(new T.Vector2(p.x/.3+.5,p.y/.48+.5));s.touch.set('lock',true);s.uiCaptured=true}
     }if(pts.every(p=>!p||Math.abs(panel.worldToLocal(p.clone()).z)>.035)){s.touch.delete('lock');s.uiCaptured=false}}
    if(pinched&&!s.obj&&!s.blocked){const near=nearToy(pts.filter(Boolean));if(near){start(s,'select',near);s.latched=!!s.obj}}
   }
  }
  if(two){const a=two.a.c.getWorldPosition(new T.Vector3()),b=two.b.c.getWorldPosition(new T.Vector3()),v=b.clone().sub(a);if(v.length()>.04){const q=new T.Quaternion().setFromUnitVectors(two.vec.clone().normalize(),v.clone().normalize()),base=two.obj.userData.baseScale||1,ratio=T.MathUtils.clamp(v.length()/two.vec.length(),base*.2/two.scale,base*5/two.scale);two.obj.scale.setScalar(two.scale*ratio);two.obj.quaternion.copy(q).multiply(two.q);two.obj.position.copy(two.pos).sub(two.mid).multiplyScalar(ratio).applyQuaternion(q).add(a.add(b).multiplyScalar(.5));}}
  else for(const s of states)if(s.obj){mat.multiplyMatrices(s.c.matrixWorld,s.offset);mat.decompose(s.obj.position,s.obj.quaternion,s.obj.scale)}
  // One owner prevents two sticks fighting over the selected toy. No locomotion.
  if(!two&&owner?.source&&!owner.blocked&&selected()&&owner.obj===selected()){
   const y=stickY(owner.source.gamepad),obj=selected();if(y){const p=owner.c.getWorldPosition(new T.Vector3()),v=obj.position.clone().sub(p),d=v.length();if(d>.001){obj.position.copy(p).addScaledVector(v.normalize(),nextDepth(d,y,dt));if(owner.obj===obj)offset(owner)}}
  }
  if(arrival){arrival.t=Math.min(1,arrival.t+Math.min(dt,.05)/.45);const t=arrival.t;arrival.obj.position.lerpVectors(arrival.from,arrival.to,t*t*(3-2*t));if(t===1)arrival=null}
 }
 return {states,update,reset,bring,held:o=>states.some(s=>s.obj===o),start,release};
}
