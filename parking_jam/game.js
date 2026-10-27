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
  rngSeed=seed;
  const placed=[];
  const candidates=[];
  for(let h=1;h<=2;h++)for(let w=1;w<=2;w++){
    if(h===2&&w===2) continue;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      if(r+h>ROWS||c+w>COLS)continue;
      for(const d of DIRS){
        let clear=true;
        const [dr,dc]=directionVector(d);
        const edge = d==="L"?c===0:d==="R"?c+w===COLS:d==="U"?r===0:r+h===ROWS;
        if(edge) continue; // routes should have some travel, making the puzzle less trivial
        const test=placed.map(p=>p);
        const occupied=Array.from({length:ROWS},()=>Array(COLS).fill(false));
        for(const p of placed)for(let y=p.r;y<p.r+p.h;y++)for(let x=p.c;x<p.c+p.w;x++)occupied[y][x]=true;

        let rr=r,cc=c, guard=0;
        while(true){
          const nr=rr+dr,nc=cc+dc;
          if(nr<0||nc<0||nr+h>ROWS||nc+w>COLS)break;
          for(let y=nr;y<nr+h;y++)for(let x=nc;x<nc+w;x++)if(occupied[y][x])clear=false;
          if(!clear)break;
          rr=nr;cc=nc;
          if(++guard>20){clear=false;break;}
        }
        if(clear && (rr!==r||cc!==c || edge)) candidates.push({r,c,h,w,d});
      }
    }
  }

  while(placed.length<count){
    const pool=shuffle(candidates.slice());
    let found=null;
    for(const cand of pool){
      const g=gridForGenerated(placed);
      if(!overlaps(g,cand.r,cand.c,cand.h,cand.w)){
        // Ensure at least one cell of travel before the edge.
        let rr=cand.r,cc=cand.c;
        const [dr,dc]=directionVector(cand.d);
        let travel=0;
        while(true){
          const nr=rr+dr,nc=cc+dc;
          if(nr<0||nc<0||nr+cand.h>ROWS||nc+cand.w>COLS)break;
          if(overlaps(g,nr,nc,cand.h,cand.w))break;
          rr=nr;cc=nc;travel++;
        }
        if(travel>=1){found=cand;break;}
      }
    }
    if(!found) break;
    placed.push({id:placed.length,r:found.r,c:found.c,h:found.h,w:found.w,dir:found.d,
      color:COLORS[placed.length%COLORS.length],out:false});
    candidates.splice(0); // regenerate candidate set around the new placed set
    // Rebuild all possible candidates against the current placed set.
    for(let h=1;h<=2;h++)for(let w=1;w<=2;w++){
      if(h===2&&w===2)continue;
      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
        if(r+h>ROWS||c+w>COLS)continue;
        for(const d of DIRS){
          const g=gridForGenerated(placed);
          if(overlaps(g,r,c,h,w))continue;
          const [dr,dc]=directionVector(d);
          let rr=r,cc=c,clear=true,travel=0;
          while(true){
            const nr=rr+dr,nc=cc+dc;
            if(nr<0||nc<0||nr+h>ROWS||nc+w>COLS)break;
            if(overlaps(g,nr,nc,h,w)){clear=false;break;}
            rr=nr;cc=nc;travel++;
          }
          if(clear&&travel>=1)candidates.push({r,c,h,w,d});
        }
      }
    }
  }

  // If the random construction stalls, use a deterministic guaranteed layout.
  if(placed.length<count){
    return fallbackLevel(count, seed);
  }

  // Reverse construction means current array is exit order reversed.
  // Shuffle IDs/colors only; positions/directions remain tied to guaranteed routes.
  const out=placed.reverse();
  out.forEach((p,i)=>p.id=i);
  return out;
}
function gridForGenerated(arr){
  const g=Array.from({length:ROWS},()=>Array(COLS).fill(-1));
  for(const p of arr)for(let y=p.r;y<p.r+p.h;y++)for(let x=p.c;x<p.c+p.w;x++)g[y][x]=p.id;
  return g;
}
function fallbackLevel(count,seed){
  // Dense but guaranteed: every piece points to a different edge and
  // later pieces are placed first in reverse order.
  const layouts=[
    [ [4,1,1,2,"U"],[6,2,1,2,"L"],[7,5,1,2,"D"],[3,6,2,1,"R"],
      [5,0,2,1,"L"],[1,4,1,2,"U"],[2,1,2,1,"D"],[8,3,1,3,"R"],
      [0,6,1,2,"R"],[9,1,1,2,"D"],[6,6,1,2,"R"],[3,2,1,2,"L"],
      [7,0,1,2,"L"],[1,7,2,1,"R"],[8,6,2,1,"D"],[0,2,1,2,"U"]
    ],
    [ [4,1,2,1,"U"],[2,2,1,3,"L"],[6,5,2,1,"R"],[5,0,1,3,"D"],
      [0,5,1,2,"U"],[7,2,1,3,"L"],[3,0,2,1,"L"],[1,3,1,2,"R"],
      [8,5,1,3,"D"],[9,0,1,2,"L"],[6,0,1,2,"L"],[2,6,2,1,"R"],
      [0,1,1,2,"U"],[4,6,1,2,"R"],[7,6,2,1,"D"],[1,0,1,2,"L"]
    ]
  ];
  const raw=layouts[seed%layouts.length];
  return raw.slice(0,count).map((p,i)=>({id:i,r:p[0],c:p[1],h:p[2],w:p[3],dir:p[4],color:COLORS[i%COLORS.length],out:false}));
}

function buildLevel(){
  moves=0;history=[];busy=false;won=false;
  const count=Math.min(16+level*2,22);
  pieces=generateLevel(9001+level*7919,count);
  // Validate no overlap. If any unexpected issue occurs, use fallback.
  if(!validNoOverlap()) pieces=fallbackLevel(count,level+1);
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
