(function(){

'use strict';

const $=id=>document.getElementById(id),
digits=[1,2,3,4,5,6,7,8,9],
boardEl=$('board'),
padEl=$('numberPad');

const translations={

'zh-CN':{
brand:'轻松数独',
subtitle:'每天动动脑 · 轻松挑战',
newGame:'↻ 新游戏',
language:'语言',
difficulty:'难度',
easy:'入门',
medium:'简单',
hard:'困难',
expert:'专家',
time:'用时',
progress:'已填数字',
erase:'⌫ 擦除',
hint:'✦ 提示',
check:'✓ 检查',
newRound:'新的一局',
instruction:'点击格子，再选择下方数字。',
help:'数字会自动高亮相同数字。提示会填入一个正确答案。',
filled:'已填写。',
filledCheck:'数字已填写；可以点击「检查」核对。',
selectCell:'请先选择一个格子。',
fixed:'这是题目给出的数字，不能修改。',
eraseFixed:'题目给出的数字不能擦除。',
erased:'已擦除。',
empty:'还有 {n} 个空格未填写。',
wrong:'有数字不正确，红色格子可优先检查。',
hintDone:'提示已填入一个正确数字。',
noHint:'没有需要提示的格子了。',
complete:'全部正确！本局完成。',
winTitle:'太棒了！🎉',
winText:'用时 {time}。继续保持，来挑战下一局吧！',
again:'再来一局',
difficultyNames:['入门','简单','困难','专家'],
board:'数独棋盘',
cell:'第{r}行第{c}列',
emptyCell:'空格',
number:'数字'
},

'zh-TW':{
brand:'輕鬆數獨',
subtitle:'每天動動腦 · 輕鬆挑戰',
newGame:'↻ 新遊戲',
language:'語言',
difficulty:'難度',
easy:'入門',
medium:'簡單',
hard:'困難',
expert:'專家',
time:'用時',
progress:'已填數字',
erase:'⌫ 擦除',
hint:'✦ 提示',
check:'✓ 檢查',
newRound:'新的一局',
instruction:'點選格子，再選擇下方數字。',
help:'相同數字會自動高亮。提示會填入一個正確答案。',
filled:'已填寫。',
filledCheck:'數字已填寫；可以點擊「檢查」核對。',
selectCell:'請先選擇一個格子。',
fixed:'這是題目給定的數字，不能修改。',
eraseFixed:'題目給定的數字不能擦除。',
erased:'已擦除。',
empty:'還有 {n} 個空格未填寫。',
wrong:'有數字不正確，紅色格子可優先檢查。',
hintDone:'提示已填入一個正確數字。',
noHint:'沒有需要提示的格子了。',
complete:'全部正確！本局完成。',
winTitle:'太棒了！🎉',
winText:'用時 {time}。繼續保持，來挑戰下一局吧！',
again:'再來一局',
difficultyNames:['入門','簡單','困難','專家'],
board:'數獨棋盤',
cell:'第{r}行第{c}列',
emptyCell:'空格',
number:'數字'
},

'en':{
brand:'Easy Sudoku',
subtitle:'A little brain training, one puzzle at a time',
newGame:'↻ New game',
language:'Language',
difficulty:'Difficulty',
easy:'Beginner',
medium:'Easy',
hard:'Hard',
expert:'Expert',
time:'Time',
progress:'Filled',
erase:'⌫ Erase',
hint:'✦ Hint',
check:'✓ Check',
newRound:'New puzzle',
instruction:'Select a cell, then choose a number below.',
help:'Matching numbers are highlighted. Hint fills one correct answer.',
filled:'Number entered.',
filledCheck:'Number entered. Tap Check to verify your answers.',
selectCell:'Please select a cell first.',
fixed:'This is a given clue and cannot be changed.',
eraseFixed:'Given clues cannot be erased.',
erased:'Cell cleared.',
empty:'{n} cells are still empty.',
wrong:'Some numbers are incorrect. Check the red cells.',
hintDone:'One correct number has been filled in.',
noHint:'No cells need a hint.',
complete:'All correct! Puzzle completed.',
winTitle:'Well done! 🎉',
winText:'Time: {time}. Keep it up and try another puzzle!',
again:'Play again',
difficultyNames:['Beginner','Easy','Hard','Expert'],
board:'Sudoku board',
cell:'Row {r}, column {c}',
emptyCell:'empty',
number:'number'
}

};

let lang='zh-CN',
difficulty='easy',
puzzle=[],
solution=[],
values=[],
selected=-1,
startedAt=Date.now(),
elapsed=0,
timerHandle=null,
finished=false;

function t(key){
  return translations[lang][key]||key
}

function fmt(key,vars={}){
  return Object.entries(vars).reduce(
    (s,[k,v])=>s.replaceAll('{'+k+'}',v),
    t(key)
  )
}

function applyLanguage(){

  const x=translations[lang];

  document.documentElement.lang=lang;

  $('brand').textContent=x.brand;
  $('subtitle').textContent=x.subtitle;
  $('newTop').textContent=x.newGame;

  $('languageLabel').textContent=x.language;
  $('difficultyLabel').textContent=x.difficulty;

  $('difficulty').options[0].text=x.easy;
  $('difficulty').options[1].text=x.medium;
  $('difficulty').options[2].text=x.hard;
  $('difficulty').options[3].text=x.expert;

  $('timeLabel').textContent=x.time;
  $('progressLabel').textContent=x.progress;
  $('currentDifficultyLabel').textContent=x.difficulty;

  $('erase').textContent=x.erase;
  $('hint').textContent=x.hint;
  $('check').textContent=x.check;
  $('newBottom').textContent=x.newRound;

  $('help').textContent=x.help;

  $('board').setAttribute('aria-label',x.board);
  $('numberPad').setAttribute('aria-label',x.number);

  $('winTitle').textContent=x.winTitle;
  $('nextGame').textContent=x.again;

  if(
    !finished &&
    $('message').dataset.custom!=='true'
  ){
    $('message').textContent=x.instruction
  }

  $('currentDifficulty').textContent=t(difficulty)
}

function shuffle(a){

  for(
    let i=a.length-1;
    i>0;
    i--
  ){

    const j=Math.floor(
      Math.random()*(i+1)
    );

    [a[i],a[j]]=[a[j],a[i]]
  }

  return a
}

function candidates(g,r,c){

  const used=new Set();

  for(let i=0;i<9;i++){

    if(g[r][i])used.add(g[r][i]);

    if(g[i][c])used.add(g[i][c])
  }

  const br=Math.floor(r/3)*3,
  bc=Math.floor(c/3)*3;

  for(
    let rr=br;
    rr<br+3;
    rr++
  ){

    for(
      let cc=bc;
      cc<bc+3;
      cc++
    ){

      if(g[rr][cc])
        used.add(g[rr][cc])
    }
  }

  return digits.filter(
    n=>!used.has(n)
  )
}

function findBestEmpty(g){

  let best=null,
  optsBest=null;

  for(let r=0;r<9;r++)
    for(let c=0;c<9;c++)

      if(!g[r][c]){

        const opts=candidates(g,r,c);

        if(
          !optsBest ||
          opts.length<optsBest.length
        ){

          best=[r,c];
          optsBest=opts;

          if(opts.length<=1)
            return{
              pos:best,
              opts:optsBest
            }
        }
      }

  return best?
    {
      pos:best,
      opts:optsBest
    }:
    null
}

function fillSolution(g){

  const spot=findBestEmpty(g);

  if(!spot)
    return true;

  const[r,c]=spot.pos;

  for(
    const n of shuffle(spot.opts.slice())
  ){

    g[r][c]=n;

    if(fillSolution(g))
      return true;

    g[r][c]=0
  }

  return false
}

function countSolutions(g,limit=2){

  const spot=findBestEmpty(g);

  if(!spot)
    return 1;

  if(!spot.opts.length)
    return 0;

  const[r,c]=spot.pos;

  let total=0;

  for(const n of spot.opts){

    g[r][c]=n;

    total+=countSolutions(
      g,
      limit-total
    );

    g[r][c]=0;

    if(total>=limit)
      return total
  }

  return total
}

function makePuzzle(){

  const solved=
    Array.from(
      {length:9},
      ()=>Array(9).fill(0)
    );

  fillSolution(solved);

  const puz=
    solved.map(row=>row.slice());

  const targets={
    easy:[39,43],
    medium:[34,38],
    hard:[28,33],
    expert:[24,28]
  };

  const[low,high]=targets[difficulty];

  const target=
    low+
    Math.floor(
      Math.random()*(high-low+1)
    );

  for(
    const idx of shuffle(
      Array.from(
        {length:81},
        (_,i)=>i
      )
    )
  ){

    if(
      puz.flat().filter(Boolean).length
      <=target
    )
      break;

    const r=Math.floor(idx/9),
    c=idx%9,
    old=puz[r][c];

    puz[r][c]=0;

    if(
      countSolutions(
        puz.map(row=>row.slice()),
        2
      )!==1
    )
      puz[r][c]=old
  }

  return{
    puzzle:puz,
    solution:solved
  }
}

function flat(g){
  return g.reduce(
    (a,row)=>a.concat(row),
    []
  )
}

function startNewGame(){

  const game=makePuzzle();

  puzzle=flat(game.puzzle);
  solution=flat(game.solution);
  values=puzzle.slice();

  selected=-1;
  startedAt=Date.now();
  elapsed=0;
  finished=false;

  $('winModal').classList.remove('show');

  $('message').dataset.custom='false';
  $('message').className='message';
  $('message').textContent=t('instruction');

  renderBoard();
  renderPad();
  updateStats();
  startTimer()
}

function startTimer(){

  if(timerHandle)
    clearInterval(timerHandle);

  timerHandle=setInterval(()=>{

    if(!finished){

      elapsed=Math.floor(
        (Date.now()-startedAt)/1000
      );

      $('timer').textContent=
        formatTime(elapsed)
    }

  },1000)
}

function formatTime(s){

  return String(
    Math.floor(s/60)
  ).padStart(2,'0')
  +':'+
  String(s%60).padStart(2,'0')
}

function renderBoard(){

  boardEl.innerHTML='';

  for(let i=0;i<81;i++){

    const r=Math.floor(i/9),
    c=i%9,
    btn=document.createElement('button');

    btn.type='button';
    btn.className='cell';
    btn.dataset.index=i;

    btn.setAttribute(
      'aria-label',
      fmt(
        'cell',
        {
          r:r+1,
          c:c+1
        }
      )+
      (
        values[i]
        ?
        ', '+t('number')+' '+values[i]
        :
        ', '+t('emptyCell')
      )
    );

    if(c===2||c===5)
      btn.classList.add('box-right');

    if(r===2||r===5)
      btn.classList.add('box-bottom');

    if(puzzle[i])
      btn.classList.add('given');

    btn.textContent=
      values[i]||'';

    btn.addEventListener(
      'click',
      ()=>{
        if(finished)return;

        selected=i;
        renderBoard()
      }
    );

    boardEl.appendChild(btn)
  }

  paintHighlights();
  updateStats()
}

function getConflictSet(){

  const conflicts=new Set();

  for(let i=0;i<81;i++){

    const v=values[i];

    if(!v)
      continue;

    const r=Math.floor(i/9),
    c=i%9,
    br=Math.floor(r/3)*3,
    bc=Math.floor(c/3)*3;

    // 检查同一行、同一列和同一九宫格。
    for(let j=0;j<81;j++){

      if(j===i || values[j]!==v)
        continue;

      const jr=Math.floor(j/9),
      jc=j%9;

      if(
        jr===r ||
        jc===c ||
        (
          Math.floor(jr/3)===Math.floor(r/3) &&
          Math.floor(jc/3)===Math.floor(c/3)
        )
      ){
        conflicts.add(i);
        conflicts.add(j);
      }
    }
  }

  return conflicts
}

function hasConflicts(){

  return getConflictSet().size>0
}

function paintHighlights(){

  const cells=boardEl.children;

  const conflicts=getConflictSet();

  if(selected<0)
    return;

  const sr=Math.floor(selected/9),
  sc=selected%9,
  sv=values[selected];

  for(let i=0;i<81;i++){

    const r=Math.floor(i/9),
    c=i%9,
    el=cells[i];

    if(
      r===sr ||
      c===sc ||
      (
        Math.floor(r/3)===
        Math.floor(sr/3)
        &&
        Math.floor(c/3)===
        Math.floor(sc/3)
      )
    )
      el.classList.add('peer');

    if(
      sv &&
      values[i]===sv
    )
      el.classList.add('same');

    if(i===selected)
      el.classList.add('selected');

    // 只根据同行、同列、同九宫格的重复数字判断错误。
    if(conflicts.has(i))
      el.classList.add('error')
  }
}

function renderPad(){

  padEl.innerHTML='';

  for(const n of digits){

    const b=document.createElement('button');

    b.type='button';
    b.className='num';
    b.textContent=n;

    b.setAttribute(
      'aria-label',
      t('number')+' '+n
    );

    b.addEventListener(
      'click',
      ()=>enterNumber(n)
    );

    padEl.appendChild(b)
  }
}

function say(msg,success=false){

  $('message').textContent=msg;

  $('message').className=
    'message'+
    (success?' success':'');

  $('message').dataset.custom='true'
}

function enterNumber(n){

  if(finished)
    return;

  if(selected<0){

    say(t('selectCell'));
    return
  }

  if(puzzle[selected]){

    say(t('fixed'));
    return
  }

  values[selected]=n;

  renderBoard();

  if(isComplete())
    finishGame();
  else if(hasConflicts())
    say(t('wrong'));
  else
    say(t('filled'))
}

function eraseSelected(){

  if(selected<0){

    say(t('selectCell'));
    return
  }

  if(puzzle[selected]){

    say(t('eraseFixed'));
    return
  }

  values[selected]=0;

  renderBoard();

  say(t('erased'))
}

function updateStats(){

  $('progress').textContent=
    values.filter(Boolean).length+
    ' / 81';

  $('currentDifficulty').textContent=
    t(difficulty)
}

function isComplete(){

  return values.every(
    (v,i)=>v===solution[i]
  )
}

function checkBoard(){

  if(finished)
    return;

  const empty=
    values.filter(v=>!v).length;

  const wrong=hasConflicts();

  if(empty){

    say(
      fmt(
        'empty',
        {n:empty}
      )
    );

    return
  }

  if(wrong){

    say(t('wrong'));
    return
  }

  finishGame()
}

function giveHint(){

  if(finished)
    return;

  let idx=selected;

  if(
    idx<0 ||
    puzzle[idx] ||
    values[idx]===solution[idx]
  ){

    const bad=
      values
      .map(
        (v,i)=>({v,i})
      )
      .filter(
        x=>
          !puzzle[x.i] &&
          x.v &&
          x.v!==solution[x.i]
      );

    const empty=
      values
      .map(
        (v,i)=>({v,i})
      )
      .filter(
        x=>
          !puzzle[x.i] &&
          !x.v
      );

    const pool=
      bad.length?
      bad:
      empty;

    if(!pool.length){

      say(t('noHint'));
      return
    }

    idx=
      pool[
        Math.floor(
          Math.random()*pool.length
        )
      ].i;

    selected=idx
  }

  values[selected]=solution[selected];

  renderBoard();

  if(isComplete())
    finishGame();
  else
    say(t('hintDone'))
}

function finishGame(){

  finished=true;

  elapsed=
    Math.floor(
      (Date.now()-startedAt)/1000
    );

  $('timer').textContent=
    formatTime(elapsed);

  say(
    t('complete'),
    true
  );

  $('winText').textContent=
    fmt(
      'winText',
      {
        time:formatTime(elapsed)
      }
    );

  $('winModal').classList.add('show');

  $('nextGame').focus()
}

$('language').addEventListener(
  'change',
  e=>{
    lang=e.target.value;
    applyLanguage();
    renderBoard();
    renderPad()
  }
);

$('difficulty').addEventListener(
  'change',
  e=>{
    difficulty=e.target.value;
    applyLanguage();
    startNewGame()
  }
);

$('newTop').addEventListener(
  'click',
  startNewGame
);

$('newBottom').addEventListener(
  'click',
  startNewGame
);

$('nextGame').addEventListener(
  'click',
  startNewGame
);

$('erase').addEventListener(
  'click',
  eraseSelected
);

$('hint').addEventListener(
  'click',
  giveHint
);

$('check').addEventListener(
  'click',
  checkBoard
);

document.addEventListener(
  'keydown',
  e=>{

    if(finished)
      return;

    if(
      e.key>='1' &&
      e.key<='9'
    ){

      enterNumber(
        Number(e.key)
      )

    }else if(
      e.key==='Backspace' ||
      e.key==='Delete' ||
      e.key==='0'
    ){

      eraseSelected()

    }else if(
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight'
      ].includes(e.key) &&
      selected>=0
    ){

      e.preventDefault();

      let r=Math.floor(selected/9),
      c=selected%9;

      if(e.key==='ArrowUp')
        r=(r+8)%9;

      if(e.key==='ArrowDown')
        r=(r+1)%9;

      if(e.key==='ArrowLeft')
        c=(c+8)%9;

      if(e.key==='ArrowRight')
        c=(c+1)%9;

      selected=r*9+c;

      renderBoard()
    }
  }
);

applyLanguage();
startNewGame();

})();
