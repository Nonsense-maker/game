const N=15;
const boardEl=document.getElementById('board'),turnEl=document.getElementById('turn'),movesEl=document.getElementById('moves'),statusEl=document.getElementById('status');
const modeScreen=document.getElementById('modeScreen'),overlay=document.getElementById('overlay'),resultEl=document.getElementById('result'),detailEl=document.getElementById('detail');
let b,turn,moves,history,last,gameOver=false,thinking=false,mode='ai',difficulty=2;

function makeBoard(){return Array.from({length:N},()=>Array(N).fill(0))}
function init(){
 b=makeBoard();turn=1;moves=0;history=[];last=null;gameOver=false;thinking=false;
 buildBoard();render();ui();overlay.classList.add('hidden');
}
function chooseMode(m){mode=m;modeScreen.style.display='none';init()}
function buildBoard(){
 boardEl.innerHTML='';
 for(let i=0;i<N;i++){
  let h=document.createElement('i');h.className='grid';h.style.cssText=`left:3.57%;top:${3.57+i*6.64}%;width:92.86%;height:1px`;boardEl.appendChild(h);
  let v=document.createElement('i');v.className='grid';v.style.cssText=`left:${3.57+i*6.64}%;top:3.57%;width:1px;height:92.86%`;boardEl.appendChild(v);
 }
 [[3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]].forEach(([r,c])=>{
  let p=document.createElement('i');p.className='point';p.style.left=(3.57+c*6.64)+'%';p.style.top=(3.57+r*6.64)+'%';boardEl.appendChild(p);
 });
 for(let r=0;r<N;r++)for(let c=0;c<N;c++){
  let x=document.createElement('div');x.className='stone empty';x.dataset.r=r;x.dataset.c=c;
  x.style.left=(3.57+c*6.64)+'%';x.style.top=(3.57+r*6.64)+'%';x.onclick=()=>humanMove(r,c);boardEl.appendChild(x);
 }
}
function render(){
 boardEl.querySelectorAll('.stone').forEach(x=>{
  const v=b[+x.dataset.r][+x.dataset.c];x.className='stone '+(v===1?'black':v===2?'white':'empty');
  if(last&&last[0]===+x.dataset.r&&last[1]===+x.dataset.c)x.classList.add('last');
 });
}
function humanMove(r,c){
 if(gameOver||thinking||b[r][c]||(mode==='ai'&&turn!==1))return;
 if(apply(r,c,turn)&&mode==='ai'&&!gameOver){thinking=true;ui();setTimeout(aiMove,100)}
}
function apply(r,c,p){
 if(b[r][c])return false;
 const before=b.map(row=>row.slice());
 b[r][c]=p;moves++;history.push({before,last,turn:p});
 last=[r,c];
 if(checkWin(r,c,p)){gameOver=true;render();ui();finish(p);return true}
 if(moves===N*N){gameOver=true;render();ui();finish(0);return true}
 turn=3-p;render();ui();return true;
}
function checkWin(r,c,p){
 for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
  let n=1;
  for(let s=1;s<5;s++){if(get(r+dr*s,c+dc*s)!==p)break;n++}
  for(let s=1;s<5;s++){if(get(r-dr*s,c-dc*s)!==p)break;n++}
  if(n>=5)return true;
 }
 return false;
}
function get(r,c){return r>=0&&r<N&&c>=0&&c<N?b[r][c]:-1}
function scoreMove(r,c){
 let s=(7-Math.max(Math.abs(r-7),Math.abs(c-7)))*1.5;
 for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){s+=lineScore(r,c,2,dr,dc)*1.2;s+=lineScore(r,c,1,dr,dc)*(difficulty>=3?1.45:1.0)}
 let near=0;for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){let v=get(r+dr,c+dc);if(v>0)near++}
 return s+near*3+Math.random()*(difficulty===1?22:3);
}
function lineScore(r,c,p,dr,dc){
 let a=0,open=0;
 for(const side of [-1,1])for(let k=1;k<=4;k++){
  let v=get(r+dr*k*side,c+dc*k*side);
  if(v===p)a++;else if(v===0){open++;break}else break;
 }
 if(a>=4)return 100000;if(a===3&&open>=1)return 12000;if(a===2&&open>=1)return 700;if(a===1&&open>=2)return 45;return 0;
}
function aiMove(){
 if(gameOver){thinking=false;return}
 const arr=[];
 for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(!b[r][c])arr.push({r,c,score:scoreMove(r,c)});
 arr.sort((a,z)=>z.score-a.score);
 const count=difficulty===1?18:difficulty===2?8:difficulty===3?3:1;
 const pool=arr.slice(0,count),m=pool[Math.floor(Math.random()*pool.length)];
 thinking=false;apply(m.r,m.c,2);
}
function undo(){
 if(gameOver||thinking||!history.length)return;
 const restore=()=>{let h=history.pop();b=h.before;turn=h.turn;moves--;last=h.last};
 restore();
 if(mode==='ai'&&history.length){restore();turn=1}
 render();ui();
}
function finish(p){
 resultEl.textContent=p===1?'黑棋获胜':p===2?'白棋获胜':'和棋';
 detailEl.textContent=p===1&&mode==='ai'?'恭喜，你赢了！':p===2&&mode==='ai'?'电脑获胜。':p?'五子连成，本局结束。':'棋盘已满，本局和棋。';
 overlay.classList.remove('hidden');
}
function ui(){
 turnEl.textContent=mode==='ai'?(turn===1?'你（黑棋）':'电脑（白棋）'):(turn===1?'黑棋':'白棋');
 movesEl.textContent=moves;
 statusEl.textContent=gameOver?'本局结束':thinking?'电脑思考中…':mode==='ai'?'轮到你落子':(turn===1?'黑棋落子':'白棋落子');
}
document.getElementById('aiMode').onclick=()=>chooseMode('ai');
document.getElementById('pvpMode').onclick=()=>chooseMode('pvp');
document.getElementById('difficulty').onchange=e=>{difficulty=+e.target.value;if(mode==='ai')init()};
document.getElementById('new').onclick=init;
document.getElementById('again').onclick=init;
document.getElementById('undo').onclick=undo;
init();
