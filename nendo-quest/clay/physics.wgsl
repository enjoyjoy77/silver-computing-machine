@group(0) @binding(0) var<uniform> par:Params;
@group(0) @binding(1) var<storage,read_write> particles:array<Particle>;
@group(0) @binding(2) var<storage,read_write> edges:array<Edge>;
@group(0) @binding(3) var<storage,read_write> parents:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read_write> grid:array<Grid>;
@group(0) @binding(5) var<storage,read_write> bins:array<atomic<u32>>;
@group(0) @binding(6) var<storage,read> hands:array<Collider>;

fn error(bit:u32){atomicOr(&bins[0],bit);}
fn join(a0:u32,b0:u32){var a=a0;var b=b0;for(var k=0u;k<256u;k++){
  a=rootOf(a);b=rootOf(b);if(a==NONE||b==NONE){error(8u);return;}if(a==b){return;}
  let hi=max(a,b);let lo=min(a,b);let result=atomicCompareExchangeWeak(&parents[hi],hi,lo);if(result.exchanged){return;}
}error(8u);}
fn linked(a:u32,b:u32)->bool{for(var j=0u;j<LINKS;j++){let e=edges[a*LINKS+j];if(e.to==b&&e.cure>=1.0&&e.damage<1.0){return true;}}return false;}

@compute @workgroup_size(128) fn clearBins(@builtin(global_invocation_id) id:vec3u){let n=u32(par.space.w);if(id.x<n*n*n){atomicStore(&bins[16u+id.x],NONE);atomicStore(&bins[16u+n*n*n+id.x],0u);}}
@compute @workgroup_size(128) fn prepare(@builtin(global_invocation_id) id:vec3u){
 let c=id.x;if(c>=u32(par.sim.w)*27u){return;}atomicStore(&parents[c],c);
 atomicStore(&grid[c].mass,0);atomicStore(&grid[c].mx,0);atomicStore(&grid[c].my,0);atomicStore(&grid[c].mz,0);
 atomicStore(&grid[c].gx,0);atomicStore(&grid[c].gy,0);atomicStore(&grid[c].gz,0);atomicStore(&grid[c].pad,0);grid[c].velocity=vec4f(0);grid[c].contact=vec4f(0);
}
@compute @workgroup_size(64) fn binParticles(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u32(par.sim.w)){return;}
 let c=vec3i(floor((particles[i].x.xyz-par.space.xyz)*par.sim.z));
 if(!inside(c)||any(c<vec3i(2))||any(c>=vec3i(i32(par.space.w)-2))){error(2u);atomicStore(&bins[nextIndex(i)],NONE);return;}
 atomicStore(&bins[nextIndex(i)],atomicExchange(&bins[16u+cell(c)],i));
}
// Each particle has 27 transfer slots. Union ONLY along intact material links
// inside that node's support. Separate surfaces of the SAME body remain separate.
@compute @workgroup_size(64) fn validateLinks(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u32(par.sim.w)){return;}for(var j=0u;j<LINKS;j++){let e=edges[i*LINKS+j];var valid=false;if(e.to!=NONE&&e.to>i&&e.cure>=1.0&&e.damage<1.0){valid=linked(e.to,i);}atomicStore(&bins[linkIndex(i,j)],select(0u,1u,valid));}}
@compute @workgroup_size(64) fn connect(@builtin(global_invocation_id) id:vec3u){let entry=id.x;let i=entry/27u;if(i>=u32(par.sim.w)){return;}
 let node=baseOf(particles[i].x.xyz)+offsetOf(entry%27u);
 for(var j=0u;j<LINKS;j++){if(atomicLoad(&bins[linkIndex(i,j)])==0u){continue;}let other=cornerAt(edges[i*LINKS+j].to,node);if(other!=NONE){join(entry,other);}}
}
@compute @workgroup_size(128) fn compress(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u32(par.sim.w)*27u){return;}let root=rootOf(i);if(root==NONE){error(8u);return;}atomicStore(&parents[i],root);}

struct Eigen { values:vec3f, vectors:mat3x3f }
fn symmetricEigen(input:mat3x3f)->Eigen {
 var a=input;var v=unitMatrix();
 for(var sweep=0u;sweep<5u;sweep++){for(var pair=0u;pair<3u;pair++){
  let p=select(0u,1u,pair==2u);let q=select(1u,2u,pair!=0u);let apq=a[q][p];
  if(abs(apq)<1e-8){continue;}
  let tau=(a[q][q]-a[p][p])/(2.0*apq);let t=select(-1.0,1.0,tau>=0.0)/(abs(tau)+sqrt(1.0+tau*tau));
  let c=inverseSqrt(1.0+t*t);let s=t*c;var r=unitMatrix();r[p][p]=c;r[q][q]=c;r[q][p]=s;r[p][q]=-s;
  a=transpose(r)*a*r;v=v*r;
 }}return Eigen(vec3f(a[0][0],a[1][1],a[2][2]),v);
}
@compute @workgroup_size(64) fn constitutive(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let i=id.x;if(i>=u32(par.sim.w)){return;}
 var p=particles[i];var f=mat3x3f(p.f0.xyz,p.f1.xyz,p.f2.xyz);let det=determinant(f);
 if(!(det>.08&&det<8.0)){error(1u);return;}
 let eig=symmetricEigen(transpose(f)*f);if(any(eig.values<vec3f(1e-6))){error(256u);return;}
 let sigma=sqrt(eig.values);let u=f*eig.vectors*diag(1.0/sigma);
 let logS=log(sigma);let mean=(logS.x+logS.y+logS.z)/3.0;let dev=logS-vec3f(mean);let norm=length(dev);
 let g=par.material.y;let yieldStress=par.material.z;let q=sqrt(6.0)*g*norm;
 let dg=max(0.0,(q-yieldStress)/(3.0*g+12.0/par.sim.x));
 let devNew=dev*max(0.0,1.0-sqrt(1.5)*dg/max(norm,1e-8));
 let projected=vec3f(mean)+devNew;f=u*diag(exp(projected))*transpose(eig.vectors);
 let tau=u*diag(2.0*g*devNew+vec3f(3.0*par.material.x*mean))*transpose(u);
 var c=mat3x3f(p.c0.xyz,p.c1.xyz,p.c2.xyz);
 let viscous=(c+transpose(c)-diag(vec3f(2.0*(c[0][0]+c[1][1]+c[2][2])/3.0)))*.8;
 let affine=c-(tau+viscous)*(par.sim.x*4.0*par.sim.z*par.sim.z/par.material.w);
 p.f0=vec4f(f[0],0);p.f1=vec4f(f[1],0);p.f2=vec4f(f[2],0);
 p.c0=vec4f(affine[0],0);p.c1=vec4f(affine[1],0);p.c2=vec4f(affine[2],0);p.v.w+=dg;p.state.w=dg;
 particles[i]=p;
}
fn checkedAdd(address:ptr<storage,atomic<i32>,read_write>,value:f32){
 if(!(abs(value)<256.0)){error(4u);return;}
 let quant=i32(round(value*SCALE));let old=atomicAdd(address,quant);
 if(abs(old)>1500000000){error(4u);}
}
@compute @workgroup_size(64) fn p2g(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let i=id.x;if(i>=u32(par.sim.w)){return;}
 let p=particles[i];let base=baseOf(p.x.xyz);let f=(p.x.xyz-par.space.xyz)*par.sim.z-vec3f(base);let w=weights(f);
 let affine=mat3x3f(p.c0.xyz,p.c1.xyz,p.c2.xyz);
 for(var k=0u;k<27u;k++){let o=offsetOf(k);let r=atomicLoad(&parents[i*27u+k]);let weight=weightAt(w,o);
  let d=(vec3f(o)-f)*par.sim.y;let momentum=weight*(p.v.xyz+affine*d);let center=-weight*d*par.sim.z;
  checkedAdd(&grid[r].mass,weight);checkedAdd(&grid[r].mx,momentum.x);checkedAdd(&grid[r].my,momentum.y);checkedAdd(&grid[r].mz,momentum.z);
  checkedAdd(&grid[r].gx,center.x);checkedAdd(&grid[r].gy,center.y);checkedAdd(&grid[r].gz,center.z);
 }
}
fn mass(r:u32)->f32{return f32(atomicLoad(&grid[r].mass))/SCALE;}
fn center(r:u32)->vec3f{return vec3f(f32(atomicLoad(&grid[r].gx)),f32(atomicLoad(&grid[r].gy)),f32(atomicLoad(&grid[r].gz)))/(SCALE*max(mass(r),1e-8));}
fn contactHand(x:vec3f,v0:vec3f,side:u32)->vec3f{
 var distance=1e6;var normal=vec3f(0,1,0);var hv=vec3f(0);
 for(var j=2u;j<u32(par.control.z);j++) {let h=hands[j];if(u32(h.flags.y)!=side||h.flags.z<.5){continue;}
  let a=mix(h.oldA.xyz,h.a.xyz,par.step.x);let b=mix(h.oldB.xyz,h.b.xyz,par.step.x);let ab=b-a;
  let t=clamp(dot(x-a,ab)/max(dot(ab,ab),1e-10),0.0,1.0);let d=x-mix(a,b,t);let dist=length(d)-h.a.w;
  if(dist<distance){distance=dist;normal=safeNormal(d);hv=mix(h.a.xyz-h.oldA.xyz,h.b.xyz-h.oldB.xyz,t)/max(par.step.y,.001);}
 }
 if(distance>=0.0){return v0;}
 let relative=v0-hv;let vn=dot(relative,normal);let needed=max(0.0,-vn+min(.12,-distance*35.0));
 let tangent=relative-vn*normal;let friction=min(length(tangent),.65*needed);
 return v0+needed*normal-safeNormal(tangent)*friction;
}
@compute @workgroup_size(128) fn gridVelocity(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let r=id.x;if(r>=u32(par.sim.w)*27u||atomicLoad(&parents[r])!=r){return;}
 let m=mass(r);if(m<1e-6){return;}
 var v=vec3f(f32(atomicLoad(&grid[r].mx)),f32(atomicLoad(&grid[r].my)),f32(atomicLoad(&grid[r].mz)))/(SCALE*m);
 let n=baseOf(particles[r/27u].x.xyz)+offsetOf(r%27u);let x=par.space.xyz+vec3f(n)*par.sim.y;
 v.y-=par.control.y*par.sim.x;v*=exp(-par.step.w*par.sim.x);
 v=contactHand(x,v,0u);v=contactHand(x,v,1u);
 if(par.control.w>.5&&x.y<par.control.x+.002){let imp=max(0.0,-v.y);v.y=max(v.y,0.0);let t=vec2f(v.x,v.z);let speed=length(t);let k=max(0.0,1.0-.7*imp/max(speed,1e-8));v.x*=k;v.z*=k;}
 grid[r].velocity=vec4f(v,0);if(m>1e-5&&inside(n)){atomicAdd(&bins[fieldCountIndex(n)],1u);}
}
// Resolve unilateral contact between local fields, even before a global tear completes.
@compute @workgroup_size(64) fn fieldContact(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let r=id.x;if(r>=u32(par.sim.w)*27u||atomicLoad(&parents[r])!=r||mass(r)<1e-5){return;}
 let n=baseOf(particles[r/27u].x.xyz)+offsetOf(r%27u);let v=grid[r].velocity.xyz;
 if(inside(n)&&atomicLoad(&bins[fieldCountIndex(n)])<=1u){grid[r].contact=vec4f(v,0);return;}
 var dv=vec3f(0);var pressure=0.0;var seen:array<u32,16>;var seenCount=0u;
 for(var z=-1;z<=1;z++){for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){
  let c=n+vec3i(x,y,z);if(!inside(c)){continue;}var p=atomicLoad(&bins[16u+cell(c)]);
  loop{if(p==NONE){break;}let slot=cornerAt(p,n);if(slot!=NONE){let other=atomicLoad(&parents[slot]);
   if(other!=r&&mass(other)>1e-5){var found=false;for(var k=0u;k<seenCount;k++){if(seen[k]==other){found=true;}}
    if(!found){if(seenCount>=16u){error(16u);}else{seen[seenCount]=other;seenCount++;
     let normal=safeNormal(center(r)-center(other));let relative=v-grid[other].velocity.xyz;let closing=max(0.0,-dot(relative,normal));
     let ratio=mass(other)/(mass(r)+mass(other));dv+=normal*closing*ratio;pressure=max(pressure,closing);
    }}
   }}p=atomicLoad(&bins[nextIndex(p)]);
  }
 }}}
 grid[r].contact=vec4f(v+dv,pressure);
}
@compute @workgroup_size(64) fn g2p(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let i=id.x;if(i>=u32(par.sim.w)){return;}
 var p=particles[i];let base=baseOf(p.x.xyz);let f=(p.x.xyz-par.space.xyz)*par.sim.z-vec3f(base);let w=weights(f);
 var v=vec3f(0);var c=mat3x3f(vec3f(0),vec3f(0),vec3f(0));var pressure=0.0;
 for(var k=0u;k<27u;k++){let o=offsetOf(k);let r=atomicLoad(&parents[i*27u+k]);let weight=weightAt(w,o);let gv=grid[r].contact.xyz;
  v+=weight*gv;c+=outer(gv,(vec3f(o)-f)*par.sim.y)*(weight*4.0*par.sim.z*par.sim.z);pressure+=weight*grid[r].contact.w;
 }
 if(!(all(abs(v)<vec3f(4.0)))){error(32u);return;}
 let deformation=(unitMatrix()+par.sim.x*c)*mat3x3f(p.f0.xyz,p.f1.xyz,p.f2.xyz);
 p.v=vec4f(v,p.v.w);p.c0=vec4f(c[0],0);p.c1=vec4f(c[1],0);p.c2=vec4f(c[2],0);
 p.f0=vec4f(deformation[0],0);p.f1=vec4f(deformation[1],0);p.f2=vec4f(deformation[2],0);p.state.z=pressure;particles[i]=p;
}
// Local, mass-weighted F-bar projection of the trial Jacobian. This preserves
// its weighted sum; it does not inflate the whole object back to a target size.
// Projection is isolated per transfer field, so it never crosses a crack.
@compute @workgroup_size(64) fn scatterJacobian(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let i=id.x;if(i>=u32(par.sim.w)){return;}let p=particles[i];let determinantTrial=determinant(mat3x3f(p.f0.xyz,p.f1.xyz,p.f2.xyz));
 if(!(determinantTrial>1e-5&&determinantTrial<10.0)){error(1u);return;}
 let f=(p.x.xyz-par.space.xyz)*par.sim.z-vec3f(baseOf(p.x.xyz));let w=weights(f);
 for(var k=0u;k<27u;k++){let r=atomicLoad(&parents[i*27u+k]);checkedAdd(&grid[r].pad,determinantTrial*weightAt(w,offsetOf(k)));}
}
@compute @workgroup_size(64) fn projectVolume(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let i=id.x;if(i>=u32(par.sim.w)){return;}var p=particles[i];
 let f=(p.x.xyz-par.space.xyz)*par.sim.z-vec3f(baseOf(p.x.xyz));let w=weights(f);var average=0.0;
 for(var k=0u;k<27u;k++){let r=atomicLoad(&parents[i*27u+k]);average+=weightAt(w,offsetOf(k))*f32(atomicLoad(&grid[r].pad))/(SCALE*max(mass(r),1e-8));}
 let old=determinant(mat3x3f(p.f0.xyz,p.f1.xyz,p.f2.xyz));if(!(old>1e-5&&average>1e-5)){error(1u);return;}let scaling=pow(average/old,1.0/3.0);p.f0*=scaling;p.f1*=scaling;p.f2*=scaling;
 p.x=vec4f(p.x.xyz+par.sim.x*p.v.xyz,1);if(par.control.w>.5&&p.x.y<par.control.x+par.step.z*.45){p.x.y=par.control.x+par.step.z*.45;p.v.y=max(p.v.y,0.0);}particles[i]=p;
}
@compute @workgroup_size(64) fn topology(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let i=id.x;if(i>=u32(par.sim.w)){return;}
 let p=particles[i];
 for(var j=0u;j<LINKS;j++){let index=i*LINKS+j;var e=edges[index];if(e.to==NONE){continue;}let other=particles[e.to];let distanceNow=distance(p.x.xyz,other.x.xyz);
  if(e.cure>=1.0){let strain=log(max(distanceNow,1e-6)/max(e.rest,1e-6));
   if(strain>.20&&(max(p.state.w,other.state.w)>0.0||e.damage>0.0)){e.damage+=par.sim.x*18.0*(strain-.20);}
   if(strain>.03&&max(p.state.w,other.state.w)>0.0){e.rest*=exp(min(strain,par.sim.x*.6));}
   if(e.damage>=1.0){e.to=NONE;e.cure=0.0;atomicAdd(&bins[1],1u);}
  }else{
   let pressure=min(p.state.z,other.state.z);let close=distanceNow<par.step.z*1.16;
   if(close&&pressure>.006){e.cure=min(1.0,e.cure+par.sim.x/0.16);}else{e.cure=max(0.0,e.cure-par.sim.x/.10);}
   if(e.cure>=1.0){e.rest=distanceNow;e.damage=0.0;atomicAdd(&bins[2],1u);}
   if(e.cure==0.0){e.to=NONE;}
  }edges[index]=e;
 }
}
@compute @workgroup_size(64) fn placementBounds(@builtin(global_invocation_id) id:vec3u){if(id.x>=u32(par.sim.w)){return;}atomicMin(&bins[4],u32(max(0.0,particles[id.x].x.y+1.0)*1000000.0));}
@compute @workgroup_size(64) fn placeOnTable(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u32(par.sim.w)){return;}var p=particles[i];if(par.control.w>.5){let bottom=f32(atomicLoad(&bins[4]))/1000000.0-1.0;p.x.y+=par.control.x+par.step.z*.5-bottom;}
 p.v=vec4f(0,0,0,p.v.w);p.c0=vec4f(0);p.c1=vec4f(0);p.c2=vec4f(0);p.state.y=-1.0;particles[i]=p;}
// Candidate creation has its own pass: no concurrent reading and writing of links.
@compute @workgroup_size(64) fn weldCandidates(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let i=id.x;if(i>=u32(par.sim.w)||particles[i].state.z<.006){return;}
 let p=particles[i];let cellPos=vec3i(floor((p.x.xyz-par.space.xyz)*par.sim.z));var free=NONE;
 for(var z=-1;z<=1;z++){for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){
  let c=cellPos+vec3i(x,y,z);if(!inside(c)){continue;}var other=atomicLoad(&bins[16u+cell(c)]);
  loop{if(other==NONE){break;}if(other!=i&&particles[other].state.z>.006&&distance(p.x.xyz,particles[other].x.xyz)<par.step.z*1.12&&dot(p.v.xyz-particles[other].v.xyz,safeNormal(p.x.xyz-particles[other].x.xyz))<-.001){
   var exists=false;free=NONE;for(var k=0u;k<LINKS;k++){let e=edges[i*LINKS+k];if(e.to==other){exists=true;}if(e.to==NONE){free=k;}}
   if(!exists){if(free==NONE){atomicAdd(&bins[3],1u);}else{edges[i*LINKS+free]=Edge(other,distance(p.x.xyz,particles[other].x.xyz),0.0,.01);}}
  }other=atomicLoad(&bins[nextIndex(other)]);}
 }}}
}

@compute @workgroup_size(64) fn graspForces(@builtin(global_invocation_id) id:vec3u){if(atomicLoad(&bins[0])!=0u){return;}let i=id.x;if(i>=u32(par.sim.w)){return;}var p=particles[i];var v=p.v.xyz;
 // A pinch may capture only material at its actual contact, never a distant body.
 if(p.state.y>=0.0){let hand=hands[u32(p.state.y)];if(hand.flags.z<.5||hand.flags.w<.5){p.state.y=-1.0;}}
 if(p.state.y<0.0){for(var j=0u;j<2u;j++){let h=hands[j];let centerNow=mix(h.oldA.xyz,h.a.xyz,par.step.x);
  if(h.flags.z>.5&&h.flags.w>.5&&distance(p.x.xyz,centerNow)<h.a.w){p.state.y=f32(j);p.anchor=vec4f(p.x.xyz-centerNow,0);break;}
 }}
 if(p.state.y>=0.0){let hand=hands[u32(p.state.y)];let goalPosition=mix(hand.oldA.xyz,hand.a.xyz,par.step.x)+p.anchor.xyz;let delta=goalPosition-p.x.xyz;
  if(length(delta)>.024){p.state.y=-1.0;}else{let hv=(hand.a.xyz-hand.oldA.xyz)/max(par.step.y,.001);v+=clamp((delta*8000.0+(hv-v)*120.0)*par.sim.x,vec3f(-.12),vec3f(.12));}
 }
 p.v=vec4f(v,p.v.w);particles[i]=p;}
