@group(0) @binding(0) var<uniform> par:Params;
@group(0) @binding(1) var<storage,read_write> particles:array<Particle>;
@group(0) @binding(2) var<storage,read_write> parents:array<atomic<u32>>;
@group(0) @binding(3) var<storage,read_write> bins:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read_write> keys:array<atomic<u32>>;
@group(0) @binding(5) var<storage,read_write> values:array<vec4f>;
struct Vertex { position:vec4f, normal:vec4f }
@group(0) @binding(6) var<storage,read_write> vertices:array<Vertex>;
@group(0) @binding(7) var<storage,read_write> draw:array<atomic<u32>>;
const HASH:u32=65536u;
fn keyOf(c:vec3i)->u32{return u32(c.x)+128u*(u32(c.y)+128u*u32(c.z));}
fn coord(k:u32)->vec3i{return vec3i(vec3u(k%128u,(k/128u)%128u,k/16384u));}
fn hash(k:u32)->u32{var v=k;v=(v^(v>>16u))*0x7feb352du;v=(v^(v>>15u))*0x846ca68bu;return (v^(v>>16u))&(HASH-1u);}
fn lookup(key:u32)->u32{let h=hash(key);for(var j=0u;j<64u;j++){let slot=(h+j)&(HASH-1u);let value=atomicLoad(&keys[slot]);if(value==key){return slot;}if(value==NONE){return NONE;}}return NONE;}
fn insert(key:u32){let h=hash(key);for(var j=0u;j<64u;j++){let slot=(h+j)&(HASH-1u);let value=atomicLoad(&keys[slot]);if(value==key){return;}if(value==NONE){var resolved=false;for(var attempt=0u;attempt<8u;attempt++){let r=atomicCompareExchangeWeak(&keys[slot],NONE,key);if(r.exchanged||r.old_value==key){return;}if(r.old_value!=NONE){resolved=true;break;}}if(!resolved){atomicOr(&bins[0],128u);return;}}}atomicOr(&bins[0],128u);}
@compute @workgroup_size(128) fn clearSurface(@builtin(global_invocation_id) id:vec3u){if(id.x<HASH){atomicStore(&keys[id.x],NONE);values[id.x]=vec4f(0);}if(id.x<8u){atomicStore(&draw[id.x],select(0u,1u,id.x==1u));}}
@compute @workgroup_size(64) fn markSurface(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u32(par.sim.w)){return;}let c=vec3i(floor((particles[i].x.xyz-par.space.xyz)*(2.0*par.sim.z)));
 for(var z=-2;z<=3;z++){for(var y=-2;y<=3;y++){for(var x=-2;x<=3;x++){let q=c+vec3i(x,y,z);if(all(q>=vec3i(0))&&all(q<vec3i(128))){insert(keyOf(q));}}}}
}
@compute @workgroup_size(64) fn sampleSurface(@builtin(global_invocation_id) id:vec3u){let slot=id.x;if(slot>=HASH){return;}let key=atomicLoad(&keys[slot]);if(key==NONE){return;}
 let q=coord(key);let position=par.space.xyz+vec3f(q)*(.5*par.sim.y);let n=vec3i(round(vec3f(q)*.5));let cellPos=vec3i(floor(vec3f(q)*.5));let radius=par.step.z*1.95;
 var nearest=NONE;var minD=radius*radius;
 for(var z=-1;z<=1;z++){for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){
  let c=cellPos+vec3i(x,y,z);if(!inside(c)){continue;}var i=atomicLoad(&bins[16u+cell(c)]);
  loop{if(i==NONE){break;}let delta=particles[i].x.xyz-position;let d=dot(delta,delta);if(d<minD){let corner=cornerAt(i,n);if(corner!=NONE){minD=d;nearest=atomicLoad(&parents[corner]);}}i=atomicLoad(&bins[nextIndex(i)]);}
 }}}
 if(nearest==NONE){return;}
 var density=0.0;var normal=vec3f(0);
 for(var z=-1;z<=1;z++){for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){
  let c=cellPos+vec3i(x,y,z);if(!inside(c)){continue;}var i=atomicLoad(&bins[16u+cell(c)]);
  loop{if(i==NONE){break;}let corner=cornerAt(i,n);if(corner!=NONE&&atomicLoad(&parents[corner])==nearest){
   let delta=position-particles[i].x.xyz;let t=max(0.0,1.0-dot(delta,delta)/(radius*radius));density+=t*t*t;normal+=delta*(6.0*t*t/(radius*radius));
  }i=atomicLoad(&bins[nextIndex(i)]);}
 }}}
 values[slot]=vec4f(normal,density);
}
fn sampleAt(c:vec3i)->vec4f{if(any(c<vec3i(0))||any(c>=vec3i(128))){return vec4f(0);}let index=lookup(keyOf(c));if(index==NONE){return vec4f(0);}return values[index];}
fn crossing(a:vec3f,b:vec3f,va:vec4f,vb:vec4f)->Vertex{let t=clamp((1.95-va.w)/(vb.w-va.w),0.0,1.0);return Vertex(vec4f(mix(a,b,t),0),vec4f(safeNormal(mix(va.xyz,vb.xyz,t)),0));}
fn triangle(a:Vertex,b:Vertex,c:Vertex){let count=atomicAdd(&draw[0],3u);if(count+3u>arrayLength(&vertices)){atomicOr(&bins[0],64u);return;}
 let normal=a.normal.xyz+b.normal.xyz+c.normal.xyz;let face=cross(b.position.xyz-a.position.xyz,c.position.xyz-a.position.xyz);
 vertices[count]=a;if(dot(normal,face)>=0.0){vertices[count+1u]=b;vertices[count+2u]=c;}else{vertices[count+1u]=c;vertices[count+2u]=b;}
}
@compute @workgroup_size(64) fn extractSurface(@builtin(global_invocation_id) id:vec3u){let slot=id.x;if(slot>=HASH){return;}let key=atomicLoad(&keys[slot]);if(key==NONE){return;}let c=coord(key);if(any(c>=vec3i(127))){return;}
 var p:array<vec3f,8>;var f:array<vec4f,8>;var low=1000.0;var high=0.0;
 for(var k=0u;k<8u;k++){let q=c+vec3i(vec3u(k&1u,(k>>1u)&1u,(k>>2u)&1u));p[k]=par.space.xyz+vec3f(q)*(.5*par.sim.y);f[k]=sampleAt(q);low=min(low,f[k].w);high=max(high,f[k].w);}
 if(low>=1.95||high<1.95){return;}
 let tets=array<vec4u,6>(vec4u(0,1,3,7),vec4u(0,3,2,7),vec4u(0,2,6,7),vec4u(0,6,4,7),vec4u(0,4,5,7),vec4u(0,5,1,7));
 for(var t=0u;t<6u;t++){var ins:array<u32,4>;var outs:array<u32,4>;var ni=0u;var no=0u;
  for(var j=0u;j<4u;j++){let k=tets[t][j];if(f[k].w>=1.95){ins[ni]=k;ni++;}else{outs[no]=k;no++;}}
  if(ni==0u||ni==4u){continue;}
  if(ni==1u){triangle(crossing(p[ins[0]],p[outs[0]],f[ins[0]],f[outs[0]]),crossing(p[ins[0]],p[outs[1]],f[ins[0]],f[outs[1]]),crossing(p[ins[0]],p[outs[2]],f[ins[0]],f[outs[2]]));}
  else if(ni==3u){triangle(crossing(p[outs[0]],p[ins[0]],f[outs[0]],f[ins[0]]),crossing(p[outs[0]],p[ins[1]],f[outs[0]],f[ins[1]]),crossing(p[outs[0]],p[ins[2]],f[outs[0]],f[ins[2]]));}
  else{let a=crossing(p[ins[0]],p[outs[0]],f[ins[0]],f[outs[0]]);let b=crossing(p[ins[0]],p[outs[1]],f[ins[0]],f[outs[1]]);let d=crossing(p[ins[1]],p[outs[0]],f[ins[1]],f[outs[0]]);let e=crossing(p[ins[1]],p[outs[1]],f[ins[1]],f[outs[1]]);triangle(a,b,d);triangle(b,e,d);}
 }
}
@compute @workgroup_size(1) fn finishSurface(){atomicStore(&draw[0],min(atomicLoad(&draw[0]),arrayLength(&vertices)));}
