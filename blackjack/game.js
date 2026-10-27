const suits=[
  {s:"♠",c:"black"},{s:"♥",c:"red"},{s:"♦",c:"red"},{s:"♣",c:"black"}
];
const ranks=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
let deck=[], player=[], dealer=[], hiddenDealer=true;
let chips=1000, bet=0, inRound=false, playerDone=false, dealerBusy=false;

const $=id=>document.getElementById(id);
const chipsEl=$("chips"),betEl=$("bet"),deckEl=$("deckCount");
const dealerScoreEl=$("dealerScore"),playerScoreEl=$("playerScore");
const dealerCardsEl=$("dealerCards"),playerCardsEl=$("playerCards");
const messageEl=$("message"),resultEl=$("result");
const dealBtn=$("dealBtn"),hitBtn=$("hitBtn"),standBtn=$("standBtn"),doubleBtn=$("doubleBtn"),newRoundBtn=$("newRoundBtn");
const clearBet=$("clearBet");

function makeDeck(){
  const d=[];
  for(const suit of suits) for(const rank of ranks) d.push({suit:suit.s,c:suit.c,rank});
  return d;
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function freshDeck(){
  deck=shuffle(makeDeck());
  deckEl.textContent=deck.length;
}
function draw(){
  if(!deck.length) freshDeck();
  const c=deck.pop();
  deckEl.textContent=deck.length;
  return c;
}
function value(cards){
  let total=0, aces=0;
  for(const c of cards){
    if(c.rank==="A"){total+=11;aces++}
    else if(["K","Q","J"].includes(c.rank)) total+=10;
    else total+=Number(c.rank);
  }
  while(total>21 && aces){total-=10;aces--}
  return {total,soft:aces>0};
}
function blackjack(cards){return cards.length===2 && value(cards).total===21}
function renderCard(c,back=false){
  if(back) return `<div class="card back"></div>`;
  return `<div class="card ${c.c==='red'?'red':''}">
    <div class="corner"><span>${c.rank}</span><span>${c.suit}</span></div>
    <div class="suit-big">${c.suit}</div>
  </div>`;
}
function render(){
  dealerCardsEl.innerHTML=dealer.map((c,i)=>renderCard(c,hiddenDealer&&i===0)).join("");
  playerCardsEl.innerHTML=player.map(c=>renderCard(c)).join("");
  const pv=value(player);
  playerScoreEl.textContent=pv.total;
  dealerScoreEl.textContent=hiddenDealer?"?":value(dealer).total;
  chipsEl.textContent=chips;
  betEl.textContent=bet;
  deckEl.textContent=deck.length;
}
function setMessage(t){messageEl.textContent=t}
function enableActions(active){
  hitBtn.disabled=!active;
  standBtn.disabled=!active;
  doubleBtn.disabled=!active || player.length!==2 || chips<bet;
}
function addBet(n){
  if(inRound) return;
  const add=Math.min(n,chips-bet);
  if(add<=0) return;
  bet+=add; render();
  setMessage(`已下注 ${bet}，点击“开始游戏”`);
}
document.querySelectorAll(".chip-btn[data-bet]").forEach(b=>b.onclick=()=>addBet(Number(b.dataset.bet)));
clearBet.onclick=()=>{
  if(inRound)return;
  bet=0;render();setMessage("请下注开始游戏");
};

function deal(){
  if(inRound || bet<=0 || bet>chips) return;
  chips-=bet;
  player=[draw(),draw()];
  dealer=[draw(),draw()];
  hiddenDealer=true;inRound=true;playerDone=false;dealerBusy=false;
  resultEl.textContent="";
  render();
  if(blackjack(player)){
    playerDone=true;
    setTimeout(()=>settle("blackjack"),450);
  }else{
    setMessage("请选择：要牌 / 停牌 / 双倍");
    enableActions(true);
  }
}
dealBtn.onclick=deal;

function hit(){
  if(!inRound||playerDone||dealerBusy)return;
  player.push(draw());
  render();
  if(value(player).total>21){
    playerDone=true;enableActions(false);
    setTimeout(()=>settle("bust"),350);
  }else if(value(player).total===21){
    stand();
  }else{
    setMessage("继续要牌，或选择停牌");
    enableActions(true);
  }
}
hitBtn.onclick=hit;

function stand(){
  if(!inRound||playerDone||dealerBusy)return;
  playerDone=true;enableActions(false);
  setMessage("庄家正在补牌…");
  dealerTurn();
}
standBtn.onclick=stand;

function doubleDown(){
  if(!inRound||playerDone||player.length!==2||chips<bet)return;
  chips-=bet;bet*=2;
  player.push(draw());
  render();
  if(value(player).total>21){
    playerDone=true;enableActions(false);
    setTimeout(()=>settle("bust"),350);
  }else{
    playerDone=true;enableActions(false);
    setMessage("双倍下注后自动停牌，庄家行动…");
    dealerTurn();
  }
}
doubleBtn.onclick=doubleDown;

function dealerTurn(){
  dealerBusy=true;hiddenDealer=false;render();
  let steps=0;
  function step(){
    const v=value(dealer);
    if(v.total<17 || (v.total===17 && v.soft)){
      dealer.push(draw());render();steps++;
      setTimeout(step,500);
    }else{
      setTimeout(()=>settle("compare"),350);
    }
  }
  setTimeout(step,450);
}

function settle(reason){
  if(!inRound)return;
  hiddenDealer=false;
  const pv=value(player).total;
  const dv=value(dealer).total;
  let title="", text="", delta=0;

  if(reason==="blackjack"){
    chips += bet + Math.floor(bet*1.5);
    delta=Math.floor(bet*1.5);
    title="BLACKJACK！";
    text=`你以 Blackjack 获胜，赢得 ${delta} 筹码`;
  }else if(reason==="bust"){
    title="爆牌";
    text=`你的点数为 ${pv}，本局输掉 ${bet} 筹码`;
    delta=-bet;
  }else if(dv>21){
    chips += bet*2;
    delta=bet;
    title="庄家爆牌";
    text=`庄家 ${dv} 点爆牌，你赢得 ${bet} 筹码`;
  }else if(pv>dv){
    chips += bet*2;
    delta=bet;
    title="你赢了";
    text=`${pv} 点 > ${dv} 点，赢得 ${bet} 筹码`;
  }else if(pv<dv){
    delta=-bet;
    title="庄家获胜";
    text=`${dv} 点 > ${pv} 点，本局输掉 ${bet} 筹码`;
  }else{
    chips += bet;
    delta=0;
    title="平局";
    text=`双方都是 ${pv} 点，退回下注`;
  }

  inRound=false;dealerBusy=false;
  render();
  resultEl.textContent=title;
  setMessage(text);
  newRoundBtn.disabled=false;
  dealBtn.disabled=true;
  document.querySelectorAll(".chip-btn").forEach(b=>b.disabled=true);
  clearBet.disabled=true;
  showModal(title,text);
}
function showModal(title,text){
  $("modalTitle").textContent=title;
  $("modalText").textContent=text;
  $("resultModal").classList.remove("hidden");
  $("modalBtn").textContent=chips>0?"下一局":"重新开始";
}
function nextRound(){
  $("resultModal").classList.add("hidden");
  bet=0;render();
  if(chips<=0){
    chips=1000;bet=0;freshDeck();
    setMessage("筹码已用完，已重新获得 1000 筹码");
  }else{
    setMessage("请下注开始下一局");
  }
  newRoundBtn.disabled=true;
  dealBtn.disabled=false;
  document.querySelectorAll(".chip-btn").forEach(b=>b.disabled=false);
  clearBet.disabled=false;
  resultEl.textContent="";
  render();
}
newRoundBtn.onclick=nextRound;
$("modalBtn").onclick=nextRound;

function init(){
  freshDeck();
  render();
  setMessage("请下注开始游戏");
}
init();
