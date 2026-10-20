const SUITS=[
 {name:"♠",color:"black",key:"S"},{name:"♥",color:"red",key:"H"},
 {name:"♣",color:"black",key:"C"},{name:"♦",color:"red",key:"D"}
];
const RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const CONFIG={
 easy:{label:"简单",free:4,target:0.30},
 normal:{label:"普通",free:4,target:null},
 hard:{label:"困难",free:3,target:0.72},
 hell:{label:"地狱",free:2,target:0.92},
 random:{label:"随机",free:4,target:null}
};

let tableau=[],freecells=[],foundations=[0,0,0,0],history=[];
let moves=0,gameNo=1,startTime=0,timer=null,selected=null,gameOver=false,difficulty="normal";

const $=id=>document.getElementById(id);

function makeDeck(){
 const d=[];
 for(let s=0;s<4;s++)for(let r=0;r<13;r++)d.push({suit:SUITS[s],rank:r,id:s*13+r});
 return d;
}
function randomShuffle(deck){
 for(let i=deck.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [deck[i],deck[j]]=[deck[j],deck[i]];
 }
 return deck;
}

/*
  每次新局都先真正随机洗牌。
  难度筛选只是在随机牌局中挑选符合难度特征的一局，
  不使用固定种子，因此同一难度也不会固定成几副牌。
*/
function difficultyMetric(deck){
 const cols=Array.from({length:8},()=>[]);
 deck.forEach((c,i)=>cols[i%8].push(c));
 let blocked=0,alternating=0,emptyPotential=0;
 for(const col of cols){
   for(let i=0;i<col.length-1;i++){
     const a=col[i],b=col[i+1];
     if(a.rank<b.rank)blocked += 1 + (b.rank-a.rank)*0.08;
     if(a.suit.color===b.suit.color)blocked += 0.35;
     if(a.suit.color!==b.suit.color && a.rank===b.rank+1)alternating++;
   }
   if(col.length===0)emptyPotential++;
 }
 // 越高越容易被压住，越低越容易直接形成可移动序列
 const raw=blocked-alternating*0.9-emptyPotential*0.5;
 return Math.max(0,Math.min(1,raw/25));
}
function makeRandomDeal(){
 const cfg=CONFIG[difficulty];
 if(difficulty==="random" || difficulty==="normal"){
   return randomShuffle(makeDeck());
 }
 let best=null,bestDiff=Infinity;
 const wanted=cfg.target;
 // 每次候选牌局都来自新的随机洗牌。
 // 筛选只是提高目标难度概率，不会产生固定牌组。
 for(let i=0;i<700;i++){
   const d=randomShuffle(makeDeck());
   const m=difficultyMetric(d);
   const diff=Math.abs(m-wanted);
   if(diff<bestDiff){bestDiff=diff;best=d.slice()}
   if(diff<0.035)break;
 }
 return best;
}
function deal(){
 const deck=makeRandomDeal();
 tableau=Array.from({length:8},()=>[]);
 let k=0;
 for(let c=0;c<8;c++){
   const n=c<4?7:6;
   for(let i=0;i<n;i++)tableau[c].push(deck[k++]);
 }
 freecells=Array(CONFIG[difficulty].free).fill(null);
 foundations=[0,0,0,0];
}
function snapshot(){return JSON.stringify({tableau,freecells,foundations,moves})}
function restore(s){const x=JSON.parse(s);tableau=x.tableau;freecells=x.freecells;foundations=x.foundations;moves=x.moves;selected=null;render();updateStats()}
function save(){history.push(snapshot());if(history.length>100)history.shift()}
function undo(){if(gameOver||!history.length)return;restore(history.pop())}
function formatTime(v){let m=Math.floor(v/60),s=v%60;return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")}
function updateStats(){
 $("moves").textContent=moves;$("gameNo").textContent=gameNo;
 $("time").textContent=formatTime(Math.floor((Date.now()-startTime)/1000));
}
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
function newGame(){
 stopTimer();history=[];moves=0;selected=null;gameOver=false;gameNo++;
 deal();render();startTime=Date.now();updateStats();timer=setInterval(updateStats,500);hideOverlay();
}
function startFirst(){deal();render();startTime=Date.now();timer=setInterval(updateStats,500)}

function opposite(a,b){return a.suit.color!==b.suit.color}
function validSequence(col,start){
 for(let i=start;i<col.length-1;i++){
   if(!opposite(col[i],col[i+1])||col[i].rank!==col[i+1].rank+1)return false;
 }
 return true;
}
function maxMovable(){
 const emptyFree=freecells.filter(x=>!x).length;
 const emptyCols=tableau.filter(x=>x.length===0).length;
 return (emptyFree+1)*Math.pow(2,emptyCols);
}
function selectedCards(){
 if(!selected)return[];
 if(selected.source==="tableau")return tableau[selected.col].slice(selected.row);
 if(selected.source==="free")return freecells[selected.index]?[freecells[selected.index]]:[];
 return[];
}
function canDrop(type,index){
 const cards=selectedCards();if(!cards.length)return false;
 if(type==="free")return cards.length===1&&!freecells[index];
 if(type==="foundation"){
   return cards.length===1&&cards[0].rank===foundations[index]&&cards[0].suit.key===SUITS[index].key;
 }
 if(type==="tableau"){
   if(selected.source==="tableau"&&selected.col===index)return false;
   if(cards.length>maxMovable())return false;
   const col=tableau[index];
   if(!col.length)return true;
   const top=col[col.length-1];
   return opposite(cards[0],top)&&cards[0].rank===top.rank-1;
 }
 return false;
}
function doMove(type,index){
 const cards=selectedCards();if(!cards.length||!canDrop(type,index))return;
 save();
 if(selected.source==="tableau")tableau[selected.col].splice(selected.row);
 else freecells[selected.index]=null;
 if(type==="tableau")tableau[index].push(...cards);
 else if(type==="free")freecells[index]=cards[0];
 else foundations[index]=cards[0].rank+1;
 moves++;selected=null;render();checkWin();
}
function choose(type,index,row){
 if(gameOver)return;
 if(selected){
   if(canDrop(type,index)){doMove(type,index);return}
   if(selected.source===type&&selected.index===index&&selected.row===row){selected=null;render();return}
 }
 if(type==="tableau"){
   const col=tableau[index];row=row??col.length-1;
   if(row<0||!validSequence(col,row))return;
   if(col.length-row>maxMovable())return;
   selected={source:"tableau",index,col:index,row};
 }else if(type==="free"&&freecells[index]){
   selected={source:"free",index,row:0};
 }
 render();
}
function autoFoundation(type,index,row){
 if(gameOver)return;
 let card=null;
 if(type==="tableau")card=tableau[index][row];
 if(type==="free")card=freecells[index];
 if(!card)return;
 const fi=SUITS.findIndex(s=>s.key===card.suit.key);
 if(card.rank===foundations[fi]){
   selected=type==="tableau"?{source:"tableau",index,col:index,row}:{source:"free",index,row:0};
   doMove("foundation",fi);
 }
}
function cardEl(card,type,index,row){
 const e=document.createElement("div");e.className="card "+card.suit.color;
 e.dataset.type=type;e.dataset.index=index;if(row!==undefined)e.dataset.row=row;
 e.innerHTML=`<small>${RANKS[card.rank]}<br><em>${card.suit.name}</em></small><span class="center-suit">${card.suit.name}</span>`;
 e.addEventListener("click",ev=>{ev.stopPropagation();choose(type,index,row)});
 e.addEventListener("dblclick",ev=>{ev.stopPropagation();autoFoundation(type,index,row)});
 return e;
}
function render(){
 const fc=$("freecells"),fd=$("foundations"),tb=$("tableau");
 fc.innerHTML="";fd.innerHTML="";tb.innerHTML="";
 for(let i=0;i<CONFIG[difficulty].free;i++){
   const s=document.createElement("div");s.className="slot";
   if(freecells[i])s.appendChild(cardEl(freecells[i],"free",i,0));else s.textContent="空当";
   s.addEventListener("click",()=>choose("free",i,0));fc.appendChild(s);
 }
 for(let i=0;i<4;i++){
   const s=document.createElement("div");s.className="slot";
   s.innerHTML=`<span class="foundation-label">${SUITS[i].name}</span>`;
   if(foundations[i])s.appendChild(cardEl({suit:SUITS[i],rank:foundations[i]-1},"foundation",i,0));
   s.addEventListener("click",()=>{if(selected)doMove("foundation",i)});fd.appendChild(s);
 }
 tableau.forEach((col,ci)=>{
   const c=document.createElement("div");c.className="column";
   c.addEventListener("click",e=>{if(e.target===c)choose("tableau",ci,col.length-1)});
   col.forEach((card,ri)=>{
     const e=cardEl(card,"tableau",ci,ri);
     if(selected&&selected.source==="tableau"&&selected.col===ci&&ri>=selected.row)e.classList.add("selected");
     c.appendChild(e);
   });
   tb.appendChild(c);
 });
}
function checkWin(){
 if(foundations.every(x=>x===13)){
   gameOver=true;stopTimer();
   $("overlayTitle").textContent="恭喜通关！";
   $("overlayText").textContent=`难度：${CONFIG[difficulty].label}　局号：${gameNo}　步数：${moves}　用时：${$("time").textContent}`;
   $("overlayBtn").textContent="再来一局";showOverlay();
 }
}
function showOverlay(){$("overlay").classList.add("show")}
function hideOverlay(){$("overlay").classList.remove("show")}

$("undoBtn").onclick=undo;
$("newGameBtn").onclick=newGame;
$("overlayBtn").onclick=newGame;
$("difficulty").onchange=e=>{
 difficulty=e.target.value;
 gameNo=0;
 newGame();
};
document.addEventListener("keydown",e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}
});
startFirst();
