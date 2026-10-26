const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let checks=0;
function check(v,msg){assert.ok(v,msg);checks++;}
for(const page of ['asahikawa-scene-v2','asahikawa-driving-qa-v6','asahikawa-vr']){
 const html=fs.readFileSync(path.join(root,page,'index.html'),'utf8');
 check(html.includes('src="../asahikawa-shared/wheels.js"'),page+' shared script');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 scripts.forEach(s=>new vm.Script(s));
 const context=vm.createContext({console});
 vm.runInContext(scripts[0],context);
 vm.runInContext(fs.readFileSync(path.join(root,'asahikawa-shared/wheels.js'),'utf8'),context);
 vm.runInContext(scripts[1],context);
 vm.runInContext(fs.readFileSync(path.join(root,'asahikawa-vr/controls.js'),'utf8'),context);
 const main=scripts[2];
 vm.runInContext(main.slice(main.indexOf('// Generic AT'),main.indexOf('// Scene/view adapter')),context);
 const result=vm.runInContext(`(()=>{
 const T=THREE,W=AsahikawaWheels,out=[];
 for(const yaw of [0,.7,-1.2])for(const steer of [0,.4,-.4])for(const distance of [1,-1]){
  const car=new T.Group(),w=W.create(T,car);car.rotation.y=yaw;
  const s={wheelTravel:distance,steer};W.update(w,s);car.updateMatrixWorld(true);
  for(const wheel of w.all){
   const q=wheel.getWorldQuaternion(new T.Quaternion()),axis=new T.Vector3(1,0,0).applyQuaternion(q);
   const heading=yaw+(w.front.includes(wheel.parent)?steer:0);
   const expected=new T.Vector3(Math.cos(heading),0,-Math.sin(heading));
   out.push(axis.distanceTo(expected)<1e-10);
   const spin=distance/W.radius;
   out.push(Math.abs(wheel.rotation.x-spin)<1e-10);
   const velocity=new T.Vector3().crossVectors(expected.clone().multiplyScalar(distance),new T.Vector3(0,-W.radius,0));
   out.push(velocity.dot(new T.Vector3(Math.sin(heading),0,Math.cos(heading)))*distance<0);
   wheel.children[0].geometry.computeBoundingBox();
   const size=wheel.children[0].geometry.boundingBox.getSize(new T.Vector3());
   out.push(Math.abs(size.x-.22)<1e-6&&Math.abs(size.y-.74)<1e-6);
  }
 }
 for(const gear of ['D','R'])for(const turn of ['a','d']){
  const s=initialVehicleState();Object.assign(s,{engine:true,belt:true,parking:false,gear});
  const old=s.wheelTravel;
  step(s,1/120,false,new Set(['w',turn]),60);
  out.push(!s.blocked&&Math.sign(s.wheelTravel-old)===(gear==='D'?1:-1));
  out.push(Math.sign(s.yaw)===(gear==='D'?1:-1)*(turn==='a'?1:-1));
 }
 const stopped=initialVehicleState();stopped.blocked='test';step(stopped,.1,false,new Set(['w']),60);out.push(stopped.wheelTravel===0);
 const zero={wheelTravel:0};W.advance(zero,2);W.advance(zero,-2);out.push(zero.wheelTravel===0);
 return out;
})()`,context);
 result.forEach((v,i)=>check(v,page+' matrix/motion '+i));
 console.log(page+': '+result.length+' matrix/motion assertions passed; inline JS parsed');
}
new vm.Script(fs.readFileSync(path.join(root,'asahikawa-vr/xr.js'),'utf8'));
console.log('PASS '+checks+' assertions');


// Actual adapter and real AT physics with a simulated XR runtime and poses.
(async()=>{
 const html=fs.readFileSync(path.join(root,'asahikawa-vr/index.html'),'utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const c=vm.createContext({console});vm.runInContext(scripts[0],c);vm.runInContext(scripts[1],c);
 vm.runInContext(fs.readFileSync(path.join(root,'asahikawa-shared/wheels.js'),'utf8'),c);
 vm.runInContext(fs.readFileSync(path.join(root,'asahikawa-vr/controls.js'),'utf8'),c);
 vm.runInContext(scripts[2].slice(scripts[2].indexOf('// Generic AT'),scripts[2].indexOf('// Scene/view adapter')),c);
 const T=c.THREE,AT=c.AsahikawaAT,state=vm.runInContext('initialVehicleState()',c);Object.assign(state,{running:false});
 const elements=new Map(),element=()=>({disabled:false,textContent:'',value:'60',before(){},getContext(){return {fillRect(){},fillText(){}};}});
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const world=new T.Scene(),camera=new T.PerspectiveCamera(),listeners={},space={addEventListener(n,f){listeners['space:'+n]=f;}};
 const gamepad=()=>({mapping:'xr-standard',buttons:Array.from({length:6},()=>({value:0})),axes:[0,0,0,0]});
 const left={handedness:'left',gamepad:gamepad(),gripSpace:{hand:'left'},targetRaySpace:{ray:'left'}};
 const right={handedness:'right',gamepad:gamepad(),gripSpace:{hand:'right'},targetRaySpace:{ray:'right'}};
 const session={visibilityState:'visible',inputSources:[left,right],addEventListener(n,f){listeners[n]=f;},async end(){listeners.end();}};
 let loop,renders=0;const renderer={xr:{setReferenceSpaceType(){},async setSession(){},getReferenceSpace(){return space;}},setAnimationLoop(f){loop=f;},render(){renders++;}};
 const document={createElement:element},navigator={xr:{async isSessionSupported(){return true;},async requestSession(){return session;}}};
 let button;$('view').before=b=>button=b;
 Object.assign(c,{world,camera,renderer,document,navigator,window:{addEventListener(){}},isSecureContext:true,$,state,performance:{now:()=>0},
  stop(){state.v=0;state.running=false;state.parking=true;state.throttle=0;state.brake=0;},updateView(){},playerCar:{visible:true},graphicsError:'',last:0,lastHeld:0,dirty:false});
 vm.runInContext(fs.readFileSync(path.join(root,'asahikawa-vr/xr.js'),'utf8')+';globalThis.api=installDrivingXR();',c);
 await Promise.resolve();await button.onclick();check(c.api.active,'XR active');
 const transform=p=>({transform:{position:p,orientation:{x:0,y:0,z:0,w:1}}});
 let tracked=true,aim={x:-.03,y:1.04,z:.95},hands={left:{x:.7,y:.5,z:0},right:{x:-.38,y:1.18,z:.65}};
 const raw=p=>({x:-(p.x+.38),y:p.y,z:-(p.z-.15)});
 const frame={getViewerPose(){return tracked?transform({x:0,y:1.2,z:0}):null;},getPose(s){if(!tracked)return null;return transform(raw(s.ray?{...aim,z:aim.z-.25}:hands[s.hand]));}};
 let time=0;const tick=()=>loop(time+=11,frame);
 function press(i,source=right){source.gamepad.buttons[i].value=1;tick();source.gamepad.buttons[i].value=0;tick();}
 function choose(p){aim=p;press(4);}
 const targets={resume:{x:-.03,y:1.04,z:.95},belt:{x:-.72,y:.84,z:.23},engine:{x:-.68,y:1.02,z:.95},parking:{x:.08,y:.69,z:.1},D:{x:.32,y:.79,z:.45},R:{x:.14,y:.79,z:.45},P:{x:.05,y:.79,z:.45},N:{x:.23,y:.79,z:.45},wipers:{x:.05,y:1.16,z:.98},lights:{x:-.7,y:1.16,z:.98},signalLeft:{x:-.71,y:1.04,z:.70}};
 tick();check(!state.running&&!state.engine&&!state.belt&&state.parking,'entry does not bypass AT procedure');
 choose(targets.resume);check(!state.running,'resume requires brake');
 left.gamepad.buttons[0].value=.6;choose(targets.resume);check(state.running,'brake plus cockpit resume');
 choose(targets.belt);check(state.belt,'ray select belt');
 left.gamepad.buttons[0].value=0;choose(targets.engine);check(!state.engine,'engine refuses no brake');
 left.gamepad.buttons[0].value=.6;choose(targets.engine);check(state.engine,'brake engine start');
 hands.left={x:.08,y:.83,z:.52};left.gamepad.buttons[1].value=1;tick();
 hands.left.z=.28;tick();check(state.gear==='D','grip lever drag to D');
 hands.left.z=.44;tick();check(state.gear==='R','grip lever drag to R');
 left.gamepad.buttons[1].value=0;tick();hands.left={x:.7,y:.5,z:0};
 choose(targets.D);check(state.gear==='D','brake shift D');
 check(world.getObjectByName('gear-lever').position.z===AT.gearZ.D,'visible lever follows D');
 choose(targets.parking);check(!state.parking,'brake parking release');
 choose(targets.wipers);check(state.wipers===1,'wipers low');choose(targets.wipers);check(state.wipers===2,'wipers high');choose(targets.wipers);check(state.wipers===0,'wipers off');
 choose(targets.lights);check(state.lights,'lights switch');
 // A nearby grip acquires the actual rim; subsequent hand movement turns it.
 right.gamepad.buttons[1].value=1;tick();
 hands.right={x:-.38+.18,y:1,z:.65};tick();check(state.wheelAngle>1.4&&state.steer>.1,'grab wheel turns front steering');
 right.gamepad.buttons[1].value=0;tick();
 const savedAngle=state.wheelAngle;hands.right={x:-.38-.18,y:1,z:.65};tick();check(state.wheelAngle===savedAngle,'ungrabbed hand does not steer');
 check(world.getObjectByName('steering-wheel').rotation.z===-state.wheelAngle,'visible rim follows physical input');
 // Return to straight through hand motion while grabbed; no acquisition jump.
 right.gamepad.buttons[1].value=1;tick();hands.right={x:-.38,y:1.18,z:.65};tick();right.gamepad.buttons[1].value=0;tick();
 state.wheelAngle=0;
 left.gamepad.buttons[0].value=0;right.gamepad.buttons[0].value=.4;for(let i=0;i<60;i++)tick();
 check(state.v>0&&Math.abs(state.throttle-.4)<1e-6,'continuous .4 accelerator, forward physics');
 check(Math.abs(world.getObjectByName('pedal-throttle').rotation.x+.16)<1e-6,'visible accelerator depression');
 const beforeGear=state.gear;choose(targets.R);check(state.gear===beforeGear,'moving reverse rejected');
 left.gamepad.buttons[0].value=1;for(let i=0;i<60;i++)tick();check(Math.abs(state.v)<1e-8,'brake overrides accelerator');
 right.gamepad.buttons[0].value=0;choose(targets.R);check(state.gear==='R','stationary brake shift reverse');
 left.gamepad.buttons[0].value=0;right.gamepad.buttons[0].value=.3;for(let i=0;i<30;i++)tick();check(state.v<0,'reverse physics');
 press(5);check(!state.running&&state.v===0&&state.parking,'B emergency stops');
 choose(targets.resume);check(!state.running,'held accelerator blocks restart');
 right.gamepad.buttons[0].value=0;left.gamepad.buttons[0].value=.5;choose(targets.resume);check(state.running,'deliberate braked restart');
 tracked=false;tick();check(!state.running,'head tracking loss stops');tracked=true;tick();check(!state.running,'pose return does not resume');
 aim=targets.resume;right.gamepad.buttons[4].value=1;tracked=false;tick();tracked=true;tick();check(!state.running,'held selector on tracking recovery cannot restart');right.gamepad.buttons[4].value=0;tick();
 session.inputSources=[];listeners.inputsourceschange();tick();check(!state.running,'controller removal stops');
 session.inputSources=[left,right];session.visibilityState='hidden';listeners.visibilitychange();check(!state.running,'hidden stops');
 session.visibilityState='visible';listeners['space:reset']();tick();check(!state.running,'reference reset stops');
 await session.end();check(!c.api.active&&!state.running&&!loop,'exit restores desktop stopped');check(renders>0,'XR renderer called');
 // Pure policy limits, wraparound and mechanics using actual vehicleAction/motion.
 const s=vm.runInContext('initialVehicleState()',c);s.running=true;const br=AT.pedalInput(0,.6,0),none=AT.pedalInput(0,0,0);
 AT.action(s,'belt',br,c.vehicleAction);AT.action(s,'engine',br,c.vehicleAction);
 for(const gear of ['R','N','D','P']){AT.action(s,gear,br,c.vehicleAction);check(s.gear===gear,'stationary shift '+gear);}
 s.gear='D';s.v=2;AT.action(s,'P',br,c.vehicleAction);check(s.gear==='D','moving P rejected');
 s.v=0;AT.action(s,'parking',none,c.vehicleAction);check(s.parking,'parking release needs brake');
 s.signal='left';s.signalArmed=false;s.parking=false;s.gear='D';
 c.vehicleMotion(s,.1,AT.pedalInput(0,0,3));check(s.signalArmed,'signal arms on left steering');
 c.vehicleMotion(s,.1,AT.pedalInput(0,0,0));check(s.signal==='off','signal returns off when centered');
 check(Math.abs(AT.advanceWheel(0,Math.PI-.01,-Math.PI+.01)+.02)<1e-8,'rim angle unwrap');
 check(AT.advanceWheel(AT.maxWheel,0,-1)===AT.maxWheel,'wheel mechanical limit');
 for(const g of ['P','R','N','D'])check(AT.gearAt(AT.gearZ[g])===g,'lever detent '+g);
 check(AT.analog(NaN)===0&&AT.analog(2)===1,'analog clamp');
 console.log('PASS enhanced XR/AT tests; total '+checks+' assertions. Simulated runtime, not a physical headset.');
})().catch(e=>{console.error(e);process.exitCode=1;});

