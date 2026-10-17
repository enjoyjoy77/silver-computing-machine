struct View { vp:mat4x4f, model:mat4x4f, eye:vec4f, options:vec4f }
@group(0) @binding(0) var<uniform> view:View;
@group(0) @binding(1) var atlas:texture_2d<f32>;
@group(0) @binding(2) var atlasSampler:sampler;
struct In { @location(0) position:vec4f, @location(1) normal:vec4f }
struct Out { @builtin(position) clip:vec4f, @location(0) world:vec3f, @location(1) normal:vec3f, @location(2) material:f32 }
@vertex fn vertex(input:In)->Out{var o:Out;let world=view.model*vec4f(input.position.xyz,1);o.clip=view.vp*world;o.world=world.xyz;o.normal=(view.model*vec4f(input.normal.xyz,0)).xyz;o.material=input.normal.w;return o;}
@fragment fn fragment(input:Out)->@location(0) vec4f{
 let n=normalize(input.normal);let light=normalize(vec3f(-.4,1,.65));let diffuse=max(0.0,dot(n,light));
 var color=vec3f(.65,.34,.20);
 if(input.material>.5){color=vec3f(.48,.69,.65);}if(input.material>1.5){color=vec3f(.27,.25,.23);}if(input.material>2.5){color=vec3f(.66,.45,.27);}if(input.material>3.5){color=vec3f(.21,.31,.29);}
 let h=normalize(light+normalize(view.eye.xyz-input.world));let spec=pow(max(0.0,dot(n,h)),30.0)*select(.055,.12,input.material>.5);
 return vec4f(pow(color*(.52+.48*diffuse)+vec3f(spec),vec3f(1.0/2.2)),1);
}
struct TextOut { @builtin(position) clip:vec4f, @location(0) uv:vec2f }
@vertex fn textVertex(input:In)->TextOut{var o:TextOut;o.clip=view.vp*view.model*vec4f(input.position.xyz,1);o.uv=input.normal.xy;return o;}
@fragment fn textFragment(input:TextOut)->@location(0) vec4f{let c=textureSample(atlas,atlasSampler,input.uv);if(c.a<.05){discard;}return c;}
