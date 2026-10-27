const CAP=4;
const COLORS=[
  "#ff5f6d","#ffd166","#4dd4ac","#55a7ff","#b084f5","#ff8c42",
  "#ef7bb0","#7dd3fc"
];

const LEVELS=[
  {colors:4, empty:2, mix:12},
  {colors:5, empty:2, mix:20},
  {colors:6, empty:2, mix:28},
  {colors:7, empty:2, mix:38},
  {colors:8, empty:2, mix:48}
];

let level=0, tubes=[], selected=-1, moves=0, history=[], solved=false;

const board=document.getElementById("board");
const levelEl=document.getElementById("level");
const movesEl=document.getElementById("moves");
const message=document.getElementById("message");
const undoBtn=document.getElementById("undo");
const restartBtn=document.getElementById("restart");
const nextBtn=document.getElementById("next");

function clone(x){return x.map(t=>[...t]);}

function makeLevel(n){
  const cfg=LEVELS[n%LEVELS.length];
  let source=[];
  for(let c=0;c<cfg.colors;c++) for(let i=0;i<CAP;i++) source.push(c);

  // Start from a solved state, then make valid random reverse moves.
  let a=Array.from({length:cfg.colors+cfg.empty},()=>[]);
  for(let c=0;c<cfg.colors;c++) a[c]=Array(CAP).fill(c);

  let guard=0;
  while(guard++<cfg.mix*20){
    const from=[];
    for(let i=0;i<a.length;i++) if(a[i].length) from.push(i);
    const i=from[Math.floor(Math.random()*from.length)];
    const possible=a.map((t,j)=>j!==i && t.length<CAP && (t.length===0 || t[t.length-1]!==a[i][a[i].length-1])).map((x,j)=>x?j:-1).filter(j=>j>=0);
    if(!possible.length) continue;
    const j=possible[Math.floor(Math.random()*possible.length)];
    const color=a[i][a[i].length-1];
    let count=1;
    while(count<a[i].length && a[i][a[i].length-1-count]===color) count++;
    const max=Math.min(count,CAP-a[j].length);
    const amount=1+Math.floor(Math.random()*max);
    for(let k=0;k<amount;k++) a[j].push(a[i].pop());
  }

  // Avoid trivially solved or nearly solved openings.
  if(a.slice(0,cfg.colors).every(t=>t.length===CAP && new Set(t).size===1)) return makeLevel(n);

  tubes=a;
  selected=-1; moves=0; history=[]; solved=false;
  render();
}

function getPourCount(i,j){
  if(i===j || !tubes[i].length || tubes[j].length>=CAP) return 0;

  const source=tubes[i];
  const target=tubes[j];
  const color=source[source.length-1];

  // The player may pour the ENTIRE contiguous top block of the same color
  // in one move, limited only by the free space in the target tube.
  // There is deliberately no two-layer limit here.
  let count=0;
  for(let k=source.length-1;k>=0 && source[k]===color;k--){
    count++;
  }

  return Math.min(count,CAP-target.length);
}

function canPour(i,j){
  if(i===j || !tubes[i].length || tubes[j].length>=CAP) return false;
  const color=tubes[i][tubes[i].length-1];
  return tubes[j].length===0 || tubes[j][tubes[j].length-1]===color;
}

function pour(i,j){
  const count=getPourCount(i,j);
  if(!count || !canPour(i,j)) return false;

  history.push(clone(tubes));
  const a=tubes[i], b=tubes[j], color=a[a.length-1];
  for(let k=0;k<count;k++) b.push(a.pop());
  moves++;
  return true;
}

function isComplete(t){
  return t.length===0 || (t.length===CAP && new Set(t).size===1);
}
function checkWin(){return tubes.every(isComplete);}

function animatePour(fromIndex,toIndex,color,count,onDone){
  const fromEl=board.children[fromIndex];
  const toEl=board.children[toIndex];
  if(!fromEl||!toEl){onDone();return;}

  const a=fromEl.getBoundingClientRect();
  const b=toEl.getBoundingClientRect();

  // Clone the source tube so the whole tube can visibly tilt.
  const ghost=fromEl.cloneNode(true);
  ghost.className="pouring-tube";
  ghost.style.width=a.width+"px";
  ghost.style.height=a.height+"px";
  ghost.style.left=a.left+"px";
  ghost.style.top=a.top+"px";
  ghost.style.setProperty("--tx",(b.left-a.left)*0.28+"px");
  ghost.style.setProperty("--ty",(b.top-a.top)*0.10+"px");
  ghost.style.setProperty("--pour-count",count);
  document.body.appendChild(ghost);

  // Hide the original source while its animated copy pours.
  fromEl.style.visibility="hidden";

  const stream=document.createElement("div");
  stream.className="pour-stream";
  stream.style.background=COLORS[color];
  stream.style.left=(a.left+a.width*0.78)+"px";
  stream.style.top=(a.top+a.height*0.10)+"px";
  stream.style.setProperty("--stream-color",COLORS[color]);
  document.body.appendChild(stream);

  const streamEndX=b.left+b.width/2;
  const streamEndY=b.top+b.height*0.28;
  const streamStartX=a.left+a.width*0.78;
  const streamStartY=a.top+a.height*0.10;
  const dx=streamEndX-streamStartX, dy=streamEndY-streamStartY;
  const len=Math.sqrt(dx*dx+dy*dy);
  const angle=Math.atan2(dy,dx)*180/Math.PI+90;
  stream.style.setProperty("--stream-len",Math.max(35,len)+"px");
  stream.style.setProperty("--stream-angle",angle+"deg");

  // Animate the actual liquid-looking stream after the tube begins tipping.
  requestAnimationFrame(()=>ghost.classList.add("tilting"));
  setTimeout(()=>stream.classList.add("flowing"),180);

  setTimeout(()=>{
    ghost.remove();
    stream.remove();
    fromEl.style.visibility="";
    onDone();
  },700);
}
function clickTube(i){
  if(solved || window.pouring)return;

  if(selected<0){
    if(tubes[i].length){
      selected=i;
      message.textContent="现在点击目标试管";
      render();
    }
    return;
  }

  if(selected===i){
    selected=-1;
    message.textContent="点击一个试管，再点击另一个试管倒水";
    render();
    return;
  }

  const from=selected;
  if(!canPour(from,i)){
    const el=board.children[i];
    el.classList.add("shake");
    setTimeout(()=>el.classList.remove("shake"),260);
    message.textContent="只能倒到空试管，或倒到相同颜色的液体上面";
    return;
  }

  const color=tubes[from][tubes[from].length-1];
  const fromSnapshot=clone(tubes);
  const count=getPourCount(from,i);
  const a=tubes[from], b=tubes[i];

  // Move the complete contiguous top block in one operation.
  // Example: 3 same-color layers + 4 empty target slots => all 3 move now.
  for(let k=0;k<count;k++) b.push(a.pop());

  history.push(fromSnapshot);
  moves++;
  selected=-1;
  window.pouring=true;

  // Render the changed liquid state after the visual pour finishes.
  // During the animation the tubes remain visually stable enough to read.
  animatePour(from,i,color,count,()=>{
    window.pouring=false;
    if(checkWin()){
      solved=true;
      message.innerHTML="🎉 <span class='win'>完成！这一关整理好了</span>";
      nextBtn.disabled=false;
    }else{
      message.textContent="继续整理，试试看下一步";
    }
    render();
  });
}
function render(){
  levelEl.textContent=level+1;
  movesEl.textContent=moves;
  board.innerHTML="";
  tubes.forEach((tube,i)=>{
    const el=document.createElement("div");
    el.className="tube"+(i===selected?" selected":"")+(isComplete(tube)?" completed":"");
    el.onclick=()=>clickTube(i);
    tube.forEach(c=>{
      const liquid=document.createElement("div");
      liquid.className="liquid";
      liquid.style.background=`linear-gradient(90deg,${COLORS[c]},${COLORS[c]}dd,${COLORS[c]})`;
      el.appendChild(liquid);
    });
    board.appendChild(el);
  });
  undoBtn.disabled=history.length===0 || window.pouring;
  restartBtn.disabled=window.pouring;
  nextBtn.disabled=!solved || window.pouring;
}

undoBtn.onclick=()=>{
  if(!history.length || solved)return;
  tubes=history.pop();
  moves=Math.max(0,moves-1);
  selected=-1;
  message.textContent="已撤销上一步";
  render();
};

restartBtn.onclick=()=>makeLevel(level);
nextBtn.onclick=()=>{if(solved){level++;makeLevel(level)}};

makeLevel(0);
