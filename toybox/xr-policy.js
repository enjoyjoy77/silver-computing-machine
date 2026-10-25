export const MAX_TOYS=16;
export const MAX_TRIANGLES=2200000;
export function stickY(gamepad){
 if(gamepad?.mapping!=='xr-standard'||gamepad.axes.length<4)return 0;
 const y=gamepad.axes[3];return Number.isFinite(y)&&Math.abs(y)>.18?Math.sign(y)*(Math.abs(y)-.18)/.82:0;
}
export function nextDepth(depth,axis,dt){return Math.max(.25,Math.min(6,depth-axis*1.5*Math.min(.05,Math.max(0,dt))))}
export function canAdd(count,triangles,extra=0){return count<MAX_TOYS&&triangles+extra<=MAX_TRIANGLES}
export function touchIntent(previous,now){return previous!==null&&previous>.014&&now<=.014&&now>=-.012}
