const CONFIG = {
  playerName: "你",
  aiNames: ["建国", "谦礼", "谨珍"],
  cardsPerPlayer: 7,
  aiThinkMin: 1300,
  aiThinkMax: 2600,
  difficulty: "normal"
};

const COLORS = ["red","yellow","green","blue"];
const SYMBOL = {
  skip:"⊘", reverse:"↻", draw2:"+2", wild:"★", draw4:"+4"
};

let deck=[], hands=[[],[],[],[]], discard=[];
let current=0, direction=1, running=false;
let pendingUno=false, waitingWild=null, lastDrawnPlayable=false;
let pendingPenalty=0, pendingPenaltyColor=null, pendingPenaltyBy=null;
let unoWindow=null;          // {player, called, card}
let unoCatchWindow=false;    // user can catch an AI that forgot UNO
let difficulty="normal";

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function makeDeck(){
  const d=[];
  for(const color of COLORS){
    d.push({color,type:"number",value:0});
    for(let n=1;n<=9;n++){
      d.push({color,type:"number",value:n});
      d.push({color,type:"number",value:n});
    }
    for(let i=0;i<2;i++){
      d.push({color,type:"skip"}); d.push({color,type:"reverse"}); d.push({color,type:"draw2"});
    }
  }
  for(let i=0;i<4;i++){ d.push({color:null,type:"wild"}); d.push({color:null,type:"draw4"}); }
  return d;
}

function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
}

function nextPlayer(from=current){
  // Screen seats, clockwise: bottom(0) -> left(3) -> top(1) -> right(2) -> bottom(0)
  const clockwise = {0:3, 3:1, 1:2, 2:0};
  const counterClockwise = {0:2, 2:1, 1:3, 3:0};
  const order = direction===1 ? clockwise : counterClockwise;

  let p=from;
  for(let i=0;i<4;i++){
    p=order[p];
    if(hands[p].length>0) return p;
  }
  return p;
}

function activeTop(){
  return discard[discard.length-1];
}

function cardPlayable(card, player=current){
  const top=activeTop();
  if(!top) return true;

  // 罚牌叠加：只要颜色相同，+2 和 +4 可以互相叠加。
  // Wild +4 已经在选色后写入 card.color，因此下一家可以用对应颜色的 +2/+4 接牌。
  if(pendingPenalty>0){
    // Wild +4 can directly continue any +2/+4 stack.
    // Its color is chosen only after the card is played.
    if(card.type==="draw4" && card.color===null) return true;

    // Colored +2 / +4 can continue the stack only when their color
    // matches the currently selected stack color.
    if(card.type!=="draw2" && card.type!=="draw4") return false;
    return card.color===pendingPenaltyColor;
  }

  if(card.type==="draw4"){
    return !hands[player].some(c=>c.color===top.color && c.color!==null);
  }
  if(card.color===null) return true;
  return card.color===top.color ||
         (card.type===top.type && card.type!=="number") ||
         (card.type==="number" && top.type==="number" && card.value===top.value);
}

function drawOne(player){
  refillDeck();
  if(!deck.length) return null;
  const c=deck.pop();
  hands[player].push(c);
  return c;
}

function refillDeck(){
  if(deck.length>0 || discard.length<=1) return;
  const top=discard.pop();
  deck=discard.splice(0);
  shuffle(deck);
  discard=[top];
}

function renderCard(card, clickable=false, index=-1){
  const el=document.createElement("div");
  const cls=card.color ? card.color : "wild";
  el.className=`card ${cls}`;
  const sym=card.type==="number" ? card.value : SYMBOL[card.type];
  el.innerHTML=`<span class="corner tl">${sym}</span><span class="symbol">${sym}</span><span class="corner br">${sym}</span>`;
  if(clickable){
    if(cardPlayable(card,0)) el.classList.add("playable");
    else el.classList.add("disabled");
    el.addEventListener("click",()=>playerPlay(index));
  }
  return el;
}

function renderBack(){
  const el=document.createElement("div");
  el.className="ai-card";
  return el;
}

function resetUnoButton(){
  const btn=$("unoBtn");
  if(!btn) return;
  btn.classList.remove("uno-ready","uno-called","uno-catch");
  btn.textContent="UNO";
}

function showUnoButton(mode){
  const btn=$("unoBtn");
  if(!btn) return;
  btn.classList.remove("uno-ready","uno-called","uno-catch");
  if(mode==="ready"){
    btn.textContent="喊 UNO";
    btn.classList.add("uno-ready");
  }else if(mode==="called"){
    btn.textContent="UNO ✓";
    btn.classList.add("uno-called");
  }else if(mode==="catch"){
    btn.textContent="抓 UNO";
    btn.classList.add("uno-catch");
  }else{
    btn.textContent="UNO";
  }
}

function addPenalty(player,n,reason){
  for(let i=0;i<n;i++) drawOne(player);
  setStatus(`${nameOf(player)}没喊 UNO，罚摸 ${n} 张`);
  render();
}

function startUnoWindowForPlayer(player, card, after){
  unoWindow={player,called:false,card,after};
  if(player===0){
    showUnoButton("ready");
    setStatus("只剩 1 张！记得喊 UNO！");
    render();
    setTimeout(()=>{
      if(!running || !unoWindow || unoWindow.player!==0) return;
      const called=unoWindow.called;
      unoWindow=null;
      resetUnoButton();
      if(!called) addPenalty(0,2,"");
      after();
    },1800);
  }else{
    // AI occasionally forgets UNO.
    const forgetChance=difficulty==="hard" ? 0.18 : difficulty==="easy" ? 0.38 : 0.28;
    const forget=Math.random()<forgetChance;
    if(forget){
      unoCatchWindow=true;
      showUnoButton("catch");
      setStatus(`${nameOf(player)}只剩 1 张，但好像忘了喊 UNO…`);
      render();
      setTimeout(()=>{
        if(!running || !unoWindow || unoWindow.player!==player) return;
        if(unoCatchWindow){
          unoCatchWindow=false;
          unoWindow=null;
          resetUnoButton();
          setStatus(`${nameOf(player)}侥幸没被抓到`);
          render();
          after();
        }
      },1800);
    }else{
      unoWindow.called=true;
      setStatus(`${nameOf(player)}：UNO！`);
      render();
      setTimeout(()=>{
        if(!running || !unoWindow || unoWindow.player!==player) return;
        unoWindow=null;
        after();
      },700);
    }
  }
}

function render(){
  const deckCount = document.getElementById("deckCount");
  if(deckCount) deckCount.textContent = `${deck.length} 张`;
  for(let p=0;p<4;p++){
    const handEl=$(`hand-${p}`);
    handEl.innerHTML="";
    if(p===0){
      hands[p].forEach((c,i)=>handEl.appendChild(renderCard(c,true,i)));
    }else{
      hands[p].forEach(()=>handEl.appendChild(renderBack()));
    }
    $(`count-${p}`).textContent=`${hands[p].length} 张`;
    $(`player-${p}`).classList.toggle("active",p===current && running);
    $(`player-${p}`).classList.toggle("thinking-now",p===current && running && p!==0);
  }

  const top=activeTop();
  $("discardPile").innerHTML="";
  if(top) $("discardPile").appendChild(renderCard(top));

  $("turnText").textContent=running ? `当前出牌：${nameOf(current)}` : "准备开始";
  $("turnArrow").style.transform=`translate(-50%,-50%) rotate(${direction===1?0:180}deg)`;
  if(unoCatchWindow && unoWindow && unoWindow.player!==0){
    showUnoButton("catch");
  }else if(unoWindow && unoWindow.player===0 && !unoWindow.called){
    showUnoButton("ready");
  }
}

function nameOf(p){ return p===0 ? "你" : CONFIG.aiNames[p-1]; }

function setStatus(text){ $("status").textContent=text; }

function startGame(){
  difficulty=$("difficulty").value;
  deck=makeDeck(); shuffle(deck);
  hands=[[],[],[],[]]; discard=[]; current=0; direction=1; running=true;
  pendingUno=false; waitingWild=null; lastDrawnPlayable=false;
  pendingPenalty=0; pendingPenaltyColor=null; pendingPenaltyBy=null;
  unoWindow=null; unoCatchWindow=false; resetUnoButton();
  for(let p=0;p<4;p++) for(let i=0;i<CONFIG.cardsPerPlayer;i++) drawOne(p);
  let first=deck.pop();
  while(first.type==="draw4" || first.type==="draw2" || first.type==="skip" || first.type==="reverse" || first.color===null){
    deck.unshift(first); shuffle(deck); first=deck.pop();
  }
  discard.push(first);
  $("startModal").classList.remove("show");
  $("roundText").textContent="第 1 局";
  setStatus("你的回合，请出牌");
  render();
}

function canUseDraw4(card,player){
  return card.type==="draw4" && !hands[player].some(c=>c.color===activeTop()?.color && c.color!==null);
}

function playerPlay(index){
  if(!running || current!==0 || waitingWild || unoCatchWindow) return;
  const card=hands[0][index];
  if(!card || !cardPlayable(card,0)) return;

  hands[0].splice(index,1);
  discard.push(card);
  pendingUno=false;
  setStatus(card.type==="wild"||card.type==="draw4" ? "请选择颜色" : "出牌成功");
  render();

  if(hands[0].length===0){ finish(0); return; }

  const continueTurn=()=>{
    if(card.type==="wild" || card.type==="draw4"){
      waitingWild={player:0,card};
      $("colorModal").classList.add("show");
      return;
    }
    applyEffect(card,0);
  };

  if(hands[0].length===1){
    startUnoWindowForPlayer(0,card,continueTurn);
  }else{
    continueTurn();
  }
}

function chooseWildColor(color){
  if(!waitingWild) return;
  const {player,card}=waitingWild;
  card.color=color;
  waitingWild=null;
  $("colorModal").classList.remove("show");
  setStatus(`颜色变为${colorName(color)}`);
  render();
  applyEffect(card,player);
}

function colorName(c){ return {red:"红色",yellow:"黄色",green:"绿色",blue:"蓝色"}[c]; }

function applyEffect(card,playedBy){
  // +2 / +4 开始或继续累计罚牌。
  if(card.type==="draw2" || card.type==="draw4"){
    if(pendingPenalty===0){
      pendingPenalty = card.type==="draw2" ? 2 : 4;
    }else{
      pendingPenalty += card.type==="draw2" ? 2 : 4;
    }

    pendingPenaltyColor = card.color;
    pendingPenaltyBy = playedBy;

    const target=nextPlayer(playedBy);
    current=target;
    render();

    if(hands[target].length===0){ finish(target); return; }

    setStatus(`${nameOf(target)}可叠加同色 +2 / +4，或直接出变色 +4，否则摸 ${pendingPenalty} 张`);
    if(current===0){
      render();
    }else{
      aiTurn();
    }
    return;
  }

  let target=nextPlayer(playedBy);

  if(card.type==="skip"){
    target=nextPlayer(target);
  }else if(card.type==="reverse"){
    direction*=-1;
    target=nextPlayer(playedBy);
  }

  current=target;
  render();

  if(hands[target].length===0){ finish(target); return; }

  if(current===0){
    setStatus(pendingPenalty>0
      ? `轮到你：可叠加同色 +2 / +4，或出变色 +4，否则摸 ${pendingPenalty} 张`
      : "轮到你出牌");
    render();
  }else{
    aiTurn();
  }
}

function drawCards(player,n){
  for(let i=0;i<n;i++) drawOne(player);
  setStatus(`${nameOf(player)}被迫摸${n}张牌`);
  render();
}

function playerDraw(){
  if(!running || current!==0 || waitingWild) return;

  if(pendingPenalty>0){
    const amount=pendingPenalty;
    drawCards(0,amount);
    pendingPenalty=0;
    pendingPenaltyColor=null;
    pendingPenaltyBy=null;
    current=nextPlayer(0);
    render();
    if(current!==0) aiTurn(); else setStatus("轮到你出牌");
    return;
  }

  const c=drawOne(0);
  lastDrawnPlayable=!!c && cardPlayable(c,0);
  setStatus(c ? (lastDrawnPlayable ? "摸到一张可以出的牌，可以选择打出" : "摸牌后无法出牌，轮到下一家") : "牌堆已空");
  render();

  if(c && lastDrawnPlayable) return;

  current=nextPlayer(0);
  render();
  if(current!==0) aiTurn();
}

function aiTurn(){
  if(!running || current===0) return;
  const p=current;
  const min=CONFIG.aiThinkMin + (difficulty==="hard"?300:0);
  const max=CONFIG.aiThinkMax + (difficulty==="easy"?-250:0);
  const delay=Math.floor(min+Math.random()*(max-min));

  $(`player-${p}`).classList.add("thinking-now");
  setStatus(`轮到${nameOf(p)} · 正在思考…`);
  render();

  setTimeout(()=>{
    if(!running || current!==p) return;

    if(pendingPenalty>0){
      const playable=hands[p].map((c,i)=>({c,i})).filter(x=>cardPlayable(x.c,p));

      if(playable.length){
        const choice=chooseAiCard(playable,p);
        aiPlay(p,choice.i);
        return;
      }

      const amount=pendingPenalty;
      drawCards(p,amount);
      pendingPenalty=0;
      pendingPenaltyColor=null;
      pendingPenaltyBy=null;
      current=nextPlayer(p);
      render();
      if(current!==0) aiTurn(); else setStatus("轮到你出牌");
      return;
    }

    let playable=hands[p].map((c,i)=>({c,i})).filter(x=>cardPlayable(x.c,p));
    if(!playable.length){
      const c=drawOne(p);
      render();
      setStatus(`${nameOf(p)}摸了一张牌`);
      if(c && cardPlayable(c,p)){
        setTimeout(()=>aiPlay(p,hands[p].indexOf(c)),500+Math.random()*700);
      }else{
        current=nextPlayer(p);
        render();
        if(current!==0) aiTurn(); else setStatus("轮到你出牌");
      }
      return;
    }

    let choice=chooseAiCard(playable,p);
    aiPlay(p,choice.i);
  },delay);
}

function chooseAiCard(playable,p){
  if(difficulty==="easy") return playable[Math.floor(Math.random()*playable.length)];
  let scored=playable.map(x=>{
    let s=Math.random()*5;
    if(x.c.type==="draw4") s+=difficulty==="hard"?8:3;
    if(x.c.type==="draw2") s+=6;
    if(x.c.type==="skip"||x.c.type==="reverse") s+=3;
    if(x.c.color===null) s+=2;
    if(hands[p].length<=2) s+=10;
    return {...x,s};
  });
  scored.sort((a,b)=>b.s-a.s);
  return scored[0];
}

function aiPlay(p,index){
  const card=hands[p][index];
  if(!card || !cardPlayable(card,p)) return;

  hands[p].splice(index,1);
  discard.push(card);
  setStatus(`${nameOf(p)}出了 ${cardText(card)}`);
  render();

  if(hands[p].length===0){ finish(p); return; }

  const continueTurn=()=>{
    if(card.type==="wild" || card.type==="draw4"){
      const color=chooseAiColor(p);
      card.color=color;
      setStatus(`${nameOf(p)}把颜色变成${colorName(color)}`);
      render();
    }
    setTimeout(()=>applyEffect(card,p),500+Math.random()*500);
  };

  if(hands[p].length===1){
    startUnoWindowForPlayer(p,card,continueTurn);
  }else{
    continueTurn();
  }
}

function chooseAiColor(p){
  const counts={red:0,yellow:0,green:0,blue:0};
  hands[p].forEach(c=>{if(c.color) counts[c.color]++});
  return COLORS.sort((a,b)=>counts[b]-counts[a])[0];
}

function cardText(c){
  if(c.type==="number") return `${colorName(c.color)} ${c.value}`;
  return SYMBOL[c.type];
}

function pressUno(){
  if(!running) return;

  // Catch an AI that forgot to call UNO.
  if(unoCatchWindow && unoWindow && unoWindow.player!==0){
    const target=unoWindow.player;
    unoCatchWindow=false;
    unoWindow=null;
    resetUnoButton();
    drawCards(target,2);
    setStatus(`抓到${nameOf(target)}没喊 UNO！罚摸 2 张`);
    render();

    const playedBy=target;
    current=nextPlayer(playedBy);
    if(current===0){
      setStatus("轮到你出牌");
      render();
    }else{
      aiTurn();
    }
    return;
  }

  if(current!==0 || !unoWindow || unoWindow.player!==0){
    setStatus("现在不能喊 UNO");
    return;
  }

  if(hands[0].length===1 && !unoWindow.called){
    unoWindow.called=true;
    pendingUno=true;
    showUnoButton("called");
    setStatus("UNO！成功报 UNO");
    render();
  }else{
    setStatus("现在不能喊 UNO");
  }
}

function finish(winner){
  running=false;
  unoWindow=null;
  unoCatchWindow=false;
  resetUnoButton();
  render();
  $("resultTitle").textContent=winner===0 ? "你赢了！" : `${nameOf(winner)}获胜`;
  $("resultText").textContent=winner===0 ? "恭喜你把手牌全部打完！" : `${nameOf(winner)}率先出完了所有牌。`;
  $("resultModal").classList.add("show");
}

$("startBtn").addEventListener("click",startGame);
$("againBtn").addEventListener("click",()=>{$("resultModal").classList.remove("show");startGame()});
$("restartBtn").addEventListener("click",()=>{if(confirm("确定重新开始吗？"))startGame()});
$("drawBtn").addEventListener("click",playerDraw);
$("drawPile").addEventListener("click",playerDraw);
$("unoBtn").addEventListener("click",pressUno);
document.querySelectorAll(".color-buttons button").forEach(btn=>{
  btn.addEventListener("click",()=>chooseWildColor(btn.dataset.color));
});

render();
