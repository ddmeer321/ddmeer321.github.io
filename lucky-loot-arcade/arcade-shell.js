const arcadeStyle=document.createElement('link');arcadeStyle.rel='stylesheet';arcadeStyle.href='arcade.css';document.head.append(arcadeStyle);
const panel=document.getElementById('arcade-panel');
function showPanel(){document.body.classList.add('menu-open');panel.hidden=false;panel.classList.remove('pop');void panel.offsetWidth;panel.classList.add('pop');document.getElementById('panel-name').textContent=({crates:'KISTEN',inventory:'DEINE GEGENSTÄNDE',bank:'SCHATZBANK',upgrade:'AUFWERTER',collection:'SAMMELALBUM'})[page];}
document.addEventListener('click',e=>{if(e.target.closest('[data-page]'))showPanel();});
document.getElementById('panel-close').onclick=()=>{panel.hidden=true;document.body.classList.remove('menu-open');document.getElementById('hub-open').focus();};
document.getElementById('hub-open').onclick=()=>{page='crates';render();showPanel();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('reveal').open){panel.hidden=true;document.body.classList.remove('menu-open');}});
showPanel();
