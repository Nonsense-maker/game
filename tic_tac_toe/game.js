const boardEl=document.getElementById("board");
const cells=[...document.querySelectorAll(".cell")];
const statusEl=document.getElementById("status");
const difficultyEl=document.getElementById("difficulty");
const restartBtn=document.getElementById("restart");
const newRoundBtn=document.getElementById("newRound");
const playerScoreEl=document.getElementById("playerScore");
const aiScoreEl=document.getElementById("aiScore");

let board=Array(9).fill("");
let gameOver=false;
let playerTurn=true;
let scores={player:0,ai:0};
let aiTimer=null;

const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function winner(b){
  for(const line of wins){
    const [a,c,d]=line;
    if(b[a]&&b[a]===b[c]&&b[a]===b[d]) return {mark:b[a],line};
  }
  if(b.every(Boolean)) return {mark:"draw",line:[]};
  return null;
}
function empty(b){return b.map((v,i)=>v?null:i).filter(i=>i!==null)}
function render(){
  cells.forEach((cell,i)=>{
    cell.textContent=board[i];
    cell.className="cell"+(board[i]==="X"?" x":"")+(board[i]==="O"?" o":"");
    cell.disabled=gameOver||!playerTurn||!!board[i];
  });
  const result=winner(board);
  if(result&&result.line) result.line.forEach(i=>cells[i].classList.add("win"));
  playerScoreEl.textContent=scores.player;
  aiScoreEl.textContent=scores.ai;
}
function setStatus(text){statusEl.textContent=text}
function finish(result){
  gameOver=true;
  if(result.mark==="X"){scores.player++;setStatus("你赢了！")}
  else if(result.mark==="O"){scores.ai++;setStatus("AI 赢了")}
  else setStatus("平局");
  render();
}
function playerMove(i){
  if(gameOver||!playerTurn||board[i])return;
  board[i]="X";
  const result=winner(board);
  if(result){finish(result);return}
  playerTurn=false;
  setStatus("AI 思考中…");
  render();
  aiTimer=setTimeout(aiMove,520);
}
function randomMove(b){const e=empty(b);return e[Math.floor(Math.random()*e.length)]}
function findWinningMove(b,mark){
  for(const i of empty(b)){b[i]=mark;const w=winner(b);b[i]="";if(w&&w.mark===mark)return i}
  return null;
}
function minimax(b,isMax){
  const r=winner(b);
  if(r){return r.mark==="O"?10:r.mark==="X"?-10:0}
  if(isMax){
    let best=-Infinity;
    for(const i of empty(b)){b[i]="O";best=Math.max(best,minimax(b,false));b[i]=""}
    return best;
  }else{
    let best=Infinity;
    for(const i of empty(b)){b[i]="X";best=Math.min(best,minimax(b,true));b[i]=""}
    return best;
  }
}
function hardMove(){
  let best=-Infinity,move=null;
  for(const i of empty(board)){board[i]="O";const score=minimax(board,false);board[i]="";if(score>best){best=score;move=i}}
  return move;
}
function aiMove(){
  aiTimer=null;
  if(gameOver)return;
  const e=empty(board);
  if(!e.length)return;
  let move;
  const difficulty=difficultyEl.value;
  if(difficulty==="hard"){
    move=hardMove();
  }else if(difficulty==="normal"){
    move=findWinningMove(board,"O");
    if(move===null)move=findWinningMove(board,"X");
    if(move===null&&board[4]==="")move=4;
    if(move===null&&Math.random()<.65)move=randomMove(board);
    if(move===null)move=randomMove(board);
  }else{
    move=findWinningMove(board,"O");
    if(move===null&&Math.random()<.45)move=findWinningMove(board,"X");
    if(move===null)move=randomMove(board);
  }
  board[move]="O";
  const result=winner(board);
  if(result){finish(result);return}
  playerTurn=true;
  setStatus("轮到你");
  render();
}
function resetRound(){
  if(aiTimer){clearTimeout(aiTimer);aiTimer=null}
  board=Array(9).fill("");
  gameOver=false;
  playerTurn=true;
  setStatus("轮到你");
  render();
}
cells.forEach((cell,i)=>cell.addEventListener("click",()=>playerMove(i)));
restartBtn.addEventListener("click",resetRound);
newRoundBtn.addEventListener("click",resetRound);
difficultyEl.addEventListener("change",resetRound);
render();
