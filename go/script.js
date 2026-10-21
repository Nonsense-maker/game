const N=19;
const boardEl=document.getElementById('board');
const turnEl=document.getElementById('turn'),movesEl=document.getElementById('moves'),capsEl=document.getElementById('captures');
const statusEl=document.getElementById('status'),overlay=document.getElementById('overlay'),resultEl=document.getElementById('result'),detailEl=document.getElementById('detail');
const modeScreen=document.getElementById('modeScreen'),passBtn=document.getElementById('pass');
let b,turn,moves,history,caps,gameOver,last,ko,mode='ai',thinking=false,difficulty=2,passes=0;

function makeBoard(){return Array.from({length:N},()=>Array(N).fill(0))}
function init(){
  b=makeBoard(); turn=1; moves=0; history=[]; caps=[0,0]; gameOver=false; last=null; ko=null; thinking=false; passes=0;
  buildBoard(); render(); ui(); overlay.classList.add('hidden');
}
function chooseMode(m){mode=m; modeScreen.style.display='none'; init();}
function buildBoard(){
  boardEl.innerHTML='';
  for(let i=0;i<N;i++){
    let h=document.createElement('i');h.className='grid';h.style.cssText=`left:5%;top:${5+i*5}%;width:90%;height:1px`;boardEl.appendChild(h);
    let v=document.createElement('i');v.className='grid';v.style.cssText=`left:${5+i*5}%;top:5%;width:1px;height:90%`;boardEl.appendChild(v);
  }
  [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]].forEach(([r,c])=>{
    const p=document.createElement('i');p.className='point';p.style.left=(5+c*5)+'%';p.style.top=(5+r*5)+'%';boardEl.appendChild(p);
  });
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const x=document.createElement('div');
    x.className='stone empty'; x.dataset.r=r; x.dataset.c=c;
    x.style.left=(5+c*5)+'%'; x.style.top=(5+r*5)+'%';
    x.onclick=()=>humanMove(r,c);
    boardEl.appendChild(x);
  }
}
function render(){
  const cells=boardEl.querySelectorAll('.stone');
  cells.forEach(x=>{
    const r=+x.dataset.r,c=+x.dataset.c,v=b[r][c];
    x.className='stone '+(v===1?'black':v===2?'white':'empty');
    x.style.background=v?'':'transparent';
    x.style.boxShadow=v?'':'none';
    if(last&&last[0]===r&&last[1]===c)x.classList.add('last');
    if(ko&&ko[0]===r&&ko[1]===c)x.classList.add('ko');
  });
}
function clone(){return b.map(r=>r.slice())}
function group(r,c,grid=b){
  const p=grid[r][c],seen=new Set(),cells=[],libs=new Set(),stack=[[r,c]];
  while(stack.length){
    const [x,y]=stack.pop(),k=x+','+y;if(seen.has(k))continue;
    seen.add(k);cells.push([x,y]);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const a=x+dx,d=y+dy;if(a<0||a>=N||d<0||d>=N)continue;
      if(grid[a][d]===0)libs.add(a+','+d);else if(grid[a][d]===p)stack.push([a,d]);
    }
  }
  return {cells,libs};
}
function legalMove(r,c,p){
  if(b[r][c]||(ko&&ko[0]===r&&ko[1]===c))return false;
  const before=clone();b[r][c]=p;let captured=0;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const x=r+dx,y=c+dy;
    if(x>=0&&x<N&&y>=0&&y<N&&b[x][y]===3-p){
      const g=group(x,y);if(g.libs.size===0){g.cells.forEach(([a,d])=>b[a][d]=0);captured+=g.cells.length}
    }
  }
  const own=group(r,c),ok=own.libs.size>0||captured>0;b=before;return ok;
}
function humanMove(r,c){
  if(gameOver||thinking||b[r][c])return;
  if(mode==='ai'&&turn!==1)return;
  if(applyMove(r,c,turn) && mode==='ai'&&!gameOver){thinking=true;ui();setTimeout(aiMove,120)}
}
function applyMove(r,c,p){
  if(!legalMove(r,c,p))return false;
  const before=clone();b[r][c]=p;let captured=[];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const x=r+dx,y=c+dy;
    if(x>=0&&x<N&&y>=0&&y<N&&b[x][y]===3-p){
      const g=group(x,y);if(g.libs.size===0)g.cells.forEach(([a,d])=>{b[a][d]=0;captured.push([a,d])});
    }
  }
  const own=group(r,c);
  history.push({before,turn:p,caps:captured.length,last,ko,passes});
  caps[p-1]+=captured.length; ko=null; passes=0; last=[r,c]; moves++;
  if(captured.length===1&&own.cells.length===1){
    const q=captured[0],g=group(r,c);if(g.libs.size===1)ko=q;
  }
  turn=3-p;render();ui();return true;
}
function pass(){
  if(gameOver||thinking)return;
  history.push({before:clone(),turn, caps:0,last,ko,passes});
  passes++;
  ko=null; last=null; moves++;
  if(passes>=2){finishByScore();return}
  turn=3-turn;render();ui();
  if(mode==='ai'&&turn===2){thinking=true;ui();setTimeout(aiMove,120)}
}
function aiMove(){
  if(gameOver){thinking=false;return}
  const candidates=[];
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    if(b[r][c]||!legalMove(r,c,2))continue;
    const score=scoreMove(r,c);
    candidates.push({r,c,score});
  }
  candidates.sort((a,z)=>z.score-a.score);
  // Late in the game, if every move looks essentially neutral, pass.
  if(!candidates.length || (candidates[0]&&candidates[0].score<3 && moves>80)){
    thinking=false;pass();return;
  }
  const count=difficulty===1?20:difficulty===2?8:difficulty===3?3:1;
  const pool=candidates.slice(0,Math.min(count,candidates.length));
  const m=pool[Math.floor(Math.random()*pool.length)];
  applyMove(m.r,m.c,2); thinking=false; ui();
}
function scoreMove(r,c){
  let score=(9-Math.max(Math.abs(r-9),Math.abs(c-9)))*1.2;
  for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
    score+=pattern(r,c,2,dr,dc);
    score+=pattern(r,c,1,dr,dc)*(difficulty>=3?1.25:.9);
  }
  // Prefer moves adjacent to existing stones; this also makes AI faster and less random.
  let near=0;
  for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
    const rr=r+dr,cc=c+dc;if(rr>=0&&rr<N&&cc>=0&&cc<N&&b[rr][cc])near++;
  }
  score+=near*2;
  return score+Math.random()*(difficulty===1?20:3);
}
function pattern(r,c,p,dr,dc){
  let own=0,open=0;
  for(const side of [-1,1])for(let k=1;k<=4;k++){
    const v=get(r+dr*k*side,c+dc*k*side);
    if(v===p)own++;else if(v===0){open++;break}else break;
  }
  if(own>=4)return 100000;if(own===3&&open)return 12000;if(own===2&&open)return 900;if(own===1&&open>=2)return 80;return 0;
}
function get(r,c){return r>=0&&r<N&&c>=0&&c<N?b[r][c]:-1}

function undo(){
  if(!history.length||gameOver||thinking)return;
  const restore=()=>{const h=history.pop();b=h.before;caps[h.turn-1]-=h.caps;moves--;last=h.last;ko=h.ko;passes=h.passes;turn=h.turn};
  if(mode==='pvp'){restore()}
  else{
    restore();
    if(history.length && history[history.length-1].turn===1)restore();
    turn=1;
  }
  render();ui();
}
function scoreBoard(){
  const seen=new Set(),territory=[0,0];
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    if(b[r][c]!==0)continue;
    const key=r+','+c;if(seen.has(key))continue;
    const cells=[],owners=new Set(),stack=[[r,c]];seen.add(key);
    while(stack.length){
      const [x,y]=stack.pop();cells.push([x,y]);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const a=x+dx,d=y+dy;if(a<0||a>=N||d<0||d>=N)continue;
        if(b[a][d]===0){const k=a+','+d;if(!seen.has(k)){seen.add(k);stack.push([a,d])}}
        else owners.add(b[a][d]);
      }
    }
    if(owners.size===1){const owner=[...owners][0];territory[owner-1]+=cells.length}
  }
  return territory;
}
function finishByScore(){
  gameOver=true;thinking=false;
  const terr=scoreBoard(),black=territoryScore(1,terr),white=territoryScore(2,terr);
  const diff=black-white;
  resultEl.textContent=diff>0?'黑棋获胜':diff<0?'白棋获胜':'和棋';
  detailEl.textContent=`黑棋 ${black} 目 · 白棋 ${white} 目（含白棋贴目 7.5）`;
  overlay.classList.remove('hidden');ui();
}
function territoryScore(p,terr){
  // Chinese-style area scoring: stones + surrounded territory; white gets 7.5 komi.
  let stones=0;for(const row of b)for(const v of row)if(v===p)stones++;
  return stones+terr[p-1]+(p===2?7.5:0);
}
function ui(){
  turnEl.textContent=mode==='ai'?(turn===1?'你（黑棋）':'电脑（白棋）'):(turn===1?'黑棋':'白棋');
  movesEl.textContent=moves;capsEl.textContent=caps[0]+' : '+caps[1];
  statusEl.textContent=gameOver?'本局结束':(thinking?'电脑思考中…':(passes?'已停一手，等待对方':(mode==='ai'?'轮到你落子':(turn===1?'黑棋落子':'白棋落子'))));
}
document.getElementById('aiMode').onclick=()=>chooseMode('ai');
document.getElementById('pvpMode').onclick=()=>chooseMode('pvp');
document.getElementById('difficulty').onchange=e=>{difficulty=+e.target.value;if(mode==='ai')init()};
document.getElementById('new').onclick=init;
document.getElementById('again').onclick=init;
document.getElementById('undo').onclick=undo;
passBtn.onclick=pass;
init();
