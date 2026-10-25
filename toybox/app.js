import {createXRInput} from './xr-input.js?v=6e';
import {createPocketPanel} from './xr-panel.js?v=6e';
import {MAX_TOYS,MAX_TRIANGLES,canAdd} from './xr-policy.js?v=6e';
import {setupPanels} from './panels.js';
import {keyboardCommand} from './keyboard.js';
import * as T from './lib/three.module.min.js';
import {GLTFLoader} from './lib/GLTFLoader.js';
import {optimize} from './optimize.js';
import {setupHands} from './lib/hands.js';
const $=id=>document.getElementById(id),status=s=>{$('status').textContent=s;$('compactFeedback').title=s;$('notice').textContent=s};
const panelUI=setupPanels();

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
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
const studio=new T.Scene();studio.background=new T.Color(.3,.3,.3);const pmrem=new T.PMREMGenerator(renderer);const studioMap=pmrem.fromScene(studio,.04);scene.environment=studioMap.texture;pmrem.dispose();
scene.add(new T.HemisphereLight(0xffffff,0x789782,1.4));const sun=new T.DirectionalLight(0xfff4dc,2.2);sun.position.set(3,6,4);scene.add(sun);
$('lighting').onchange=()=>{const improved=$('lighting').value==='studio';scene.environment=improved?studioMap.texture:null;renderer.toneMapping=improved?T.ACESFilmicToneMapping:T.NoToneMapping;renderer.toneMappingExposure=1;scene.children.find(o=>o.isHemisphereLight).intensity=improved?1.4:2.4;sun.intensity=improved?2.2:3};
function mesh(w,h,d,c,x,y,z,parent=scene){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.8}));m.position.set(x,y,z);parent.add(m);return m}
mesh(40,.08,40,'#d3dfd0',0,-.05,0);const grid=new T.GridHelper(30,60,0xb4c9b3,0xc4d4c1);grid.position.y=.001;scene.add(grid);
const catalog=await fetch('./catalog.json?v=3').then(r=>{if(!r.ok)throw Error('目録がありません');return r.json()});
for(const entry of catalog)entry.category='おもちゃ';
const colors=['#92b4a4'],cats=['おもちゃ'],boxes=[],targets=[],loaded=new Map(),loading=new Set();let selected=null,activeCat=cats[0];
function label(text,w=1.05,h=.16){const c=document.createElement('canvas');c.width=840;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#fdfaf0';ctx.fillRect(0,0,840,128);ctx.fillStyle='#395147';ctx.textAlign='center';let font=46;ctx.font=`bold ${font}px sans-serif`;while(ctx.measureText(text).width>800){ctx.font=`bold ${--font}px sans-serif`}ctx.fillText(text,420,80);const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),side:T.DoubleSide,toneMapped:false}));return m}
cats.forEach((cat,i)=>{const g=new T.Group(),x=0,z=-1.45;g.position.set(x,0,z);scene.add(g);const col=colors[i];mesh(3,.09,3,col,0,.55,0,g);mesh(3,.32,.05,col,0,.72,-1.48,g);mesh(3,.23,.05,col,0,.67,1.48,g);mesh(.05,.32,3,col,-1.48,.72,0,g);mesh(.05,.32,3,col,1.48,.72,0,g);for(const a of [-1.35,1.35])for(const b of [-1.35,1.35])mesh(.08,.52,.08,col,a,.26,b,g);const sign=label(cat);sign.position.set(0,.72,1.51);g.add(sign);sign.userData.action=()=>{activeCat=cat;renderList();showNext(cat)};targets.push(sign);boxes.push(g);const next=label('次のおもちゃ →',.72,.12);next.position.set(0,.92,-1.45);g.add(next);next.userData.action=()=>showNext(cat);targets.push(next)});
const instruction=label('狙ってつまむ ／ スティックで手前・奥 ／ パネルで手元へ',3.3,.28);instruction.position.set(0,1.8,-3.3);scene.add(instruction);
// Flatten the current pose, then batch by material to keep draw calls bounded.

function choose(obj){selected=obj;$('selection').textContent=obj?obj.userData.entry.name:'おもちゃを選んでください';renderList()}
let loadQueue=Promise.resolve(),loadEpoch=0;
function take(entry){const epoch=loadEpoch;loadQueue=loadQueue.then(()=>epoch===loadEpoch?takeNow(entry,epoch):null);return loadQueue}
function present(obj){obj.visible=true;choose(obj);status('取り出しました。最大16個／220万三角形。片付けは明示操作のみ。')}
function disposeToy(obj){scene.remove(obj);targets.splice(targets.indexOf(obj),1);loaded.delete(obj.userData.entry.id);if(selected===obj)choose(null);const materials=new Set(),textures=new Set();obj.traverse(o=>{if(o.isMesh){o.geometry.dispose();materials.add(o.material)}});for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose()}for(const t of textures){t.dispose();t.source?.data?.close?.()}}
async function takeNow(entry,epoch){
 if(loaded.has(entry.id)){const o=loaded.get(entry.id);present(o);return o}
 if(!canAdd(loaded.size,totalTriangles())){status('上限です。選択した模型または全部を片付けてから追加してください。');return}
 loading.add(entry.id);status(entry.name+' を取り出しています…');
 try{const gltf=await new GLTFLoader().loadAsync(entry.url);const content=optimize(gltf.scene);let triangles=0;content.traverse(m=>{if(m.isMesh)triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3});if(epoch!==loadEpoch||!canAdd(loaded.size,totalTriangles(),triangles)){content.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose()}});status('描画量の上限です。模型を片付けてから追加してください。');return}const bounds=new T.Box3().setFromObject(content),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());content.position.copy(center).multiplyScalar(-1);const obj=new T.Group();obj.add(content);const scale=.62/Math.max(size.x,size.y,size.z);obj.scale.setScalar(scale);const box=boxes[0];let slot=0;while([...loaded.values()].some(o=>o.userData.slot===slot))slot++;obj.position.copy(box.position).add(new T.Vector3((slot%4-1.5)*.65,.98,(Math.floor(slot/4)-1.5)*.65));obj.userData={entry,slot,triangles,baseScale:scale,home:obj.position.clone()};scene.add(obj);loaded.set(entry.id,obj);targets.push(obj);present(obj);return obj}
 catch(e){status(entry.name+'を読み込めません。モデルファイルと起動場所を確認してください。');console.error(e)}finally{loading.delete(entry.id)}
}
const cursors={};async function showNext(cat){const entries=catalog.filter(e=>e.category===cat),n=cursors[cat]||0;cursors[cat]=(n+1)%entries.length;return take(entries[n])}
function renderList(){const f=document.activeElement,owner=f?.parentElement?.id,label=f?.textContent;$('categories').replaceChildren(...cats.map(c=>{const b=document.createElement('button');b.textContent=c;b.className=c===activeCat?'active':'';b.onclick=()=>{activeCat=c;renderList()};return b}));$('list').replaceChildren(...catalog.filter(e=>e.category===activeCat).map(e=>{const b=document.createElement('button');b.textContent=e.name;b.className=selected?.userData.entry.id===e.id?'active':'';b.onclick=()=>take(e);return b}));if(['categories','list'].includes(owner)){const next=[...$(owner).children].find(b=>b.textContent===label);next?.focus({preventScroll:true})}}
function rescale(obj,factor){if(!obj)return;obj.scale.setScalar(T.MathUtils.clamp(obj.scale.x*factor,obj.userData.baseScale*.2,obj.userData.baseScale*5))}
$('smaller').onclick=()=>rescale(selected,.85);$('larger').onclick=()=>rescale(selected,1.18);$('rotate').onclick=()=>{if(selected)selected.rotation.y+=Math.PI/8};
function home(o){if(!o)return;releaseAll();o.position.copy(o.userData.home);o.quaternion.identity();o.scale.setScalar(o.userData.baseScale)}$('home').onclick=()=>home(selected);$('reset').onclick=clearToys;
function totalTriangles(){return [...loaded.values()].reduce((n,o)=>n+(o.userData.triangles||0),0)}
function clearToys(){loadEpoch++;releaseAll();endDrag();for(const o of [...loaded.values()])disposeToy(o);status('全て片付けました。元モデルは変更していません。')}
function removeSelected(){if(selected){releaseAll();endDrag();disposeToy(selected)}}
$('removeSelected').onclick=removeSelected;

const ray=new T.Raycaster(),pointer=new T.Vector2();function hit(){scene.updateMatrixWorld(true);const hits=ray.intersectObjects(targets.filter(o=>o.visible),true);for(const h of hits){let o=h.object;while(o&&!targets.includes(o))o=o.parent;if(o)return{o,point:h.point,uv:h.uv}}return null}
function screenRay(e){pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(pointer,camera)}
let drag=null,mouseMode='move';const touches=new Map();let gesture=null;
const modes={move:'moveMode',rotate:'rotateMode',orbit:'cameraOrbit',pan:'cameraPan',zoom:'cameraZoom'};
const cameraMode=()=>['orbit','pan','zoom'].includes(mouseMode);
function endDrag(){drag=null;touches.clear();gesture=null}
function setMode(mode){endDrag();mouseMode=mode;$('keyboardMode').textContent=cameraMode()?'キーボード：視点':'キーボード：模型';for(const [m,id] of Object.entries(modes))$(id).setAttribute('aria-pressed',String(m===mode));$('help').textContent=cameraMode()?'視点操作中：模型には触れません。ホイールでズーム。スマホは2本指でズーム・パン。':'模型操作中：ドラッグで移動／回転。ホイールは模型の大きさ。空白ドラッグは見回す。'}
for(const [m,id]of Object.entries(modes))$(id).onclick=()=>setMode(m);
$('cameraReset').onclick=()=>{endDrag();resetView()};$('cameraNear').onclick=()=>zoomView(.85);$('cameraFar').onclick=()=>zoomView(1/ .85);
$('view').oncontextmenu=e=>e.preventDefault();
function touchPair(){const [a,b]=[...touches.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)}}
const plane=new T.Plane(),point=new T.Vector3(),normal=new T.Vector3();
$('view').onpointerdown=e=>{if(renderer.xr.isPresenting)return;
 if(e.pointerType==='touch'){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size>1){drag=null;if(cameraMode()&&touches.size===2)gesture=touchPair();$('view').setPointerCapture(e.pointerId);return}}
 if(cameraMode())drag={x:e.clientX,y:e.clientY,mode:mouseMode};
 else{screenRay(e);const h=hit();if(h?.o.userData.action){h.o.userData.action();return}if(h){if(h.o===pocket.panel){pocket.activate(h.uv);return}choose(h.o);camera.getWorldDirection(normal);plane.setFromNormalAndCoplanarPoint(normal,h.point);drag={obj:h.o,offset:h.o.position.clone().sub(h.point),x:e.clientX,y:e.clientY,rotate:e.shiftKey||e.button===2||mouseMode==='rotate'}}else drag={x:e.clientX,y:e.clientY,mode:'orbit'}}
 $('view').setPointerCapture(e.pointerId)};
$('view').onpointermove=e=>{if(renderer.xr.isPresenting)return;
 if(touches.has(e.pointerId)){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(gesture&&touches.size===2){const next=touchPair();if(next.d>5&&gesture.d>5)zoomView(gesture.d/next.d);panView(next.x-gesture.x,next.y-gesture.y);gesture=next;return}}
 if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(drag.obj){if(drag.rotate){drag.obj.rotation.y+=dx*.01;drag.obj.rotation.x+=dy*.01}else{screenRay(e);if(ray.ray.intersectPlane(plane,point))drag.obj.position.copy(point).add(drag.offset);drag.obj.position.y=Math.max(.25*drag.obj.scale.x/drag.obj.userData.baseScale,drag.obj.position.y)}}
 else if(drag.mode==='pan')panView(dx,dy);else if(drag.mode==='zoom')zoomView(Math.exp(dy*.008));else{azimuth-=dx*.006;elevation=T.MathUtils.clamp(elevation-dy*.006,.12,Math.PI-.12);view()}
 drag.x=e.clientX;drag.y=e.clientY};
$('view').onpointerup=$('view').onpointercancel=$('view').onlostpointercapture=endDrag;window.addEventListener('blur',endDrag);
$('view').addEventListener('wheel',e=>{e.preventDefault();if(renderer.xr.isPresenting)return;if(cameraMode())zoomView(Math.exp(T.MathUtils.clamp(e.deltaY,-200,200)*.001));else rescale(selected,e.deltaY<0?1.08:1/1.08)},{passive:false});
// Keyboard commands only belong to the explicitly focused play area.
let keyboardSelectionPending=false;
$('keyboardStart').onclick=()=>$('view').focus({preventScroll:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)endDrag()});
$('view').addEventListener('blur',endDrag);
$('view').addEventListener('keydown',async e=>{
 const cmd=keyboardCommand(e,{focused:document.activeElement===$('view'),xr:renderer.xr.isPresenting,hidden:document.hidden,dragging:!!drag});
 if(!cmd)return;e.preventDefault();
 if(cmd.action==='exit'){endDrag();$('keyboardStart').focus();return}
 if(cmd.action==='camera'){setMode('orbit');return}
 if(cmd.action==='model'){setMode('move');return}
 if(cmd.action==='help'){panelUI.help();return}
 if(['previous','next','category'].includes(cmd.action)){
  if(keyboardSelectionPending||loading.size)return;keyboardSelectionPending=true;
  try{if(cmd.action==='category')activeCat=cats[0];const entries=catalog.filter(x=>x.category===activeCat);let i=entries.findIndex(x=>x.id===selected?.userData.entry.id);if(cmd.action==='category')i=0;else i=i<0?0:(i+(cmd.action==='next'?1:-1)+entries.length)%entries.length;renderList();await take(entries[i])}finally{keyboardSelectionPending=false}return;
 }
 if(cmd.action==='home'){if(cameraMode())resetView();else home(selected);return}
 if(cmd.action==='scale'){const f=Math.exp(cmd.direction*.08*cmd.fine);if(cameraMode())zoomView(1/f);else rescale(selected,f);return}
 if(cmd.action==='rotate'){
  const h=cmd.key==='arrowleft'?-1:cmd.key==='arrowright'?1:0,v=cmd.key==='arrowup'?-1:cmd.key==='arrowdown'?1:0,r=cmd.key==='z'?-1:cmd.key==='x'?1:0,step=.06*cmd.fine;
  if(cameraMode()){azimuth+=h*step;elevation=T.MathUtils.clamp(elevation+v*step,.12,Math.PI-.12);view()}
  else if(selected){selected.rotation.y+=h*step;selected.rotation.x+=v*step;selected.rotation.z+=r*step}return;
 }
 if(cmd.action==='translate'){
  const dx=cmd.key==='a'?-1:cmd.key==='d'?1:0,dz=cmd.key==='w'?1:cmd.key==='s'?-1:0,dy=cmd.key==='q'?-1:cmd.key==='e'?1:0;
  const right=new T.Vector3(Math.cos(azimuth),0,-Math.sin(azimuth)),forward=new T.Vector3(-Math.sin(azimuth),0,-Math.cos(azimuth));const delta=right.multiplyScalar(dx).addScaledVector(forward,dz);delta.y=dy;delta.multiplyScalar(.08*cmd.fine);
  if(cameraMode()){focus.add(delta).clamp(new T.Vector3(-10,-2,-10),new T.Vector3(10,8,10));view()}
  else if(selected){selected.position.add(delta).clamp(new T.Vector3(-10,.05,-10),new T.Vector3(10,8,10))}
 }
});

const pocket=createPocketPanel({scene,camera:()=>renderer.xr.isPresenting?renderer.xr.getCamera():camera,label,targets,next:()=>stepToy(1),previous:()=>stepToy(-1),bring:()=>xrInput.bring(),clear:clearToys,remove:removeSelected,release:()=>xrInput.reset(),readout:()=>({name:selected?.userData.entry.name||'選択なし',perf:$('performance').textContent,status:$('status').textContent})});
function stepToy(delta){const i=catalog.findIndex(e=>e.id===selected?.userData.entry.id);return take(catalog[(i+delta+catalog.length)%catalog.length])}
const xrInput=createXRInput({renderer,camera:()=>renderer.xr.isPresenting?renderer.xr.getCamera():camera,rig,scene,targets,toys:()=>loaded.values(),choose,selected:()=>selected,panel:pocket.panel,activate:pocket.activate,status});
const inputs=xrInput.states;function releaseAll(){xrInput.reset()}
$('panelPreview').onclick=()=>{pocket.panel.visible=!pocket.panel.visible;if(pocket.panel.visible)pocket.reset(true)};
setupHands(renderer,rig);let session=null;
$('vr').onclick=async()=>{try{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','hand-tracking']});releaseAll();endDrag();rig.position.set(0,0,0);camera.position.set(0,1.6,0);renderer.xr.setReferenceSpaceType('local-floor');await renderer.xr.setSession(session);pocket.reset(false);session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible')releaseAll()});renderer.xr.getReferenceSpace()?.addEventListener('reset',()=>{releaseAll();pocket.reset(false)});$('vr').textContent='VR体験中';session.addEventListener('end',()=>{releaseAll();pocket.update(0,false);view();$('vr').textContent='QuestでVRを開始'})}catch(e){status('VRを開始できません。Questの対応ブラウザと接続方法を確認してください。');console.error(e)}};
try{if(navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr')){$('vr').disabled=false;$('vr').textContent='QuestでVRを開始'}else{$('vr').textContent='PCで遊べます';$('vr').title='このブラウザはVR非対応です'}}catch{$('vr').textContent='PCで遊べます'}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}window.addEventListener('resize',resize);resize();renderList();
let lastFrame=0,frameAverage=16,perfLast=0;renderer.setAnimationLoop((time,frame)=>{const dt=lastFrame?(time-lastFrame)/1000:0;lastFrame=time;if(dt>0&&dt<.25)frameAverage=frameAverage*.97+dt*1000*.03;xrInput.update(dt,frame);if(renderer.xr.isPresenting)pocket.update(time,true);if(time-perfLast>500){$('performance').textContent=`${loaded.size}/${MAX_TOYS}個 · ${Math.round(totalTriangles()/1000)}k/2200k三角形 · ${Math.round(1000/frameAverage)}fps目安${frameAverage>22?' / 負荷高・片付け推奨':''}`;perfLast=time;}renderer.render(scene,camera);if(selected){$('selection').dataset.transform=JSON.stringify({id:selected.userData.entry.id,position:selected.position.toArray(),rotation:selected.rotation.toArray().slice(0,3),scale:selected.scale.x,baseScale:selected.userData.baseScale})}$('view').dataset.panel=JSON.stringify({visible:pocket.panel.visible,position:pocket.panel.position.toArray(),quaternion:pocket.panel.quaternion.toArray()});$('view').dataset.loaded=String(loaded.size);$('view').dataset.camera=JSON.stringify({position:camera.position.toArray(),focus:focus.toArray(),distance,azimuth,elevation,mode:mouseMode});$('view').dataset.colors=JSON.stringify([...loaded.values()].map(o=>{let colorMeshes=0;o.traverse(m=>{if(m.isMesh&&m.geometry.attributes.color)colorMeshes++});return{id:o.userData.entry.id,colorMeshes}}))});
for(const cat of cats)await showNext(cat);activeCat=cats[0];choose(loaded.get(catalog[0].id));
// Read-only diagnostics for local verification.
window.toyboxDiagnostics=()=>({catalog:catalog.length,loaded:loaded.size,selected:selected?.userData.entry.id,objects:[...loaded.values()].map(o=>({id:o.userData.entry.id,position:o.position.toArray(),rotation:o.rotation.toArray().slice(0,3),scale:o.scale.x,visible:o.visible})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,xr:renderer.xr.isPresenting});
