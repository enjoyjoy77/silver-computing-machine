// Discrete keydown steps (including OS repeat), never a persistent held-key loop.
export function keyboardCommand(e, context) {
  if (!context.focused || context.xr || context.hidden || context.dragging || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return null;
  const key=e.key.toLowerCase(), fine=e.shiftKey?.25:1;
  const single={c:'camera',m:'model',escape:'exit',home:'home',h:'help','[':'previous',']':'next','1':'category','2':'category','3':'category','4':'category'};
  if(single[key])return e.repeat?null:{action:single[key],value:Number(key)-1,fine};
  if(['w','a','s','d','q','e'].includes(key))return {action:'translate',key,fine};
  if(['arrowleft','arrowright','arrowup','arrowdown','z','x'].includes(key))return {action:'rotate',key,fine};
  if(['+','=','-','_'].includes(key))return {action:'scale',direction:['+','='].includes(key)?1:-1,fine};
  return null;
}
