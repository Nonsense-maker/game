const SIZE=10;
const FLEETS=[
 {name:"航母",size:5},
 {name:"战列舰",size:4},
 {name:"巡洋舰",size:3},
 {name:"驱逐舰",size:3},
 {name:"潜艇",size:2}
];

const setupBoardEl=document.getElementById("setupBoard");
const myBoardEl=document.getElementById("myBoard");
const enemyBoardEl=document.getElementById("enemyBoard");
const fleetList=document.getElementById("fleetList");
const statusEl=document.getElementById("status");
const setupEl=document.getElementById("setup");
const battleEl=document.getElementById("battle");
const resultEl=document.getElementById("result");
const resultTitle=document.getElementById("resultTitle");
const resultText=document.getElementById("resultText");

let myGrid,enemyGrid,myShips=[],enemyShips=[];
let selected=0,horizontal=true,phase="setup",turn="player";
let myShots=new Map(),enemyShots=new Map(),aiTargets=[],history=[],aiTimer=null;

function empty(){return Array.from({length:SIZE},()=>Array(SIZE).fill(null))}
function K(r,c){return r*SIZE+c}
function inside(r,c){return r>=0&&r<SIZE&&c>=0&&c<SIZE}

function cellsFor(r,c,size,h){
 const a=[];
 for(let i=0;i<size;i++){
  const rr=r+(h?0:i),cc=c+(h?i:0);
  if(!inside(rr,cc))return null;
  a.push([rr,cc]);
 }
 return a;
}
function validPlace(grid,r,c,size,h){
 const cells=cellsFor(r,c,size,h);
 if(!cells||cells.some(([rr,cc])=>grid[rr][cc]))return null;
 return cells;
}
function makeShip(def,cells){return {...def,cells,hits:new Set()}}
function sunk(s){return s.hits.size>=s.size}
function allSunk(list){return list.length===5&&list.every(s=>sunk(s))}

function resetSetup(){
 myGrid=empty();myShips=[];selected=0;horizontal=true;history=[];
 phase="setup";turn="player";myShots=new Map();enemyShots=new Map();aiTargets=[];
 renderFleet();renderSetup();
 statusEl.textContent="选择舰船后点击棋盘摆放。摆好后可用“撤销”修改。";
 document.getElementById("rotate").textContent="旋转：横向";
}
function renderFleet(){
 fleetList.innerHTML="";
 FLEETS.forEach((f,i)=>{
  const b=document.createElement("button");
  b.className="ship-option"+(i===selected&&!myShips[i]?" selected":"")+(myShips[i]?" done":"");
  b.innerHTML=`<span>${f.name} · ${f.size}格</span><b>${myShips[i]?"已摆放":i===selected?"当前":"待摆放"}</b>`;
  b.onclick=()=>{selected=i;renderFleet();renderSetup()};
  fleetList.appendChild(b);
 });
}
function renderSetup(preview=null){
 setupBoardEl.innerHTML="";
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
  const b=document.createElement("button");b.className="cell";
  if(myGrid[r][c])b.classList.add("ship");
  if(preview&&preview.some(x=>x[0]===r&&x[1]===c)){
   b.classList.add("preview");
   if(!validPlace(myGrid,preview[0][0],preview[0][1],FLEETS[selected].size,horizontal))b.classList.add("bad");
  }
  b.onmouseenter=()=>renderSetup(cellsFor(r,c,FLEETS[selected].size,horizontal));
  b.onmouseleave=()=>renderSetup();
  b.onclick=()=>placeSelected(r,c);
  setupBoardEl.appendChild(b);
 }
}
function placeSelected(r,c){
 if(myShips[selected]){statusEl.textContent="这艘舰船已经摆放，选择其他舰船。";return}
 const f=FLEETS[selected];
 const cells=validPlace(myGrid,r,c,f.size,horizontal);
 if(!cells){statusEl.textContent="这里放不下，请换一个位置。";return}
 const ship=makeShip(f,cells);
 myShips[selected]=ship;
 cells.forEach(([rr,cc])=>myGrid[rr][cc]=ship);
 history.push(selected);
 const next=FLEETS.findIndex((_,i)=>!myShips[i]);
 selected=next<0?0:next;
 renderFleet();renderSetup();
 if(FLEETS.every((_,i)=>myShips[i]))statusEl.textContent="舰队已经全部摆好。还可以撤销，确认无误后点击“完成布阵”。";
}
function undo(){
 if(!history.length){statusEl.textContent="已经没有可以撤销的摆放。";return}
 const idx=history.pop(),ship=myShips[idx];
 if(!ship)return;
 ship.cells.forEach(([r,c])=>myGrid[r][c]=null);
 myShips[idx]=null;
 selected=idx;
 renderFleet();renderSetup();
 statusEl.textContent=`已撤销${ship.name}，请选择新的位置。`;
}
function rotate(){
 horizontal=!horizontal;
 document.getElementById("rotate").textContent="旋转："+(horizontal?"横向":"纵向");
 renderSetup();
}
function randomFleet(){
 myGrid=empty();myShips=[];history=[];
 FLEETS.forEach((f,i)=>{
  let cells;
  do{
   const h=Math.random()<.5,r=Math.floor(Math.random()*SIZE),c=Math.floor(Math.random()*SIZE);
   cells=validPlace(myGrid,r,c,f.size,h);
  }while(!cells);
  const s=makeShip(f,cells);myShips[i]=s;
  cells.forEach(([r,c])=>myGrid[r][c]=s);
  history.push(i);
 });
 selected=0;renderFleet();renderSetup();
 statusEl.textContent="已随机布阵。仍可点击“撤销”逐艘修改。";
}
function aiFleet(){
 enemyGrid=empty();enemyShips=[];
 FLEETS.forEach(f=>{
  let cells;
  do{
   const h=Math.random()<.5,r=Math.floor(Math.random()*SIZE),c=Math.floor(Math.random()*SIZE);
   cells=validPlace(enemyGrid,r,c,f.size,h);
  }while(!cells);
  const s=makeShip(f,cells);enemyShips.push(s);
  cells.forEach(([r,c])=>enemyGrid[r][c]=s);
 });
}
function confirmSetup(){
 if(!FLEETS.every((_,i)=>myShips[i])){statusEl.textContent="还有舰船没有摆放完成。";return}
 aiFleet();phase="battle";turn="player";
 setupEl.classList.add("hidden");battleEl.classList.remove("hidden");
 statusEl.textContent="你的回合：攻击右侧敌方海域！";
 renderBattle();
}
function renderBattle(){
 myBoardEl.innerHTML="";enemyBoardEl.innerHTML="";
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
  const a=document.createElement("button");a.className="cell";
  if(myGrid[r][c])a.classList.add("ship");
  const es=enemyShots.get(K(r,c));if(es)a.classList.add(es);
  a.disabled=true;myBoardEl.appendChild(a);

  const b=document.createElement("button");b.className="cell";
  const ps=myShots.get(K(r,c));if(ps)b.classList.add(ps);
  b.onclick=()=>playerAttack(r,c);
  enemyBoardEl.appendChild(b);
 }
}
function playerAttack(r,c){
 if(phase!=="battle"||turn!=="player"||myShots.has(K(r,c)))return;
 const k=K(r,c),ship=enemyGrid[r][c];
 if(ship){
  myShots.set(k,"hit");ship.hits.add(k);
  statusEl.textContent=sunk(ship)?`命中！你击沉了 AI 的${ship.name}！`:"命中！继续攻击。";
 }else{
  myShots.set(k,"miss");statusEl.textContent="未命中，AI 回合。";
 }
 renderBattle();
 if(allSunk(enemyShips)){endGame(true);return}
 turn="ai";aiTimer=setTimeout(aiAttack,650+Math.random()*600);
}
function aiAttack(){
 if(phase!=="battle")return;
 let target=null;
 while(aiTargets.length&&!target){
  const k=aiTargets.shift();
  if(!enemyShots.has(k))target=[Math.floor(k/SIZE),k%SIZE];
 }
 if(!target){
  const candidates=[];
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(!enemyShots.has(K(r,c)))candidates.push([r,c]);
  if(!candidates.length)return;
  target=candidates[Math.floor(Math.random()*candidates.length)];
 }
 const [r,c]=target,k=K(r,c),ship=myGrid[r][c];
 if(ship){
  enemyShots.set(k,"hit");ship.hits.add(k);
  if(!sunk(ship)){
   [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([rr,cc])=>{
    if(inside(rr,cc)&&!enemyShots.has(K(rr,cc)))aiTargets.push(K(rr,cc));
   });
   statusEl.textContent="AI 命中你的舰船！";
  }else statusEl.textContent=`AI 击沉了你的${ship.name}！`;
 }else{
  enemyShots.set(k,"miss");statusEl.textContent="AI 未命中，轮到你。";
 }
 renderBattle();
 if(allSunk(myShips)){endGame(false);return}
 turn="player";
}
function endGame(win){
 phase="result";
 if(aiTimer){clearTimeout(aiTimer);aiTimer=null}
 resultEl.classList.remove("hidden");
 resultTitle.textContent=win?"胜利！":"失败！";
 resultText.textContent=win?"你已经击沉 AI 的全部舰队。":"你的全部舰队已经被 AI 击沉。";
 statusEl.textContent=win?"战斗结束，你赢了！":"战斗结束，AI 获胜！";
}
function restart(){
 if(aiTimer){clearTimeout(aiTimer);aiTimer=null}
 resultEl.classList.add("hidden");battleEl.classList.add("hidden");setupEl.classList.remove("hidden");
 resetSetup();
}
document.getElementById("rotate").onclick=rotate;
document.getElementById("undo").onclick=undo;
document.getElementById("random").onclick=randomFleet;
document.getElementById("confirm").onclick=confirmSetup;
document.getElementById("restart").onclick=restart;
document.getElementById("again").onclick=restart;
resetSetup();
