const board = document.getElementById("board");
const levelEl = document.getElementById("level");
const movesEl = document.getElementById("moves");
const undoBtn = document.getElementById("undo");
const restartBtn = document.getElementById("restart");
const nextBtn = document.getElementById("next");
const modal = document.getElementById("modal");
const finalMoves = document.getElementById("finalMoves");
const modalNext = document.getElementById("modalNext");

const COLS = 8, ROWS = 10;
const COLORS = ["coral","blue","yellow","green","purple","orange","pink","cyan","navy"];
const ARROWS = {L:"←",R:"→",U:"↑",D:"↓"};
const DIRS = ["L","R","U","D"];

let level=0, moves=0, pieces=[], history=[], busy=false, won=false;
let rngSeed=1000;

function rng(){
  rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
  return rngSeed / 4294967296;
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function cloneState(){
  return pieces.map(p=>({id:p.id,r:p.r,c:p.c,out:p.out}));
}
function restore(s){
  s.forEach(x=>{const p=pieces.find(v=>v.id===x.id);if(p){p.r=x.r;p.c=x.c;p.out=x.out;}});
}
function gridFor(except=-1){
  const g=Array.from({length:ROWS},()=>Array(COLS).fill(-1));
  for(const p of pieces){
    if(p.out||p.id===except) continue;
    for(let r=p.r;r<p.r+p.h;r++) for(let c=p.c;c<p.c+p.w;c++){
      if(r>=0&&r<ROWS&&c>=0&&c<COLS) g[r][c]=p.id;
    }
  }
  return g;
}
function overlaps(g,r,c,h,w){
  if(r<0||c<0||r+h>ROWS||c+w>COLS)return true;
  for(let y=r;y<r+h;y++)for(let x=c;x<c+w;x++)if(g[y][x]!==-1)return true;
  return false;
}
function directionVector(d){return d==="L"?[0,-1]:d==="R"?[0,1]:d==="U"?[-1,0]:[1,0];}

/*
  Guaranteed-solvable generator:
  Build pieces in reverse of their intended exit order.
  When a piece is placed, its whole route to its chosen edge must be free
  of all pieces already placed (which are the pieces removed later).
  Therefore, in forward play, every piece has a valid route out.
*/
function generateLevel(seed, count){
  // 每次调用都真正随机，不使用固定 seed。
  // 采用“反向构造”：先放最后驶出的方块，再放最先驶出的方块。
  // 每个新方块的整条出口路线都会避开已经放好的方块，因此关卡必定有解。
  const dirs=["L","R","U","D"];

  for(let attempt=0;attempt<600;attempt++){
    const result=[];

    for(let id=count-1;id>=0;id--){
      let placed=null;

      for(let tries=0;tries<180;tries++){
        const dir=dirs[Math.floor(Math.random()*dirs.length)];

        let w=1,h=1;
        const longChance=Math.min(.72,.38+level*.035);
        if(Math.random()<longChance){
          if(dir==="L"||dir==="R"){
            w=Math.random()<.78?2:3;
          }else{
            h=Math.random()<.78?2:3;
          }
        }

        const r=Math.floor(Math.random()*(ROWS-h+1));
        const c=Math.floor(Math.random()*(COLS-w+1));

        const candidate={
          id,r,c,w,h,dir,
          color:COLORS[id%COLORS.length],
          out:false,
          el:null
        };

        if(result.some(q=>pieceOverlap(candidate,q))) continue;

        // 检查从当前位置沿箭头走到出口的整条路线。
        // result 中的方块属于更晚才会被移走的方块，不能挡住路线。
        let cr=r,cc=c,clear=true;
        const [dr,dc]=directionVector(dir);

        for(let guard=0;guard<20;guard++){
          const nr=cr+dr,nc=cc+dc;

          if(nr<0||nc<0||nr+h>ROWS||nc+w>COLS){
            break;
          }

          if(result.some(q=>pieceOverlapAt(candidate,nr,nc,q))){
            clear=false;
            break;
          }

          cr=nr;cc=nc;
        }

        if(!clear) continue;

        placed=candidate;
        break;
      }

      if(!placed){
        result.length=0;
        break;
      }
      result.push(placed);
    }

    if(result.length===count && validListNoOverlap(result)){
      return result;
    }
  }

  // 生成失败时降低密度重新尝试，而不是返回空数组。
  const smaller=Math.max(6,count-3);
  if(smaller<count) return generateLevel(Math.random(),smaller);

  return [];
}

function pieceOverlap(a,b){
  return !(a.c+a.w<=b.c || b.c+b.w<=a.c ||
           a.r+a.h<=b.r || b.r+b.h<=a.r);
}

function pieceOverlapAt(a,r,c,b){
  return !(c+a.w<=b.c || b.c+b.w<=c ||
           r+a.h<=b.r || b.r+b.h<=r);
}

function validListNoOverlap(list){
  for(let i=0;i<list.length;i++){
    for(let j=i+1;j<list.length;j++){
      if(pieceOverlap(list[i],list[j])) return false;
    }
  }
  return true;
}

function buildLevel(){
  moves=0;history=[];busy=false;won=false;
  const count=Math.min(16+level*2,22);
  pieces=generateLevel(Math.random(),count);
  // 保险：随机生成失败时使用已有可用布局，不允许出现空棋盘。
  if(!pieces.length || !validNoOverlap()) pieces=fallbackLevel(Math.min(count,16),Math.floor(Math.random()*2)+1);
  render();
  nextBtn.disabled=true;
  modal.hidden=true;
}
function validNoOverlap(){
  const seen=new Set();
  for(const p of pieces)for(let r=p.r;r<p.r+p.h;r++)for(let c=p.c;c<p.c+p.w;c++){
    const k=r+","+c;if(seen.has(k))return false;seen.add(k);
  }
  return true;
}
function canStep(p){
  const [dr,dc]=directionVector(p.dir);
  const g=gridFor(p.id);
  const nr=p.r+dr,nc=p.c+dc;
  if(nr<0||nc<0||nr+p.h>ROWS||nc+p.w>COLS)return {edge:true};
  for(let r=nr;r<nr+p.h;r++)for(let c=nc;c<nc+p.w;c++)if(g[r][c]!==-1)return {blocked:true};
  return {r:nr,c:nc};
}
function render(){
  board.innerHTML="";
  const cw=100/COLS,rh=100/ROWS;
  for(const p of pieces){
    if(p.out)continue;
    const el=document.createElement("button");
    el.type="button";el.className="piece";el.dataset.color=p.color;el.dataset.startR=p.r;el.dataset.startC=p.c;
    el.innerHTML=`<span class="arrow">${ARROWS[p.dir]}</span>`;
    el.setAttribute("aria-label","沿箭头方向移动");
    el.style.left=(p.c*cw)+"%";el.style.top=(p.r*rh)+"%";
    el.style.width=(p.w*cw)+"%";el.style.height=(p.h*rh)+"%";
    el.addEventListener("click",()=>attempt(p.id,el));
    board.appendChild(el);
  }
  levelEl.textContent=level+1;movesEl.textContent=moves;
  undoBtn.disabled=history.length===0||busy;
}
function attempt(id,el){
  if(busy||won)return;
  const p=pieces.find(x=>x.id===id);if(!p||p.out)return;
  const before=cloneState();
  const first=canStep(p);

  if(first.blocked){
    bump(el,p.dir);
    return;
  }

  busy=true;
  let moved=false;
  let exited=false;
  const path=[];

  while(true){
    const s=canStep(p);
    if(s.edge){
      // 已经走到最后一个可停位置，下一步就是从边缘驶出。
      exited=true;
      moved=true;
      break;
    }
    if(s.blocked)break;
    p.r=s.r;p.c=s.c;moved=true;
    path.push([p.r,p.c]);
  }

  if(!moved){
    busy=false;
    return;
  }

  history.push(before);
  moves++;

  // 正常移动到最后位置；如果下一步是出口，则继续滑出棋盘。
  const targetR=p.r,targetC=p.c;
  animatePiece(el,p,path,exited,()=>{
    if(exited){
      p.out=true;
      el.remove();
    }
    busy=false;
    render();
    checkWin();
  });
}

function animatePiece(el,p,path,exiting,done){
  const cw=board.clientWidth/COLS;
  const ch=board.clientHeight/ROWS;
  const fromX=parseFloat(el.style.left)||0;
  const fromY=parseFloat(el.style.top)||0;

  // 先把方块的 CSS 定位固定住，避免 render/百分比定位导致动画跳动。
  el.style.transition="none";
  el.style.left=fromX+"%";
  el.style.top=fromY+"%";

  const [dr,dc]=directionVector(p.dir);
  const steps=Math.max(1,path.length);
  const last=path.length?path[path.length-1]:[p.r,p.c];
  const startR=parseFloat(el.dataset.startR||p.r);
  const startC=parseFloat(el.dataset.startC||p.c);

  // 根据最终位置直接计算真实像素位移，绝不使用已经更新后的 p.r/p.c 做 0 位移计算。
  const normalDx=(last[1]-startC)*cw;
  const normalDy=(last[0]-startR)*ch;
  const exitDx=(p.c-startC+dc*2)*cw;
  const exitDy=(p.r-startR+dr*2)*ch;
  const dx=exiting?exitDx:normalDx;
  const dy=exiting?exitDy:normalDy;

  // 记录动画起点。
  el.style.transform="translate(0,0)";
  void el.offsetWidth;
  el.style.transition=`transform ${Math.min(520,180+steps*45)}ms cubic-bezier(.2,.75,.25,1)`;
  el.style.transform=`translate(${dx}px,${dy}px)`;

  const duration=Math.min(520,180+steps*45);
  setTimeout(()=>{
    if(exiting){
      el.style.opacity="0";
    }
    done();
  },duration+20);
}
function bump(el,dir){
  busy=true;el.classList.add("blocked");
  const v=dir==="L"?[-9,0]:dir==="R"?[9,0]:dir==="U"?[0,-9]:[0,9];
  el.style.setProperty("--bx",v[0]+"px");el.style.setProperty("--by",v[1]+"px");
  setTimeout(()=>{el.classList.remove("blocked");el.style.removeProperty("--bx");el.style.removeProperty("--by");busy=false},240);
}
function checkWin(){
  if(pieces.every(p=>p.out)){
    won=true;finalMoves.textContent=moves;nextBtn.disabled=false;
    setTimeout(()=>modal.hidden=false,180);
  }
}
undoBtn.addEventListener("click",()=>{
  if(busy||!history.length||won)return;
  restore(history.pop());moves=Math.max(0,moves-1);render();
});
restartBtn.addEventListener("click",buildLevel);
function nextLevel(){level=(level+1)%5;buildLevel();}
nextBtn.addEventListener("click",nextLevel);
modalNext.addEventListener("click",nextLevel);
buildLevel();
