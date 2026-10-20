const SUITS=[
 {name:"♠",color:"black",key:"S"},{name:"♥",color:"red",key:"H"},
 {name:"♣",color:"black",key:"C"},{name:"♦",color:"red",key:"D"}
];
const RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
let tableau=[],stock=[],completed=0,moves=0,history=[],selected=null,startTime=0,timer=null,gameOver=false,difficulty=2;

const $=id=>document.getElementById(id);
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function createDeck(){
 const keys=difficulty===1?["S"]:difficulty===2?["S","H"]:["S","H","C","D"];
 const copies=104/(keys.length*13),d=[];
 for(const key of keys){
   const suit=SUITS.find(s=>s.key===key);
   for(let c=0;c<copies;c++)for(let r=1;r<=13;r++)d.push({suit,rank:r,faceUp:false,id:Math.random().toString(36).slice(2)});
 }
 return shuffle(d);
}
function newGame(){
 stopTimer();history=[];moves=0;completed=0;selected=null;gameOver=false;
 const deck=createDeck();tableau=Array.from({length:10},()=>[]);
 for(let i=0;i<54;i++){const col=i<4?i:i%10;tableau[col].push(deck.pop())}
 tableau.forEach(c=>c.forEach((x,i)=>x.faceUp=i===c.length-1));
 stock=deck;render();startTime=Date.now();timer=setInterval(updateStats,500);updateStats();hideOverlay()
}
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
function updateStats(){
 $("moves").textContent=moves;$("completed").textContent=completed+"/8";
 $("stock").textContent=stock.length;
 $("completedTop").textContent=completed;
 $("time").textContent=fmt(Math.floor((Date.now()-startTime)/1000));
 const disabled=stock.length<10;
 $("dealBtn").disabled=disabled;$("stockBtn").classList.toggle("disabled",disabled);
}
function fmt(t){return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0")}
function snapshot(){return JSON.stringify({tableau,stock,completed,moves})}
function save(){history.push(snapshot());if(history.length>100)history.shift()}
function undo(){if(gameOver||!history.length)return;const x=JSON.parse(history.pop());tableau=x.tableau;stock=x.stock;completed=x.completed;moves=x.moves;selected=null;render();updateStats()}
function validRun(col,start){
 if(!col[start]||!col[start].faceUp)return false;
 for(let i=start;i<col.length-1;i++){
   const a=col[i],b=col[i+1];
   if(!b.faceUp||a.rank!==b.rank+1||a.suit.key!==b.suit.key)return false
 }
 return true
}
function selectedRun(){return selected?tableau[selected.col].slice(selected.row):[]}
function canPlace(run,ci){if(!run.length)return false;const col=tableau[ci];if(!col.length)return true;const top=col[col.length-1];return top.faceUp&&top.rank===run[0].rank+1}
function chooseCard(ci,row){
 if(gameOver)return;
 const col=tableau[ci],card=col[row];if(!card||!card.faceUp)return;
 if(selected){
   const run=selectedRun();
   if(canPlace(run,ci)){moveRun(selected.col,selected.row,ci);return}
   if(selected.col===ci&&row>=selected.row){selected=null;render();return}
 }
 if(validRun(col,row)){selected={col:ci,row};render()}
}
function chooseColumn(ci){
 if(!selected)return;
 const run=selectedRun();
 if(canPlace(run,ci))moveRun(selected.col,selected.row,ci);
 else{selected=null;render()}
}
function moveRun(from,row,to){
 if(from===to){selected=null;render();return}
 save();const run=tableau[from].splice(row);tableau[to].push(...run);
 if(tableau[from].length)tableau[from].at(-1).faceUp=true;
 moves++;selected=null;removeCompleted();render();checkWin()
}
function removeCompleted(){
 for(let ci=0;ci<10;ci++){
   const col=tableau[ci];if(col.length<13)continue;
   const s=col.length-13,run=col.slice(s);let ok=run[0].rank===13;
   for(let i=0;i<13&&ok;i++)if(!run[i].faceUp||run[i].rank!==13-i||run[i].suit.key!==run[0].suit.key)ok=false;
   if(ok){col.splice(s,13);completed++;if(col.length)col.at(-1).faceUp=true}
 }
}
function deal(){
 if(stock.length<10)return;
 save();
 for(let i=0;i<10;i++){
   const c=stock.pop();
   c.faceUp=true;
   tableau[i].push(c);
 }
 moves++;
 selected=null;
 removeCompleted();
 render();
 checkWin();
}
function cardEl(card,ci,ri){
 const e=document.createElement("div");e.className="card "+(card.faceUp?card.suit.color:"face-down");
 if(card.faceUp)e.innerHTML=`<small>${RANKS[card.rank-1]}<br><em>${card.suit.name}</em></small><span class="center-suit">${card.suit.name}</span>`;
 e.addEventListener("click",ev=>{ev.stopPropagation();if(card.faceUp)chooseCard(ci,ri)});
 return e
}
function render(){
 const tb=$("tableau");tb.innerHTML="";
 tableau.forEach((col,ci)=>{
   const c=document.createElement("div");c.className="column";
   c.addEventListener("click",()=>chooseColumn(ci));
   col.forEach((card,ri)=>{
     const e=cardEl(card,ci,ri);
     if(selected&&selected.col===ci&&ri>=selected.row)e.classList.add("selected");
     e.style.zIndex=ri+1;c.appendChild(e)
   });tb.appendChild(c)
 });
 updateStats()
}
function checkWin(){
 if(completed===8){gameOver=true;stopTimer();$("overlayTitle").textContent="恭喜通关！";$("overlayText").textContent=`难度：${difficulty===1?"简单 · 1 花色":difficulty===2?"普通 · 2 花色":"困难 · 4 花色"}　步数：${moves}　用时：${$("time").textContent}`;$("overlayBtn").textContent="再来一局";showOverlay()}
}
function showOverlay(){$("overlay").classList.add("show")}function hideOverlay(){$("overlay").classList.remove("show")}
$("undoBtn").onclick=undo;$("newGameBtn").onclick=newGame;$("overlayBtn").onclick=newGame;
$("dealBtn").onclick=deal;$("stockBtn").onclick=deal;
$("difficulty").onchange=e=>{difficulty=Number(e.target.value);newGame()};
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}});
newGame();