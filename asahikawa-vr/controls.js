/* Generic AT interaction policy. No measured vehicle physics or force feedback. */
(function(root){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function analog(input){const n=Number(input);return Number.isFinite(n)?clamp(n,0,1):0;}
 const ratio=14,maxWheel=.4886921906*ratio,center={x:-.38,y:1.00,z:.65};
 function initialize(s){if(!Number.isFinite(s.wheelAngle))s.wheelAngle=0;if(!Number.isFinite(s.wipers))s.wipers=0;}
 function pedalInput(throttle,brake,wheelAngle){
  const keys=new Set();keys.throttle=analog(throttle);keys.brake=analog(brake);
  keys.steerAngle=clamp(Number.isFinite(wheelAngle)?wheelAngle:0,-maxWheel,maxWheel)/ratio;
  if(keys.brake>.05)keys.add('s');return keys;
 }
 function action(s,name,input,vehicleAction){
  initialize(s);
  if(name==='resume'){
   if(input.throttle>.02||input.brake<.2)return 'アクセルを離し、ブレーキを保持して操作開始';
   if(s.blocked)return '道路の開始点へ戻してください';
   s.running=true;return '操作開始。ベルト → ブレーキ保持で始動 → D/R → サイド解除';
  }
  if(!s.running)return '安全停止中。ブレーキ保持で「操作開始」を押してください';
  if(name==='wipers'){s.wipers=(s.wipers+1)%3;return '';}
  return vehicleAction(s,name,input);
 }
 function handAngle(p){return Math.atan2(p.y-center.y,p.x-center.x);}
 function nearWheel(p){const r=Math.hypot(p.x-center.x,p.y-center.y);return Math.abs(p.z-center.z)<.14&&r>.10&&r<.28;}
 function wheelDelta(previous,next){return -Math.atan2(Math.sin(next-previous),Math.cos(next-previous));}
 function advanceWheel(angle,previous,next){return clamp(angle+wheelDelta(previous,next),-maxWheel,maxWheel);}
 const gearZ={P:.52,R:.44,N:.36,D:.28};
 function gearAt(z){return Object.keys(gearZ).reduce((a,b)=>Math.abs(z-gearZ[a])<Math.abs(z-gearZ[b])?a:b);}
 root.AsahikawaAT={ratio,maxWheel,center,analog,initialize,pedalInput,action,handAngle,nearWheel,advanceWheel,gearZ,gearAt};
})(globalThis);

