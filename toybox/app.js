import * as T from './lib/three.module.min.js';
import {GLTFLoader} from './lib/GLTFLoader.js';
import {optimize} from './optimize.js';
import {setupHands} from './lib/hands.js';
const $=id=>document.getElementById(id),status=s=>$('status').textContent=s;
window.addEventListener('error',e=>status('エラー：'+e.message+'。ページを開き直してください。'));
window.addEventListener('unhandledrejection',e=>status('読み込み失敗：'+e.reason+'。起動し直してください。'));
const scene=new T.Scene();scene.background=new T.Color('#e7efe8');scene.fog=new T.Fog('#e7efe8',9,24);
const renderer=new T.WebGLRenderer({canvas:$('view'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.xr.enabled=true;renderer.outputColorSpace=T.SRGBColorSpace;
const camera=new T.PerspectiveCamera(48,1,.02,60),rig=new T.Group();scene.add(rig);rig.add(camera);
const focus=new T.Vector3(.3,.7,-.9);let azimuth=.35,elevation=1.15,distance=6.6;
function view(){if(renderer.xr.isPresenting)return;camera.position.setFromSphericalCoords(distance,elevation,azimuth).add(focus);camera.lookAt(focus)}
function resetView(){focus.set(.3,.7,-.9);azimuth=.35;elevation=1.15;distance=6.6;view()}
function zoomView(f){distance=T.MathUtils.clamp(distance*f,1,18);view()}
function panView(dx,dy){camera.updateMatrixWorld();const k=2*distance*Math.tan(T.MathUtils.degToRad(camera.fov/2))/innerHeight;focus.addScaledVector(new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),-dx*k).addScaledVector(new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1),dy*k);focus.clamp(new T.Vector3(-10,-2,-10),new T.Vector3(10,8,10));view()}view();
scene.add(new T.HemisphereLight(0xffffff,0x789782,2.4));const sun=new T.DirectionalLight(0xfff4dc,3);sun.position.set(3,6,4);scene.add(sun);
function mesh(w,h,d,c,x,y,z,parent=scene){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.8}));m.position.set(x,y,z);parent.add(m);return m}
mesh(40,.08,40,'#d3dfd0',0,-.05,0);const grid=new T.GridHelper(30,60,0xb4c9b3,0xc4d4c1);grid.position.y=.001;scene.add(grid);
const catalog=await fetch('./catalog.json?v=3').then(r=>{if(!r.ok)throw Error('目録がありません');return r.json()});
const colors=['#cc8d67','#8baec0','#b4b776','#b595b5'],cats=[...new Set(catalog.map(m=>m.category))],boxes=[],targets=[],loaded=new Map(),loading=new Set();let selected=null,activeCat=cats[0];
function label(text,w=1.05,h=.16){const c=document.createElement('canvas');c.width=840;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#fdfaf0';ctx.fillRect(0,0,840,128);ctx.fillStyle='#395147';ctx.textAlign='center';let font=46;ctx.font=`bold ${font}px sans-serif`;while(ctx.measureText(text).width>800){ctx.font=`bold ${--font}px sans-serif`}ctx.fillText(text,420,80);const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),side:T.DoubleSide}));return m}
cats.forEach((cat,i)=>{const g=new T.Group(),x=(i-1.5)*1.25,z=-1.45+Math.abs(i-1.5)*.28;g.position.set(x,0,z);scene.add(g);const col=colors[i];mesh(1.12,.09,.88,col,0,.55,0,g);mesh(1.12,.32,.05,col,0,.72,-.43,g);mesh(1.12,.23,.05,col,0,.67,.43,g);mesh(.05,.32,.88,col,-.54,.72,0,g);mesh(.05,.32,.88,col,.54,.72,0,g);for(const a of [-.43,.43])for(const b of [-.32,.32])mesh(.08,.52,.08,col,a,.26,b,g);const sign=label(cat);sign.position.set(0,.72,.462);g.add(sign);sign.userData.action=()=>{activeCat=cat;renderList();showNext(cat)};targets.push(sign);boxes.push(g);const next=label('次のおもちゃ →',.72,.12);next.position.set(0,.92,-.42);g.add(next);next.userData.action=()=>showNext(cat);targets.push(next)});
const instruction=label('つまむ・トリガーで掴む ／ 両手を広げて大きさ変更',3.3,.28);instruction.position.set(0,1.8,-2.1);scene.add(instruction);
// Flatten the current pose, then batch by material to keep draw calls bounded.

function choose(obj){selected=obj;$('selection').textContent=obj?obj.userData.entry.name:'おもちゃを選んでください';renderList()}
let loadQueue=Promise.resolve();
function take(entry){loadQueue=loadQueue.then(()=>takeNow(entry));return loadQueue}
function present(obj){for(const o of loaded.values())if(o!==obj&&o.userData.entry.category===obj.userData.entry.category&&o.position.distanceTo(o.userData.home)<.03&&!inputs.some(s=>s.obj===o))o.visible=false;obj.visible=true;choose(obj);status('取り出しました。ドラッグして遊べます。')}
function disposeToy(obj){scene.remove(obj);targets.splice(targets.indexOf(obj),1);loaded.delete(obj.userData.entry.id);if(selected===obj)choose(null);const materials=new Set(),textures=new Set();obj.traverse(o=>{if(o.isMesh){o.geometry.dispose();materials.add(o.material)}});for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose()}for(const t of textures){t.dispose();t.source?.data?.close?.()}}
async function takeNow(entry){
 if(loaded.has(entry.id)){const o=loaded.get(entry.id);present(o);return o}
 if(loaded.size>=6){const candidates=[...loaded.values()].filter(o=>!inputs.some(s=>s.obj===o)&&drag?.obj!==o);const old=candidates.find(o=>!o.visible)||candidates[0];if(old)disposeToy(old);else{status('掴んでいるおもちゃを置いてから取り出してください。');return}}
 loading.add(entry.id);status(entry.name+' を取り出しています…');
 try{const gltf=await new GLTFLoader().loadAsync(entry.url);const content=optimize(gltf.scene),bounds=new T.Box3().setFromObject(content),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());content.position.copy(center).multiplyScalar(-1);const obj=new T.Group();obj.add(content);const scale=.62/Math.max(size.x,size.y,size.z);obj.scale.setScalar(scale);const box=boxes[cats.indexOf(entry.category)];obj.position.copy(box.position).add(new T.Vector3(0,.98,0));obj.userData={entry,baseScale:scale,home:obj.position.clone()};scene.add(obj);loaded.set(entry.id,obj);targets.push(obj);present(obj);return obj}
 catch(e){status(entry.name+'を読み込めません。モデルファイルと起動場所を確認してください。');console.error(e)}finally{loading.delete(entry.id)}
}
const cursors={};async function showNext(cat){const entries=catalog.filter(e=>e.category===cat),n=cursors[cat]||0;cursors[cat]=(n+1)%entries.length;return take(entries[n])}
function renderList(){$('categories').replaceChildren(...cats.map(c=>{const b=document.createElement('button');b.textContent=c;b.className=c===activeCat?'active':'';b.onclick=()=>{activeCat=c;renderList()};return b}));$('list').replaceChildren(...catalog.filter(e=>e.category===activeCat).map(e=>{const b=document.createElement('button');b.textContent=e.name;b.className=selected?.userData.entry.id===e.id?'active':'';b.onclick=()=>take(e);return b}))}
function rescale(obj,factor){if(!obj)return;obj.scale.setScalar(T.MathUtils.clamp(obj.scale.x*factor,obj.userData.baseScale*.2,obj.userData.baseScale*5))}
$('smaller').onclick=()=>rescale(selected,.85);$('larger').onclick=()=>rescale(selected,1.18);$('rotate').onclick=()=>{if(selected)selected.rotation.y+=Math.PI/8};
function home(o){if(!o)return;releaseAll();o.position.copy(o.userData.home);o.quaternion.identity();o.scale.setScalar(o.userData.baseScale)}$('home').onclick=()=>home(selected);$('reset').onclick=()=>{const shown=new Set();for(const o of [...loaded.values()].reverse()){home(o);o.visible=!shown.has(o.userData.entry.category);shown.add(o.userData.entry.category)}if(selected)present(selected);status('全部の箱に戻しました。')};
const ray=new T.Raycaster(),pointer=new T.Vector2();function hit(){scene.updateMatrixWorld(true);const hits=ray.intersectObjects(targets.filter(o=>o.visible),true);for(const h of hits){let o=h.object;while(o&&!targets.includes(o))o=o.parent;if(o)return{o,point:h.point}}return null}
function screenRay(e){pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(pointer,camera)}
let drag=null,mouseMode='move';const touches=new Map();let gesture=null;
const modes={move:'moveMode',rotate:'rotateMode',orbit:'cameraOrbit',pan:'cameraPan',zoom:'cameraZoom'};
const cameraMode=()=>['orbit','pan','zoom'].includes(mouseMode);
function endDrag(){drag=null;touches.clear();gesture=null}
function setMode(mode){endDrag();mouseMode=mode;for(const [m,id] of Object.entries(modes))$(id).setAttribute('aria-pressed',String(m===mode));$('help').textContent=cameraMode()?'視点操作中：模型には触れません。ホイールでズーム。スマホは2本指でズーム・パン。':'模型操作中：ドラッグで移動／回転。ホイールは模型の大きさ。空白ドラッグは見回す。'}
for(const [m,id]of Object.entries(modes))$(id).onclick=()=>setMode(m);
$('cameraReset').onclick=()=>{endDrag();resetView()};$('cameraNear').onclick=()=>zoomView(.85);$('cameraFar').onclick=()=>zoomView(1/ .85);
$('view').oncontextmenu=e=>e.preventDefault();
function touchPair(){const [a,b]=[...touches.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)}}
const plane=new T.Plane(),point=new T.Vector3(),normal=new T.Vector3();
$('view').onpointerdown=e=>{if(renderer.xr.isPresenting)return;
 if(e.pointerType==='touch'){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size>1){drag=null;if(cameraMode()&&touches.size===2)gesture=touchPair();$('view').setPointerCapture(e.pointerId);return}}
 if(cameraMode())drag={x:e.clientX,y:e.clientY,mode:mouseMode};
 else{screenRay(e);const h=hit();if(h?.o.userData.action){h.o.userData.action();return}if(h){choose(h.o);camera.getWorldDirection(normal);plane.setFromNormalAndCoplanarPoint(normal,h.point);drag={obj:h.o,offset:h.o.position.clone().sub(h.point),x:e.clientX,y:e.clientY,rotate:e.shiftKey||e.button===2||mouseMode==='rotate'}}else drag={x:e.clientX,y:e.clientY,mode:'orbit'}}
 $('view').setPointerCapture(e.pointerId)};
$('view').onpointermove=e=>{if(renderer.xr.isPresenting)return;
 if(touches.has(e.pointerId)){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(gesture&&touches.size===2){const next=touchPair();if(next.d>5&&gesture.d>5)zoomView(gesture.d/next.d);panView(next.x-gesture.x,next.y-gesture.y);gesture=next;return}}
 if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(drag.obj){if(drag.rotate){drag.obj.rotation.y+=dx*.01;drag.obj.rotation.x+=dy*.01}else{screenRay(e);if(ray.ray.intersectPlane(plane,point))drag.obj.position.copy(point).add(drag.offset);drag.obj.position.y=Math.max(.25*drag.obj.scale.x/drag.obj.userData.baseScale,drag.obj.position.y)}}
 else if(drag.mode==='pan')panView(dx,dy);else if(drag.mode==='zoom')zoomView(Math.exp(dy*.008));else{azimuth-=dx*.006;elevation=T.MathUtils.clamp(elevation-dy*.006,.12,Math.PI-.12);view()}
 drag.x=e.clientX;drag.y=e.clientY};
$('view').onpointerup=$('view').onpointercancel=$('view').onlostpointercapture=endDrag;window.addEventListener('blur',endDrag);
$('view').addEventListener('wheel',e=>{e.preventDefault();if(renderer.xr.isPresenting)return;if(cameraMode())zoomView(Math.exp(T.MathUtils.clamp(e.deltaY,-200,200)*.001));else rescale(selected,e.deltaY<0?1.08:1/1.08)},{passive:false});
const inputs=[0,1].map(i=>{const c=renderer.xr.getController(i);rig.add(c);const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-3)]),new T.LineBasicMaterial({color:0x44795d}));c.add(line);const state={c,line,source:null,obj:null,offset:new T.Matrix4()};c.addEventListener('connected',e=>{state.source=e.data;line.visible=!e.data.hand});c.addEventListener('disconnected',()=>{release(state);state.source=null});c.addEventListener('selectstart',()=>grab(state));c.addEventListener('selectend',()=>release(state));return state});
let two=null;function release(s){s.obj=null;two=null;for(const other of inputs)if(other.obj){other.c.updateWorldMatrix(true,false);other.obj.updateWorldMatrix(true,false);other.offset.copy(other.c.matrixWorld).invert().multiply(other.obj.matrixWorld)}}function releaseAll(){for(const s of inputs)s.obj=null;two=null}
function grab(s){s.c.updateWorldMatrix(true,false);ray.ray.origin.setFromMatrixPosition(s.c.matrixWorld);ray.ray.direction.set(0,0,-1).transformDirection(s.c.matrixWorld);let h=hit();if(s.source?.hand){const p=s.c.getWorldPosition(new T.Vector3());let nearest=null,d=.32;for(const o of loaded.values()){const dist=p.distanceTo(o.position);if(o.visible&&dist<d){nearest=o;d=dist}}if(nearest)h={o:nearest}}if(!h)return;if(h.o.userData.action){h.o.userData.action();return}s.obj=h.o;choose(s.obj);s.obj.updateWorldMatrix(true,false);s.offset.copy(s.c.matrixWorld).invert().multiply(s.obj.matrixWorld);const other=inputs.find(x=>x!==s);if(other.obj===s.obj){const a=inputs[0].c.getWorldPosition(new T.Vector3()),b=inputs[1].c.getWorldPosition(new T.Vector3());two={obj:s.obj,vec:b.clone().sub(a),mid:a.clone().add(b).multiplyScalar(.5),pos:s.obj.position.clone(),q:s.obj.quaternion.clone(),scale:s.obj.scale.x};if(two.vec.length()<.04)two=null}}
const matrix=new T.Matrix4();function updateGrab(){for(const s of inputs)if(s.obj&&!s.c.visible)release(s);if(two){const a=inputs[0].c.getWorldPosition(new T.Vector3()),b=inputs[1].c.getWorldPosition(new T.Vector3()),v=b.clone().sub(a);if(v.length()>.04){const q=new T.Quaternion().setFromUnitVectors(two.vec.clone().normalize(),v.clone().normalize()),ratio=T.MathUtils.clamp(v.length()/two.vec.length(),two.obj.userData.baseScale*.2/two.scale,two.obj.userData.baseScale*5/two.scale);two.obj.scale.setScalar(two.scale*ratio);two.obj.quaternion.copy(q).multiply(two.q);two.obj.position.copy(two.pos).sub(two.mid).multiplyScalar(ratio).applyQuaternion(q).add(a.add(b).multiplyScalar(.5))}}else for(const s of inputs)if(s.obj){s.c.updateWorldMatrix(true,false);matrix.multiplyMatrices(s.c.matrixWorld,s.offset);matrix.decompose(s.obj.position,s.obj.quaternion,s.obj.scale)}}
setupHands(renderer,rig);let session=null;
$('vr').onclick=async()=>{try{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','hand-tracking']});releaseAll();endDrag();rig.position.set(0,0,0);camera.position.set(0,1.6,0);renderer.xr.setReferenceSpaceType('local-floor');await renderer.xr.setSession(session);$('vr').textContent='VR体験中';session.addEventListener('end',()=>{releaseAll();view();$('vr').textContent='QuestでVRを開始'})}catch(e){status('VRを開始できません。Questの対応ブラウザと接続方法を確認してください。');console.error(e)}};
try{if(navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr')){$('vr').disabled=false;$('vr').textContent='QuestでVRを開始'}else{$('vr').textContent='PCで遊べます';$('vr').title='このブラウザはVR非対応です'}}catch{$('vr').textContent='PCで遊べます'}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}window.addEventListener('resize',resize);resize();renderList();
renderer.setAnimationLoop(()=>{if(renderer.xr.isPresenting)updateGrab();renderer.render(scene,camera);if(selected){$('selection').dataset.transform=JSON.stringify({id:selected.userData.entry.id,position:selected.position.toArray(),rotation:selected.rotation.toArray().slice(0,3),scale:selected.scale.x,baseScale:selected.userData.baseScale})}$('view').dataset.loaded=String(loaded.size);$('view').dataset.camera=JSON.stringify({position:camera.position.toArray(),focus:focus.toArray(),distance,azimuth,elevation,mode:mouseMode});$('view').dataset.colors=JSON.stringify([...loaded.values()].map(o=>{let colorMeshes=0;o.traverse(m=>{if(m.isMesh&&m.geometry.attributes.color)colorMeshes++});return{id:o.userData.entry.id,colorMeshes}}))});
for(const cat of cats)await showNext(cat);activeCat=cats[0];choose(loaded.get(catalog[0].id));
// Read-only diagnostics for local verification.
window.toyboxDiagnostics=()=>({catalog:catalog.length,loaded:loaded.size,selected:selected?.userData.entry.id,objects:[...loaded.values()].map(o=>({id:o.userData.entry.id,position:o.position.toArray(),rotation:o.rotation.toArray().slice(0,3),scale:o.scale.x,visible:o.visible})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,xr:renderer.xr.isPresenting});
