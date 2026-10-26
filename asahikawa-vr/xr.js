/* Native immersive WebXR: meter-scale right-hand-drive generic AT cockpit. */
function installDrivingXR(){
 const AT=AsahikawaAT;AT.initialize(state);
 const button=document.createElement('button');button.id='enterVR';button.textContent='Quest VRに入る（実機未検証）';button.disabled=true;
 const note=document.createElement('p');note.textContent='VR: リム付近でグリップを握ってハンドルを回す。レバーも掴んで前後へ。A/Xで指したスイッチを選択。右トリガー=アクセル、左=ブレーキ（足ペダルの代替）。B=安全停止、Y=VR終了、右スティック押込み=視点リセット。始動手順は車内の表示を確認してください。';
 $('view').before(button,note);
 let session=null,pending=false,recenter=true,edges={},lastXR=null,lastInput=AT.pedalInput(0,0,0),message='ブレーキ保持で操作開始',grabs={},wheelOwner=null,selectReleased=false;
 const rig=new THREE.Group(),origin=new THREE.Group(),cockpit=new THREE.Group(),targets=[];
 rig.add(origin);world.add(rig,cockpit);cockpit.visible=false;
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.65});
 function mesh(geometry,pos,color,parent=cockpit){const m=new THREE.Mesh(geometry,material(color));m.position.set(...pos);parent.add(m);return m;}
 const box=(size,pos,color=0x263b44,parent=cockpit)=>mesh(new THREE.BoxGeometry(...size),pos,color,parent);
 box([1.7,.20,.45],[0,.87,.98]);box([1.7,.1,2.2],[0,.25,-.1]);box([.25,.38,.9],[.08,.45,.2]);
 for(const x of [-.82,.82])box([.06,.65,1.5],[x,.65,.1]);
 const wheel=new THREE.Group();wheel.position.set(AT.center.x,AT.center.y,AT.center.z);cockpit.add(wheel);
 wheel.name='steering-wheel';
 mesh(new THREE.TorusGeometry(.18,.018,8,40),[0,0,0],0x101b24,wheel);
 box([.31,.022,.024],[0,0,0],0x596b73,wheel);box([.025,.16,.024],[0,-.08,0],0x596b73,wheel);
 box([.07,.06,.04],[0,0,0],0x14252c,wheel);box([.018,.03,.024],[0,.18,0],0xe6dfc1,wheel);
 const gear=new THREE.Group();gear.position.set(.08,.66,AT.gearZ.P);cockpit.add(gear);
 gear.name='gear-lever';
 box([.025,.16,.025],[0,.08,0],0x6b7880,gear);box([.065,.055,.06],[0,.17,0],0x1b242c,gear);
 function label(text,pos,width=.16,height=.055){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const g=c.getContext('2d');g.fillStyle='#10232d';g.fillRect(0,0,512,128);g.fillStyle='#effbf8';g.font='bold 52px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,64,490);
  const texture=new THREE.CanvasTexture(c),m=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  m.position.set(...pos);m.rotation.y=Math.PI;cockpit.add(m);return m;
 }
 function control(name,text,pos,width=.16){
  const m=box([width,.065,.045],pos,0x34505d);m.userData.action=name;targets.push(m);
  label(text,[pos[0],pos[1],pos[2]-.024],width*.94,.05);return m;
 }
 for(const [i,g] of ['P','R','N','D'].entries())control(g,g,[.05+i*.09,.79,.45],.065);
 const parking=control('parking','サイド',[.08,.69,.1]);
 const belt=control('belt','ベルト',[-.72,.84,.23],.15);
 const engine=control('engine','始動',[-.68,1.02,.95],.13);
 control('resume','操作開始',[-.03,1.04,.95],.17);
 control('stop','安全停止',[.17,1.04,.95],.17).material.color.setHex(0xb83443);
 control('recenter','視点リセット',[.39,1.04,.95],.22);
 control('exit','VR終了',[.64,1.04,.95],.16);
 const lights=control('lights','ライト',[-.7,1.16,.98],.15);
 const wiperSwitch=control('wipers','ワイパー',[.05,1.16,.98],.18);
 control('hazard','△',[.25,1.16,.98],.10);
 const signal=new THREE.Group();signal.position.set(-.60,1,.70);cockpit.add(signal);
 box([.14,.025,.025],[-.07,0,0],0x667681,signal);
 control('signalLeft','← 左',[-.71,1.04,.70],.12);control('signalRight','右 →',[-.71,.96,.70],.12);
 const pedals={};
 for(const [name,x,width]of [['throttle',-.51,.065],['brake',-.28,.12]]){
  const p=new THREE.Group();p.position.set(x,.42,.55);cockpit.add(p);box([width,.17,.03],[0,-.08,0],0x45535b,p);pedals[name]=p;
  p.name='pedal-'+name;
 }
 label('BRAKE  /  ACCEL',[-.39,.55,.62],.32,.04);
 const wipers=[];
 for(const x of [-.55,.16]){const p=new THREE.Group();p.position.set(x,1.14,1.18);cockpit.add(p);box([.018,.46,.016],[0,.23,0],0x101c22,p);wipers.push(p);}
 wipers[0].name='wiper-left';wipers[1].name='wiper-right';
 const headlights=[];
 for(const x of [-.65,.65]){const light=new THREE.SpotLight(0xffe8ba,0,55,.5,.5,1.2);light.position.set(x,.8,2.0);light.target.position.set(x,.3,30);cockpit.add(light,light.target);headlights.push(light);}
 const panel=document.createElement('canvas');panel.width=1024;panel.height=384;
 const tex=new THREE.CanvasTexture(panel),screen=new THREE.Mesh(new THREE.PlaneGeometry(.65,.245),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
 screen.position.set(-.38,1.265,1.01);screen.rotation.y=Math.PI;cockpit.add(screen);
 const rays={};for(const hand of ['left','right']){
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-2)]),new THREE.LineBasicMaterial({color:0x80e8d0}));
  origin.add(line);line.visible=false;rays[hand]=line;
 }
 function clearGrabs(){grabs={};wheelOwner=null;}
 function halt(reason){clearGrabs();selectReleased=false;stop(reason);message=reason;}
 window.addEventListener('driving-safety-stop',()=>{clearGrabs();selectReleased=false;});
 function edge(k,v){const hit=v&&!edges[k];edges[k]=v;return hit;}
 function act(name,input=lastInput){
  if(name==='stop'){halt('安全停止。ブレーキ保持で操作開始');return;}
  if(name==='recenter'){recenter=true;halt('視点リセット：停止');return;}
  if(name==='exit'){halt('VR終了');if(session)session.end();return;}
  if(name==='resume'&&state.t>=Number($('duration').value)){message='試行終了。開始点へ戻してください';return;}
  message=AT.action(state,name,input,vehicleAction)||'操作しました';dirty=true;lastHeld=-Infinity;
 }
 function cleanup(){
  halt('VR終了：停止');session=null;lastXR=null;edges={};origin.remove(camera);camera.position.set(0,0,0);camera.rotation.set(0,0,0);
  for(const ray of Object.values(rays))ray.visible=false;
  cockpit.visible=false;renderer.setAnimationLoop(null);last=null;dirty=true;button.textContent='Quest VRに入る（実機未検証）';button.disabled=false;
 }
 async function enter(){
  if(session){await session.end();return;}if(pending)return;pending=true;button.disabled=true;
  try{
   halt('VR開始：ブレーキ保持で操作開始');session=await navigator.xr.requestSession('immersive-vr');
   session.addEventListener('end',cleanup,{once:true});
   session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible')halt('VR非表示で停止');});
   session.addEventListener('inputsourceschange',()=>halt('VR入力変更で停止'));
   renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local');
   origin.add(camera);camera.position.set(0,0,0);camera.rotation.set(0,0,0);await renderer.xr.setSession(session);
   renderer.xr.getReferenceSpace().addEventListener('reset',()=>{recenter=true;halt('VR原点変更で停止');});
   recenter=true;cockpit.visible=true;renderer.setAnimationLoop(tick);button.textContent='VR終了';button.disabled=false;
  }catch(e){note.textContent='VRを開始できません: '+e.message;if(session){try{await session.end();}catch(_){}}cleanup();}
  finally{pending=false;}
 }
 function positionRig(){
  cockpit.position.set(state.px,0,state.pz);cockpit.rotation.set(0,state.yaw,0);
  const seat=new THREE.Vector3(-.38,1.2,.15).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);
  rig.position.set(state.px+seat.x,seat.y,state.pz+seat.z);rig.rotation.set(0,state.yaw+Math.PI,0);
  rig.updateMatrixWorld(true);cockpit.updateMatrixWorld(true);
 }
 function localHand(pose){
  const p=pose.transform.position;
  return cockpit.worldToLocal(origin.localToWorld(new THREE.Vector3(p.x,p.y,p.z)));
 }
 function interact(source,frame,space,input){
  const hand=source.handedness,g=source.gamepad,grip=g.buttons[1].value>.55;
  const pose=frame.getPose(source.gripSpace,space),p=localHand(pose),theta=AT.handAngle(p);
  const grab=grabs[hand];
  if(!grip){if(wheelOwner===hand)wheelOwner=null;delete grabs[hand];}
  else if(!grab&&edge(hand+'Grip',true)){
   if(AT.nearWheel(p)&&wheelOwner===null){grabs[hand]={kind:'wheel',angle:theta};wheelOwner=hand;}
   else if(Math.hypot(p.x-gear.position.x,p.y-(gear.position.y+.17),p.z-gear.position.z)<.13)grabs[hand]={kind:'gear',offset:p.z-gear.position.z,last:state.gear};
  }
  if(!grip)edges[hand+'Grip']=false;
  if(grabs[hand]?.kind==='wheel'){
   const held=grabs[hand];state.wheelAngle=AT.advanceWheel(state.wheelAngle,held.angle,theta);held.angle=theta;
   if(Math.abs(p.z-AT.center.z)>.45){delete grabs[hand];wheelOwner=null;}
  }else if(grabs[hand]?.kind==='gear'){
   const held=grabs[hand],selection=AT.gearAt(p.z-held.offset);
   if(selection!==held.last){act(selection,input);held.last=selection;}
  }
  const rayPose=source.targetRaySpace&&frame.getPose(source.targetRaySpace,space),line=rays[hand];line.visible=!!rayPose;
  let hit=null;
  if(rayPose){
   const t=rayPose.transform;line.position.set(t.position.x,t.position.y,t.position.z);line.quaternion.set(t.orientation.x,t.orientation.y,t.orientation.z,t.orientation.w);
   origin.updateMatrixWorld(true);line.updateMatrixWorld(true);
   const ray=new THREE.Raycaster(line.getWorldPosition(new THREE.Vector3()),new THREE.Vector3(0,0,-1).applyQuaternion(line.getWorldQuaternion(new THREE.Quaternion())),0,2.5);
   hit=ray.intersectObjects(targets,false)[0];line.material.color.setHex(hit?0xffcc66:0x80e8d0);
  }
  if(edge(hand+'Select',g.buttons[4].value>.5)&&selectReleased&&hit)act(hit.object.userData.action,input);
 }
 function animateCockpit(now){
  AT.initialize(state);wheel.rotation.z=-state.wheelAngle;gear.position.z=AT.gearZ[state.gear];
  pedals.throttle.rotation.x=-state.throttle*.4;pedals.brake.rotation.x=-state.brake*.32;
  parking.rotation.x=state.parking?-.4:0;signal.rotation.z=state.signal==='left'?-.25:state.signal==='right'?.25:0;
  wiperSwitch.rotation.z=-state.wipers*.13;
  for(const p of wipers)p.rotation.z=state.engine&&state.wipers?-.15-(1-Math.cos(now*.001*(state.wipers===1?3:5)))*.6:0;
  for(const l of headlights)l.intensity=state.lights?15:0;
  engine.material.color.setHex(state.engine?0x168772:0x34505d);belt.material.color.setHex(state.belt?0x168772:0x34505d);lights.material.color.setHex(state.lights?0xbfb77a:0x34505d);
  const g=panel.getContext('2d');g.fillStyle='#10202a';g.fillRect(0,0,1024,384);g.fillStyle='#eefbf4';g.font='bold 52px sans-serif';g.textAlign='left';
  const blink=Math.floor(now/500)%2===0;
  g.fillText((blink&&['left','hazard'].includes(state.signal)?'← ':'')+state.gear+'  '+(Math.abs(state.v)*3.6).toFixed(1)+' km/h'+(blink&&['right','hazard'].includes(state.signal)?' →':''),25,65);
  g.font='28px sans-serif';g.fillText('ENGINE '+(state.engine?'ON':'OFF')+'   BELT '+(state.belt?'ON':'OFF')+'   PARK '+(state.parking?'ON':'OFF'),25,115);
  g.fillText('LIGHT '+(state.lights?'ON':'OFF')+'   WIPER '+['OFF','LOW','HIGH'][state.wipers],25,160);
  g.fillText(message,25,212,975);
  g.fillText('ベルト → ブレーキ保持で始動 → D/R → サイド解除',25,262,975);
  g.fillText('R trigger: ACCEL / L: BRAKE（足ペダル代替）',25,310,975);
  g.fillText('A/X: 選択   B: 安全停止   Y: VR終了',25,355,975);tex.needsUpdate=true;
 }
 function tick(now,frame){
  if(!session||!frame)return;const space=renderer.xr.getReferenceSpace(),pose=frame.getViewerPose(space),dt=lastXR===null?0:(now-lastXR)/1000;lastXR=now;
  if(!pose||session.visibilityState!=='visible'||dt>.25||graphicsError){halt('VR描画・追跡中断で停止');return;}
  if(recenter){
   const p=pose.transform.position,q=pose.transform.orientation,f=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w)),yaw=Math.atan2(-f.x,-f.z);
   origin.rotation.set(0,-yaw,0);origin.position.set(-p.x,-p.y,-p.z).applyAxisAngle(new THREE.Vector3(0,1,0),-yaw);recenter=false;halt('視点リセット：ブレーキ保持で操作開始');
  }
  positionRig();
  const sources=[...session.inputSources],left=sources.find(s=>s.handedness==='left'),right=sources.find(s=>s.handedness==='right');
  const valid=s=>s?.gamepad?.mapping==='xr-standard'&&s.gamepad.buttons.length>=6&&s.gripSpace&&frame.getPose(s.gripSpace,space)&&s.gamepad.buttons.every(b=>Number.isFinite(b.value));
  if(!valid(left)||!valid(right)){halt('両コントローラーの入力・追跡を確認してください');edges={};for(const ray of Object.values(rays))ray.visible=false;}
  else{
   if(left.gamepad.buttons[4].value<.5&&right.gamepad.buttons[4].value<.5)selectReleased=true;
   lastInput=AT.pedalInput(right.gamepad.buttons[0].value,left.gamepad.buttons[0].value,state.wheelAngle);
   if(edge('emergency',right.gamepad.buttons[5].value>.5))act('stop');
   if(edge('exit',left.gamepad.buttons[5].value>.5)){act('exit');return;}
   if(edge('recenter',right.gamepad.buttons[3].value>.5))act('recenter');
   interact(left,frame,space,lastInput);interact(right,frame,space,lastInput);
   lastInput.steerAngle=state.wheelAngle/AT.ratio;
   for(let remaining=Math.max(0,Math.min(dt,.25));remaining>1e-9&&state.running;){
    const h=Math.min(remaining,1/120);step(state,h,false,lastInput,Number($('duration').value));remaining-=h;
    if(state.blocked||state.t>=Number($('duration').value))halt(state.blocked||'試行終了');
   }
  }
  updateView(state);playerCar.visible=false;cockpit.visible=true;positionRig();animateCockpit(now);
  camera.position.set(0,0,0);camera.rotation.set(0,0,0);rig.updateMatrixWorld(true);renderer.render(world,camera);
 }
 function desktopView(s){
  if(session)return;
  state.wheelAngle=s.steer*AT.ratio;
  cockpit.visible=$('cameraMode').value==='ground';
  if(!cockpit.visible)return;
  positionRig();animateCockpit(performance.now());
  const seat=new THREE.Vector3(-.38,1.2,.15).applyAxisAngle(new THREE.Vector3(0,1,0),s.yaw);
  camera.position.set(s.px+seat.x,seat.y,s.pz+seat.z);camera.lookAt(camera.position.x+Math.sin(s.yaw)*10,1.2,camera.position.z+Math.cos(s.yaw)*10);
 }
 if(renderer&&isSecureContext&&navigator.xr)navigator.xr.isSessionSupported('immersive-vr').then(ok=>{button.disabled=!ok;if(!ok)note.textContent+=' この環境はimmersive-vr非対応です。';}).catch(e=>{note.textContent+=' '+e.message;});
 else note.textContent+=' HTTPSとWebXR対応ブラウザーが必要です。';
 button.onclick=enter;
 return {get active(){return !!session||pending;},desktopView};
}

