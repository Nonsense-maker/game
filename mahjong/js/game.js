"use strict";

// =============================
// 游戏状态
// =============================
let wall = [];
let playerHand = [];
let aiHands = [[],[],[]];
let aiMelds = [[],[],[]];

let playerLack = null;
let aiLacks = [null,null,null];

let phase = "waiting";

let selectedTiles = [];

let pendingHu = false;
let playerMelds = [];
let pendingPeng = null;
let pendingDiscardHu = null;
let nextAiIndexAfterPlayerDiscard = 0;
let activePlayers = [true,true,true,true];
let winners = [];
let winRecords = [];
let lastDrawWasGang = false;
let drawnTile = null;
let playerTimerId = null;
let playerTimerSeconds = 0;
let matchRounds = 4;
let currentRound = 0;
let totalScores = [0,0,0,0];
let roundScores = [0,0,0,0];
let dealerSeat = 0;
let lastDiscardEl = null;
let activeSeat = null;
let scoreEvents = [];
let roundEndedByDraw = false;
let discardHistory = [];



const SEAT_NAMES = ["玩家", "建国", "谦礼", "谨珍"];

function getSeatName(seat){
    return SEAT_NAMES[seat] || `对手${seat}`;
}

// =============================
// 开始游戏
// =============================
// =============================
// 开始游戏
// =============================

function beginMatch(){

    currentRound = 0;
    totalScores = [0,0,0,0];
    startGame();

}

function startGame(){

    currentRound++;
    roundScores = [0,0,0,0];
    const diceOne = 1+Math.floor(Math.random()*6);
    const diceTwo = 1+Math.floor(Math.random()*6);
    dealerSeat = (diceOne+diceTwo)%4;

    // 关键：关闭开始弹窗
    startScreen.classList.add("hidden");
    resultScreen.classList.add("hidden");

    wall = createTiles();

    shuffle(wall);

    playerHand = [];

    aiHands = [
        [],
        [],
        []
    ];

    aiMelds = [[],[],[]];

    playerLack = null;

    aiLacks = [
        null,
        null,
        null
    ];

    selectedTiles = [];

    pendingHu = false;

    playerMelds = [];
    pendingPeng = null;
    pendingDiscardHu = null;
    nextAiIndexAfterPlayerDiscard = 0;
    activePlayers = [true,true,true,true];
    winners = [];
    winRecords = [];
    lastDrawWasGang = false;
    drawnTile = null;
    activeSeat = null;
    scoreEvents = [];
    roundEndedByDraw = false;
    discardHistory = [];
    clearPlayerTimer();

    document.querySelectorAll(".seat-summary-item").forEach(player=>{
        player.classList.remove("out");
    });

    phase = "exchange";

    // 清空弃牌
    discardEls.forEach(container=>{
        container.innerHTML = "";
    });

    // 隐藏操作按钮
    pengBtn.style.display = "none";
    passBtn.style.display = "none";
    gangBtn.style.display = "none";
    huBtn.style.display = "none";

    // 发牌
    for(let i=0;i<13;i++){

        playerHand.push(wall.pop());

        for(let j=0;j<3;j++){

            aiHands[j].push(wall.pop());

        }
    }

    sortHand(playerHand);

    aiHands.forEach(sortHand);

    confirmExchangeBtn.disabled = true;
    confirmExchangeBtn.style.display = "";

    statusEl.textContent =
        `骰子 ${diceOne} + ${diceTwo}，${getSeatName(dealerSeat)}坐庄。请选择3张同花色的牌进行换三张`;

    startPlayerTimer();

    render();

}


// =============================
// 渲染
// =============================
// =============================
// 渲染
// =============================

function render(){

    renderPlayerHand();

    renderPlayerMelds();

    renderAIHands();

    updateSeatInfo();

    roundInfoEl.textContent = `第 ${currentRound} / ${matchRounds} 局`;

    wallEl.textContent =
        `牌墙：${wall.length}`;

}



function updateSeatInfo(){

    seatInfoEls.forEach((element,seat)=>{

        const lack = seat===0 ? playerLack : aiLacks[seat-1];
        const dealer = seat===dealerSeat ? " <span class=\"dealer-badge\">庄</span>" : "";
        const name = getSeatName(seat);

        element.innerHTML = `${name}<span class=\"seat-info\">积分 ${totalScores[seat]} · ${lack ? `缺${lack}` : "未定缺"}${dealer}</span>`;
        element.classList.toggle("active",seat===activeSeat);

    });

}


function renderPlayerMelds(){

    renderMelds(playerMeldsEl,playerMelds,false);
    aiMelds.forEach((melds,index)=>renderMelds(aiMeldEls[index],melds,true));

}

function renderMelds(container,melds,hideConcealed){

    container.innerHTML = "";

    melds.forEach(meld=>{

        const meldEl = document.createElement("div");

        meldEl.className = "meld";

        if(hideConcealed && meld.concealed){
            meldEl.classList.add("concealed-meld");
        }

        meld.forEach(tile=>{

            const tileEl = document.createElement("div");

            tileEl.className = "meld-tile";
            tileEl.textContent = tileLabel(tile);
            meldEl.appendChild(tileEl);

        });

        container.appendChild(meldEl);

    });

}


// =============================
// 弃牌
// =============================
// =============================
// 弃牌
// =============================

function addDiscard(tile,seat){

    const el =
        document.createElement("span");

    el.className =
        "discard";

    el.textContent = tileLabel(tile);

    el.title =
        seat===0 ? "你" : getSeatName(seat);

    discardEls[seat].appendChild(el);
    discardHistory.push({suit:tile.suit,value:tile.value});
    lastDiscardEl = el;

    return el;

}


// =============================
// 血战到底
// =============================
// =============================
// 血战到底
// =============================

function declareWin(seat,message,continueGame,method="自摸"){

    declareWins([seat],message,continueGame,method,null);

}


function declareWins(seatsToWin,message,continueGame,method="点炮",payerSeat=null){

    const validWinners = seatsToWin.filter(
        seat=>activePlayers[seat] && phase==="playing"
    );

    if(!validWinners.length){

        return;

    }

    const seatElements = seatInfoEls;

    validWinners.forEach(seat=>{

        const result = calculateFan(seat,method);

        activePlayers[seat] = false;
        winners.push(seat);
        winRecords.push({seat,method,payerSeat,...result});

        if(seatElements[seat]){

            seatElements[seat].classList.add("out");

        }

    });

    pendingHu = false;
    pendingPeng = null;
    pendingDiscardHu = null;
    clearPlayerTimer();
    huBtn.style.display = "none";
    pengBtn.style.display = "none";
    passBtn.style.display = "none";
    gangBtn.style.display = "none";

    const remainingPlayers = activePlayers.filter(Boolean).length;
    const fanText = winRecords
        .filter(record=>validWinners.includes(record.seat))
        .map(record=>
            `${record.seat===0 ? "你" : getSeatName(record.seat)}：${record.fan}番（${record.patterns.join("、")}）`
        )
        .join("；");

    if(remainingPlayers<=1){

        endGame(`${message} ${fanText} 血战到底结束。`);

        return;

    }

    statusEl.textContent =
        `${message} ${fanText}。已胡牌退出，剩余 ${remainingPlayers} 家继续。`;

    render();

    setTimeout(continueGame,aiDelay());

}


// =============================
// 结束
// =============================
// =============================
// 结束
// =============================

function showSettlement(message){

    resultMessageEl.textContent = message;
    resultListEl.innerHTML = "";

    const isMatchOver = currentRound>=matchRounds;
    document.querySelector(".result-card h2").textContent =
        isMatchOver ? "赛程结束" : `第 ${currentRound} / ${matchRounds} 局小结`;

    if(!winRecords.length){

        const item = document.createElement("li");

        item.textContent = "本局流局，没有玩家胡牌";

        resultListEl.appendChild(item);

    }else{

        winRecords.forEach((record,index)=>{

            const item = document.createElement("li");
            const name = document.createElement("strong");
            const detail = document.createElement("small");

            name.textContent =
                `${index+1}. ${record.seat===0 ? "你" : getSeatName(record.seat)} · ${record.fan}番 · ${roundScores[record.seat]>=0 ? "+" : ""}${roundScores[record.seat]}`;

            detail.textContent = record.patterns.join("、");

            item.append(name,detail);
            resultListEl.appendChild(item);

        });

    }

    const ranking = [0,1,2,3].sort((a,b)=>totalScores[b]-totalScores[a]);

    ranking.forEach((seat,index)=>{

        const item = document.createElement("li");
        const name = document.createElement("strong");
        const detail = document.createElement("small");

        name.textContent =
            `${index+1}. ${seat===0 ? "你" : getSeatName(seat)} · 总分 ${totalScores[seat]}`;
        detail.textContent =
            `本局 ${roundScores[seat]>=0 ? "+" : ""}${roundScores[seat]}`;

        item.append(name,detail);
        resultListEl.appendChild(item);

    });

    restartBtn.textContent = isMatchOver ? "重新开始赛程" : "下一局";

    resultScreen.classList.remove("hidden");

}


function settleRoundScores(){

    roundScores = [0,0,0,0];

    scoreEvents.forEach(event=>{
        roundScores[event.from] -= event.amount;
        roundScores[event.to] += event.amount;
    });

    winRecords.forEach(record=>{

        if(record.method==="点炮" && record.payerSeat!==null){

            roundScores[record.seat] += record.fan;
            roundScores[record.payerSeat] -= record.fan;

        }else{

            for(let seat=0;seat<4;seat++){

                if(seat!==record.seat){

                    roundScores[seat] -= record.fan;
                    roundScores[record.seat] += record.fan;

                }

            }

        }

    });

    totalScores = totalScores.map(
        (score,seat)=>score+roundScores[seat]
    );

}

function isSeatReady(seat){
    const hand=seat===0 ? playerHand : aiHands[seat-1];
    const meldCount=seat===0 ? playerMelds.length : aiMelds[seat-1].length;
    const lack=seat===0 ? playerLack : aiLacks[seat-1];
    for(const suit of suits){
        for(let value=1;value<=9;value++){
            const test=hand.concat([{suit,value}]);
            if(!test.some(tile=>tile.suit===lack) && canHu(test,meldCount)){
                return true;
            }
        }
    }
    return false;
}

function applyDrawSettlement(){
    roundEndedByDraw=true;
    const flowerPigs=[];
    for(let seat=0;seat<4;seat++){
        if(!activePlayers[seat]){ continue; }
        const tiles=seat===0 ? playerHand : aiHands[seat-1];
        const lack=seat===0 ? playerLack : aiLacks[seat-1];
        if(tiles.some(tile=>tile.suit===lack)){ flowerPigs.push(seat); }
    }
    const cleanSeats=[0,1,2,3].filter(seat=>activePlayers[seat] && !flowerPigs.includes(seat));
    flowerPigs.forEach(from=>cleanSeats.forEach(to=>recordScoreEvent("查花猪",from,to,4)));

    const readySeats=cleanSeats.filter(isSeatReady);
    cleanSeats.filter(seat=>!readySeats.includes(seat)).forEach(from=>{
        readySeats.forEach(to=>recordScoreEvent("查叫",from,to,2));
    });

    // 未叫或花猪的杠分退回：只撤销该玩家本局已收取的杠分。
    const taxBackSeats=new Set([...flowerPigs,...cleanSeats.filter(seat=>!readySeats.includes(seat))]);
    scoreEvents.slice().filter(event=>["暗杠","明杠","补杠"].includes(event.label) && taxBackSeats.has(event.to))
        .forEach(event=>recordScoreEvent("退税",event.to,event.from,event.amount));
}

function endGame(message){

    phase = "ended";

    if(message.includes("牌墙已经摸完")){
        applyDrawSettlement();
    }

    pendingPeng = null;
    clearPlayerTimer();

    statusEl.textContent =
        message;

    huBtn.style.display =
        "none";

    pengBtn.style.display =
        "none";

    passBtn.style.display =
        "none";

    gangBtn.style.display =
        "none";

    render();

    settleRoundScores();

    showSettlement(message);

}
