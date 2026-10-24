export function setupPanels(){
 const $=id=>document.getElementById(id),ids=['catalogPanel','cameraPanel','modelPanel'];
 const toggle=id=>document.querySelector(`[data-panel="${id}"]`);
 function sync(){const any=ids.some(id=>!$(id).hidden);$('allPanels').textContent=any?'全部畳む':'操作を開く';$('allPanels').setAttribute('aria-expanded',String(any));for(const id of ids)toggle(id).setAttribute('aria-expanded',String(!$(id).hidden));}
 function set(id,open){const p=$(id);if(!open&&p.contains(document.activeElement))toggle(id).focus();p.hidden=!open;sync();}
 $('allPanels').onclick=()=>{const open=ids.every(id=>$(id).hidden);for(const id of ids)set(id,open);$('allPanels').focus();};
 for(const id of ids)toggle(id).onclick=()=>set(id,$(id).hidden);
 for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>{set(b.dataset.close,false);toggle(b.dataset.close).focus();};
 function feedback(){$('compactFeedback').textContent=($('selection').textContent||'模型を選択')+' · '+$('keyboardMode').textContent.replace('キーボード：','');}
 const observer=new MutationObserver(feedback);for(const id of ['selection','keyboardMode'])observer.observe($(id),{childList:true,characterData:true,subtree:true});feedback();sync();
 document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||e.isComposing)return;const id=ids.find(id=>$(id).contains(document.activeElement));if(id){e.preventDefault();set(id,false);toggle(id).focus();}});
 return {help(){const help=$('keyboardHelp');if($('cameraPanel').hidden){set('cameraPanel',true);help.open=true;}else help.open=!help.open;}};
}
