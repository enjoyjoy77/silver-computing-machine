const NONE:u32=0xffffffffu;
const LINKS:u32=32u;
const SCALE:f32=1048576.0;
struct Params { sim:vec4f, material:vec4f, space:vec4f, control:vec4f, step:vec4f, spare:array<vec4f,11> }
struct Particle { x:vec4f, v:vec4f, f0:vec4f, f1:vec4f, f2:vec4f, c0:vec4f, c1:vec4f, c2:vec4f, state:vec4f, anchor:vec4f }
struct Edge { to:u32, rest:f32, damage:f32, cure:f32 }
struct Grid { mass:atomic<i32>, mx:atomic<i32>, my:atomic<i32>, mz:atomic<i32>, gx:atomic<i32>, gy:atomic<i32>, gz:atomic<i32>, pad:atomic<i32>, velocity:vec4f, contact:vec4f }
struct Collider { a:vec4f, b:vec4f, oldA:vec4f, oldB:vec4f, flags:vec4f }
fn baseOf(x:vec3f)->vec3i { return vec3i(floor((x-par.space.xyz)*par.sim.z-vec3f(.5))); }
fn offsetOf(i:u32)->vec3i { return vec3i(vec3u(i%3u,(i/3u)%3u,i/9u)); }
fn inside(c:vec3i)->bool { return all(c>=vec3i(0))&&all(c<vec3i(i32(par.space.w))); }
fn cell(c:vec3i)->u32 { let n=u32(par.space.w); return u32(c.x)+n*(u32(c.y)+n*u32(c.z)); }
fn nextIndex(i:u32)->u32 { let n=u32(par.space.w);return 16u+2u*n*n*n+i; }
fn fieldCountIndex(c:vec3i)->u32 {let n=u32(par.space.w);return 16u+n*n*n+cell(c);}
fn linkIndex(i:u32,j:u32)->u32 {return nextIndex(u32(par.sim.w))+i*LINKS+j;}
fn cornerAt(i:u32,n:vec3i)->u32 { let d=n-baseOf(particles[i].x.xyz);if(any(d<vec3i(0))||any(d>vec3i(2))){return NONE;}return i*27u+u32(d.x+3*d.y+9*d.z); }
fn rootOf(i:u32)->u32 { var a=i;for(var k=0u;k<128u;k++){let b=atomicLoad(&parents[a]);if(a==b){return a;}let grandparent=atomicLoad(&parents[b]);atomicMin(&parents[a],grandparent);a=grandparent;}return NONE; }
fn weights(f:vec3f)->mat3x3f { return mat3x3f(.5*(vec3f(1.5)-f)*(vec3f(1.5)-f),vec3f(.75)-(f-vec3f(1))*(f-vec3f(1)),.5*(f-vec3f(.5))*(f-vec3f(.5))); }
fn weightAt(w:mat3x3f,o:vec3i)->f32 { return w[u32(o.x)].x*w[u32(o.y)].y*w[u32(o.z)].z; }
fn safeNormal(v:vec3f)->vec3f { return v*inverseSqrt(max(dot(v,v),1e-14)); }
fn outer(a:vec3f,b:vec3f)->mat3x3f {return mat3x3f(a*b.x,a*b.y,a*b.z);}
fn diag(a:vec3f)->mat3x3f {return mat3x3f(vec3f(a.x,0,0),vec3f(0,a.y,0),vec3f(0,0,a.z));}
fn unitMatrix()->mat3x3f{return diag(vec3f(1));}
