const R=10,C=9;
const boardEl=document.getElementById('board'),turnEl=document.getElementById('turn'),movesEl=document.getElementById('moves'),statusEl=document.getElementById('status');
const modeScreen=document.getElementById('modeScreen'),overlay=document.getElementById('overlay'),resultEl=document.getElementById('result'),detailEl=document.getElementById('detail');
let b,turn,moves,history,selected=null,gameOver=false,thinking=false,mode='ai',difficulty=2;

const chars={r:{K:'帥',A:'仕',B:'相',N:'馬',R:'車',C:'炮',P:'兵'},b:{K:'將',A:'士',B:'象',N:'馬',R:'車',C:'砲',P:'卒'}};
function init(){
 b=initial();turn='r';moves=0;history=[];selected=null;gameOver=false;thinking=false;
 build();render();ui();overlay.classList.add('hidden');
}
function initial(){
 const x=Array.from({length:R},()=>Array(C).fill(null));
 const back=['R','N','B','A','K','A','B','N','R'];
 back.forEach((p,c)=>x[0][c]={c:'b',p});[1,7].forEach(c=>x[2][c]={c:'b',p:'C'});[0,2,4,6,8].forEach(c=>x[3][c]={c:'b',p:'P'});
 back.forEach((p,c)=>x[9][c]={c:'r',p});[1,7].forEach(c=>x[7][c]={c:'r',p:'C'});[0,2,4,6,8].forEach(c=>x[6][c]={c:'r',p:'P'});
 return x;
}
function build(){
 boardEl.innerHTML='';

 // The playable intersections are inset from the board frame.
 // 9 columns: x = 20, 127.5, ... 880
 // 10 rows: y = 20, 126.666..., ... 980
 const W=900,H=1000,x0=20,x1=880,y0=20,y1=980;
 const dx=(x1-x0)/8, dy=(y1-y0)/9;

 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('class','board-svg');
 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
 svg.setAttribute('preserveAspectRatio','none');

 const line=(x1,y1,x2,y2)=>{
   const l=document.createElementNS('http://www.w3.org/2000/svg','line');
   l.setAttribute('x1',x1);l.setAttribute('y1',y1);
   l.setAttribute('x2',x2);l.setAttribute('y2',y2);
   l.setAttribute('stroke','#a9352b');l.setAttribute('stroke-width','2');
   l.setAttribute('vector-effect','non-scaling-stroke');
   svg.appendChild(l);
 };

 // 上半盘：5条横线；下半盘：5条横线。
 // 河界中间整整留出一行宽度，不再有中间横线，也没有竖线。
 for(let r=0;r<=4;r++){
   const y=y0+r*dy;
   for(let c=0;c<8;c++) line(x0+c*dx,y,x0+(c+1)*dx,y);
 }
 for(let r=5;r<=9;r++){
   const y=y0+r*dy;
   for(let c=0;c<8;c++) line(x0+c*dx,y,x0+(c+1)*dx,y);
 }

 // 竖线在河界断开，只画上下两段。
 for(let c=0;c<9;c++){
   const x=x0+c*dx;
   line(x,y0,x, y0+4*dy);
   line(x,y0+5*dy,x,y1);
 }

 // 九宫格：斜线端点精确落在交叉点。
 line(x0+3*dx,y0,x0+5*dx,y0+2*dy);
 line(x0+5*dx,y0,x0+3*dx,y0+2*dy);
 line(x0+3*dx,y1,x0+5*dx,y0+7*dy);
 line(x0+5*dx,y1,x0+3*dx,y0+7*dy);

 boardEl.appendChild(svg);

 // 河界文字正好放在唯一的空白行内。
 const rt=document.createElement('div');
 rt.className='river river-top';
 rt.textContent='楚 河';
 boardEl.appendChild(rt);
 const rb=document.createElement('div');
 rb.className='river river-bottom';
 rb.textContent='汉 界';
 boardEl.appendChild(rb);

 // 炮位、兵位的传统十字标记，全部与交叉点重合。
 const marks=[
   [2,1,'all'],[2,7,'all'],
   [3,0,'right'],[3,2,'all'],[3,4,'all'],[3,6,'all'],[3,8,'left'],
   [6,0,'right'],[6,2,'all'],[6,4,'all'],[6,6,'all'],[6,8,'left'],
   [7,1,'all'],[7,7,'all']
 ];
 marks.forEach(([r,c,kind])=>{
   const m=document.createElement('i');
   m.className='mark '+kind;
   m.style.left=((x0+c*dx)/W*100)+'%';
   m.style.top=((y0+r*dy)/H*100)+'%';
   boardEl.appendChild(m);
 });

 // 棋子点击区域与棋盘交叉点使用同一套坐标，避免错位。
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){
   const x=document.createElement('div');
   x.className='cell empty';
   x.dataset.r=r;x.dataset.c=c;
   x.style.left=((x0+c*dx)/W*100)+'%';
   x.style.top=((y0+r*dy)/H*100)+'%';
   x.onclick=()=>clickCell(r,c);
   boardEl.appendChild(x);
 }
}
function clone(){return b.map(row=>row.map(x=>x?{...x}:null))}
function render(){
 boardEl.querySelectorAll('.cell').forEach(x=>{
  const r=+x.dataset.r,c=+x.dataset.c,p=b[r][c];x.className='cell '+(p?(p.c==='r'?'red':'black'):'empty');
  x.textContent=p?chars[p.c][p.p]:'';
  if(selected&&selected[0]===r&&selected[1]===c)x.classList.add('selected');
  if(selected&&legal(selected[0],selected[1],r,c,true))x.classList.add('target');
 });
}
function clickCell(r,c){
 if(gameOver||thinking||(mode==='ai'&&turn!=='r'))return;
 const p=b[r][c];
 if(selected){
  if(legal(selected[0],selected[1],r,c,false)){move(selected[0],selected[1],r,c);return}
  if(p&&p.c===turn){selected=[r,c];render();return}
  selected=null;render();return;
 }
 if(p&&p.c===turn){selected=[r,c];render()}
}
function inside(r,c){return r>=0&&r<R&&c>=0&&c<C}
function pathClear(r1,c1,r2,c2){
 let dr=Math.sign(r2-r1),dc=Math.sign(c2-c1),r=r1+dr,c=c1+dc,n=0;
 while(r!==r2||c!==c2){if(b[r][c])n++;r+=dr;c+=dc}return n;
}
function pseudo(r1,c1,r2,c2){
 const q=b[r1][c1],t=b[r2][c2];if(!q||q.c!==turn)return false;if(t&&t.c===q.c)return false;
 const dr=r2-r1,dc=c2-c1;
 if(q.p==='R')return (dr===0||dc===0)&&pathClear(r1,c1,r2,c2)===0;
 if(q.p==='C')return (dr===0||dc===0)&&pathClear(r1,c1,r2,c2)===(t?1:0);
 if(q.p==='N'){if(!((Math.abs(dr)===2&&Math.abs(dc)===1)||(Math.abs(dr)===1&&Math.abs(dc)===2)))return false;let br=r1+(Math.abs(dr)===2?dr/2:0),bc=c1+(Math.abs(dc)===2?dc/2:0);return !b[br][bc]}
 if(q.p==='B'){if(Math.abs(dr)!==2||Math.abs(dc)!==2)return false;if(q.c==='r'&&r2<5||q.c==='b'&&r2>4)return false;return !b[r1+dr/2][c1+dc/2]}
 if(q.p==='A'){
  if(Math.abs(dr)!==1||Math.abs(dc)!==1)return false;
  if(q.c==='r') return r2>=7&&r2<=9&&c2>=3&&c2<=5;
  if(q.c==='b') return r2>=0&&r2<=2&&c2>=3&&c2<=5;
  return false;
}
 if(q.p==='K'){
  if(Math.abs(dr)+Math.abs(dc)!==1)return false;
  return q.c==='r'?r2>=7&&c2>=3&&c2<=5:r2<=2&&c2>=3&&c2<=5;
 }
 if(q.p==='P'){
  const forward=q.c==='r'?-1:1,river=q.c==='r'?r1<=4:r1>=5;
  if(dc===0&&dr===forward)return true;
  if(river&&Math.abs(dc)===1&&dr===0)return true;
 }
 return false;
}
function legal(r1,c1,r2,c2,preview=false){
 if(!pseudo(r1,c1,r2,c2))return false;
 const save=b.map(row=>row.map(x=>x?{...x}:null)),q=b[r1][c1],target=b[r2][c2];
 b[r2][c2]=q;b[r1][c1]=null;
 const bad=inCheck(q.c);
 b=save;return !bad;
}
function findKing(side){for(let r=0;r<R;r++)for(let c=0;c<C;c++)if(b[r][c]?.c===side&&b[r][c].p==='K')return[r,c];return null}
function inCheck(side){
 const k=findKing(side);if(!k)return true;
 const enemy=side==='r'?'b':'r';
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){
  if(b[r][c]?.c!==enemy)continue;
  if(pseudoFor(r,c,k[0],k[1],enemy))return true;
 }
 // 飞将：两将同列且中间没有任何棋子时，双方都处于将军状态。
 const ek=findKing(enemy);
 if(ek&&ek[1]===k[1]){
  const lo=Math.min(ek[0],k[0])+1,hi=Math.max(ek[0],k[0]);
  let blocked=false;
  for(let r=lo;r<hi;r++)if(b[r][k[1]]){blocked=true;break}
  if(!blocked)return true;
 }
 return false;
}
function pseudoFor(r1,c1,r2,c2,side){
 const q=b[r1][c1],old=turn;turn=side;let v=pseudo(r1,c1,r2,c2);turn=old;return v;
}
function allMoves(side){
 const old=turn;turn=side;const a=[];
 for(let r=0;r<R;r++)for(let c=0;c<C;c++)if(b[r][c]?.c===side){
  for(let rr=0;rr<R;rr++)for(let cc=0;cc<C;cc++)if(legal(r,c,rr,cc))a.push([r,c,rr,cc]);
 }
 turn=old;return a;
}
function move(r1,c1,r2,c2){
 const before=clone(),captured=b[r2][c2];
 history.push({before,turn,last:selected});
 b[r2][c2]=b[r1][c1];b[r1][c1]=null;selected=null;moves++;
 const side=turn;turn=side==='r'?'b':'r';
 render();
 const enemyMoves=allMoves(turn),enemyIn=inCheck(turn);
 if(!findKing(turn)){finish(side,'将对方帅/将军吃掉');return}
 if(enemyIn&&!enemyMoves.length){finish(side,'将死');return}
 if(!enemyIn&&!enemyMoves.length){finish(side,'困毙');return}
 ui();
 if(mode==='ai'&&turn==='b'){thinking=true;ui();setTimeout(aiMove,100)}
}
function aiMove(){
 if(gameOver){thinking=false;return}
 const arr=allMoves('b');if(!arr.length){finish('r',inCheck('b')?'将死':'困毙');return}
 const scored=arr.map(m=>({m,s:evalMove(m)})).sort((a,z)=>z.s-a.s);
 const n=difficulty===1?14:difficulty===2?6:difficulty===3?2:1;
 const pick=scored[Math.floor(Math.random()*Math.min(n,scored.length))].m;
 thinking=false;move(...pick);
}
function evalMove(m){
 const [r1,c1,r2,c2]=m,q=b[r1][c1],t=b[r2][c2];let s=Math.random()*(difficulty===1?30:3);
 const val={P:100,C:450,N:400,B:200,A:200,R:900,K:10000};
 if(t)s+=val[t.p]*1.4;
 s+=val[q.p]*.05;
 if(t?.p==='K')s+=100000;
 if(r2>=4&&r2<=6)s+=10;
 return s;
}
function undo(){
 if(gameOver||thinking||!history.length)return;
 let h=history.pop();b=h.before;turn=h.turn;selected=null;moves--;
 if(mode==='ai'&&history.length){h=history.pop();b=h.before;turn=h.turn;moves--}
 render();ui();
}
function finish(w,reason){gameOver=true;thinking=false;resultEl.textContent=w==='r'?'红方获胜':'黑方获胜';detailEl.textContent=reason+'，本局结束。';render();ui();overlay.classList.remove('hidden')}
function ui(){turnEl.textContent=mode==='ai'?(turn==='r'?'你（红方）':'电脑（黑方）'):(turn==='r'?'红方':'黑方');movesEl.textContent=moves;statusEl.textContent=gameOver?'本局结束':thinking?'电脑思考中…':(mode==='ai'?(turn==='r'?'轮到你走棋':'电脑走棋'):(turn==='r'?'红方走棋':'黑方走棋'))}
document.getElementById('aiMode').onclick=()=>{mode='ai';modeScreen.style.display='none';init()}
document.getElementById('pvpMode').onclick=()=>{mode='pvp';modeScreen.style.display='none';init()}
document.getElementById('difficulty').onchange=e=>{difficulty=+e.target.value;if(mode==='ai')init()}
document.getElementById('new').onclick=init;document.getElementById('again').onclick=init;document.getElementById('undo').onclick=undo;
init();
