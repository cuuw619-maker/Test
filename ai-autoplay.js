(()=>{"use strict";
const $=s=>document.querySelector(s);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const MINES_LEFT=15;
const games=["tictactoe","snake","2048","memory","reaction","mines","pong","shooter"];
const labels={tictactoe:"Крестики-нолики",snake:"Змейка", "2048":"2048",memory:"Найди пары",reaction:"Тест реакции",mines:"Сапёр",pong:"Понг",shooter:"Космический шутер"};
let running=false,activeGame=null,timer=0,stepDelay=420,loopToken=0;
function panel(id){const page=$("#page-"+id);if(!page||page.querySelector(".autoplay-panel"))return;
 const el=document.createElement("div");el.className="panel autoplay-panel";el.innerHTML='<div class="autoplay-copy"><span class="autoplay-kicker">MULTITOOL / AUTOPILOT</span><b>Автоматическое прохождение ИИ</b><small>ИИ самостоятельно играет в эту игру. Можно остановить в любой момент.</small></div><div class="autoplay-controls"><label>Скорость <select class="autoplay-speed"><option value="900">Медленно</option><option value="420" selected>Обычно</option><option value="170">Быстро</option></select></label><button class="primary-button autoplay-start">Запустить ИИ</button><button class="subtle-button autoplay-stop" disabled>Стоп</button></div><div class="autoplay-status" aria-live="polite">ИИ готов к запуску</div>';
 const heading=page.querySelector(".page-heading");if(heading)heading.after(el);else page.prepend(el);
 el.querySelector(".autoplay-speed").addEventListener("change",e=>{stepDelay=Number(e.target.value)||420});
 el.querySelector(".autoplay-start").addEventListener("click",()=>start(id));
 el.querySelector(".autoplay-stop").addEventListener("click",stop);
}
function status(id,msg){const node=$("#page-"+id+" .autoplay-status");if(node)node.textContent=msg}
function setControls(id,on){const root=$("#page-"+id+" .autoplay-panel");if(!root)return;root.querySelector(".autoplay-start").disabled=on;root.querySelector(".autoplay-stop").disabled=!on;root.querySelector(".autoplay-speed").disabled=on}
function stop(){if(!running)return;running=false;loopToken++;clearTimeout(timer);const old=activeGame;activeGame=null;if(old==="snake")window.MultiGameAPI?.snake?.stop();if(old==="pong")window.MultiGameAPI?.pong?.stop();if(old==="shooter")window.MultiGameAPI?.shooter?.stop();if(old)setControls(old,false),status(old,"ИИ остановлен");}
async function start(id){stop();if(!window.MultiGameAPI){status(id,"Игровой API ещё не загружен");return}running=true;activeGame=id;const token=++loopToken;setControls(id,true);status(id,"ИИ запускается…");
 try{
  if(id==="snake"){const ok=window.MultiGameAPI.snake.start(stepDelay/5);if(!ok)throw new Error("Сначала дождись завершения обучения змейки");status(id,"ИИ управляет змейкой и использует сохранённую Q-learning модель");watchGame(id,token,()=>window.MultiGameAPI.snake.done());return}
  if(id==="pong"){if(window.MultiGameAPI.pong.state().over)window.MultiGameAPI.pong.reset();window.MultiGameAPI.pong.start();status(id,"ИИ отслеживает мяч и управляет твоей платформой");pongLoop(token);return}
  if(id==="shooter"){window.MultiGameAPI.shooter.start();status(id,"ИИ уклоняется от астероидов и ведёт огонь");shooterLoop(token);return}
  if(id==="tictactoe"){window.MultiGameAPI.ttt.reset();status(id,"ИИ играет обеими сторонами");tttLoop(token);return}
  if(id==="2048"){if(window.MultiGameAPI.game2048.done())window.MultiGameAPI.game2048.reset();status(id,"ИИ оценивает варианты ходов и ищет выгодные слияния");game2048Loop(token);return}
  if(id==="memory"){window.MultiGameAPI.memory.reset();status(id,"ИИ открывает карточки, запоминает символы и ищет пары");await memoryLoop(token);return}
  if(id==="mines"){window.MultiGameAPI.mines.restart();status(id,"ИИ применяет логические правила и оценивает риск неизвестных клеток");minesLoop(token);return}
  if(id==="reaction"){window.MultiGameAPI.reaction.reset();status(id,"ИИ ждёт сигнал и нажимает после его появления");reactionLoop(token);return}
 }catch(err){status(id,err.message||"Не удалось запустить ИИ");running=false;activeGame=null;setControls(id,false)}
}
function schedule(token,fn,ms=stepDelay){timer=setTimeout(()=>{if(running&&token===loopToken)fn()},ms)}
function finish(id,msg){if(!running||activeGame!==id)return;status(id,msg);running=false;activeGame=null;setControls(id,false)}
function watchGame(id,token,done){if(!running||token!==loopToken)return;if(done()){finish(id,"Игра завершена. ИИ остановился.");return}schedule(token,()=>watchGame(id,token,done),500)}
function tttLoop(token){if(!running||token!==loopToken)return;const api=window.MultiGameAPI.ttt;if(api.done()){finish("tictactoe","Партия завершена. ИИ может начать новую.");return}api.step();schedule(token,()=>tttLoop(token),Math.max(120,stepDelay))}
function slide(board,dir){const out=board.slice();let gained=0;for(let line=0;line<4;line++){const ids=[];for(let k=0;k<4;k++){const r=dir==="up"?k:dir==="down"?3-k:line,c=dir==="left"?k:dir==="right"?3-k:line;ids.push(r*4+c)}const vals=ids.map(i=>out[i]).filter(Boolean),merged=[];for(let k=0;k<vals.length;k++){if(vals[k]===vals[k+1]){merged.push(vals[k]*2);gained+=vals[k]*2;k++}else merged.push(vals[k])}while(merged.length<4)merged.push(0);ids.forEach((i,k)=>out[i]=merged[k])}return{board:out,gained,changed:out.some((v,i)=>v!==board[i])}}
function evaluate2048(b){let empty=0,mono=0,smooth=0,max=0;const v=b.map(n=>n?Math.log2(n):0);for(let i=0;i<16;i++){if(!b[i])empty++;max=Math.max(max,v[i]);if(i%4<3){if(v[i]&&v[i+1])smooth-=Math.abs(v[i]-v[i+1]);if(v[i]>=v[i+1])mono+=v[i]-v[i+1]}if(i<12){if(v[i]&&v[i+4])smooth-=Math.abs(v[i]-v[i+4]);if(v[i]>=v[i+4])mono+=v[i]-v[i+4]}}const corner=Math.max(b[0],b[3],b[12],b[15]);return empty*260+mono*5+smooth*2+max*18+Math.log2(corner||1)*12}
function game2048Loop(token){if(!running||token!==loopToken)return;const api=window.MultiGameAPI.game2048;if(api.done()){finish("2048","Поле заполнено. ИИ завершил партию.");return}const board=api.board();let best=-Infinity,choice=null;for(const d of ["left","up","right","down"]){const result=slide(board,d);if(!result.changed)continue;const value=evaluate2048(result.board)+result.gained*.08;if(value>best){best=value;choice=d}}if(!choice){finish("2048","Нет доступных ходов.");return}api.move(choice);schedule(token,()=>game2048Loop(token),stepDelay)}
async function memoryLoop(token){const api=window.MultiGameAPI.memory,known=new Map();while(running&&token===loopToken&&!api.done()){const cards=api.cards(),found=api.found();let pair=null;for(const [i,symbol] of known){if(found.has(i))continue;for(const [j,other] of known){if(j>i&&!found.has(j)&&symbol===other){pair=[i,j];break}}if(pair)break}
 if(pair){api.open(pair[0]);api.open(pair[1]);await delay(Math.max(90,stepDelay/2));continue}
 const unknown=cards.map((_,i)=>i).filter(i=>!found.has(i)&&!known.has(i));if(!unknown.length){known.clear();continue}
 const first=unknown[0];api.open(first);await delay(90);const firstSymbol=$("#memoryGrid").children[first]?.textContent;if(firstSymbol&&firstSymbol!=="?")known.set(first,firstSymbol);
 const second=(api.cards().map((_,i)=>i).find(i=>i!==first&&!api.found().has(i)&&!known.has(i)));
 if(second===undefined){await delay(850);continue}
 api.open(second);await delay(90);const secondSymbol=$("#memoryGrid").children[second]?.textContent;if(secondSymbol&&secondSymbol!=="?")known.set(second,secondSymbol);
 await delay(Math.max(850,stepDelay));if(!running||token!==loopToken)return;
 }
 if(running&&token===loopToken)finish("memory","Все пары найдены. ИИ завершил игру.");
}
function minesLoop(token){if(!running||token!==loopToken)return;const api=window.MultiGameAPI.mines;if(api.done()){finish("mines","Партия завершена.");return}const cells=api.cells(),w=10,h=10,flags=cells.filter(c=>c.flag).length;let safe=new Set(),mines=new Set();
 for(let i=0;i<cells.length;i++){const c=cells[i];if(!c.open||!c.n)continue;const x=i%w,y=Math.floor(i/w),hidden=[];let around=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const ni=ny*w+nx;if(cells[ni].flag)around++;else if(!cells[ni].open)hidden.push(ni)}const remaining=c.n-around;if(hidden.length&&remaining===0)hidden.forEach(n=>safe.add(n));if(hidden.length&&remaining===hidden.length)hidden.forEach(n=>mines.add(n))}
 if(mines.size)mines.forEach(i=>{if(!cells[i].flag)api.flag(i)});
 if(safe.size){api.reveal([...safe][0]);schedule(token,()=>minesLoop(token),Math.max(100,stepDelay/2));return}
 const hidden=cells.map((c,i)=>!c.open&&!c.flag?i:-1).filter(i=>i>=0);if(!hidden.length){finish("mines","Все клетки обработаны.");return}
 // If no deterministic deduction exists, select a low-risk cell near the largest number of revealed constraints.
 const globalRisk=Math.max(0,MINES_LEFT-flags)/hidden.length,risk=new Map(hidden.map(i=>[i,{sum:globalRisk,count:1}]));for(let i=0;i<cells.length;i++){if(!cells[i].open||!cells[i].n)continue;const x=i%w,y=Math.floor(i/w);let neighbors=[],adjacentFlags=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const ni=ny*w+nx;if(cells[ni].flag)adjacentFlags++;else if(!cells[ni].open)neighbors.push(ni)}if(!neighbors.length)continue;const probability=Math.max(0,Math.min(1,(cells[i].n-adjacentFlags)/neighbors.length));neighbors.forEach(n=>{const item=risk.get(n);item.sum+=probability;item.count++})}
 const ranked=hidden.map(i=>({i,score:risk.get(i).sum/risk.get(i).count})),minRisk=Math.min(...ranked.map(x=>x.score)),safest=ranked.filter(x=>x.score<=minRisk+1e-9),guess=safest[Math.floor(Math.random()*safest.length)].i;api.reveal(guess);schedule(token,()=>minesLoop(token),stepDelay)
}
function pongLoop(token){if(!running||token!==loopToken)return;const s=window.MultiGameAPI.pong.state();if(s.over){finish("pong",s.score>s.cpu?"ИИ выиграл матч.":"Матч завершён.");return}let target=s.y;if(s.vx<0){const t=(s.x-42)/Math.max(.1,-s.vx),raw=s.y+s.vy*t;const span=s.height-20,period=span*2;let folded=((raw%period)+period)%period;target=folded>span?period-folded:folded}else target=s.height/2;window.MultiGameAPI.pong.control(target);schedule(token,()=>pongLoop(token),stepDelay)}
function shooterLoop(token){if(!running||token!==loopToken)return;const s=window.MultiGameAPI.shooter.state();if(s.lives<=0){finish("shooter","Корабль уничтожен. ИИ завершил попытку.");return}let danger=0,move=0;for(const r of s.rocks){const dx=r.x-s.ship.x,dy=s.ship.y-r.y;if(dy>-45&&dy<145&&Math.abs(dx)<r.r+42){danger=Math.max(danger,(r.r+42-Math.abs(dx))/(r.r+42));move+=dx>0?1:-1}}const target=move>0?"left":move<0?"right":"";window.MultiGameAPI.shooter.control({left:target==="left",right:target==="right",fire:true});schedule(token,()=>shooterLoop(token),stepDelay)}
async function reactionLoop(token){const zone=$("#reactionZone");if(zone.classList.contains("result")||zone.classList.contains("early"))window.MultiGameAPI.reaction.reset();zone.click();while(running&&token===loopToken&&!zone.classList.contains("ready"))await delay(40);if(!running||token!==loopToken)return;await delay(30);zone.click();finish("reaction","ИИ завершил автоматическую попытку реакции.");}
function mountPanels(){games.forEach(panel)}\nif(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mountPanels,{once:true});else mountPanels();
})();