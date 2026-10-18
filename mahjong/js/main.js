"use strict";

// =============================
// DOM
// =============================
// =============================
// DOM
// =============================

const playerHandEl =
    document.getElementById("myHand");

const playerMeldsEl =
    document.getElementById("myMelds");

const wallEl =
    document.getElementById("centerWall");

const discardEls = [
    document.getElementById("southDiscards"),
    document.getElementById("westDiscards"),
    document.getElementById("northDiscards"),
    document.getElementById("eastDiscards")
];

const seatInfoEls = [
    document.getElementById("southInfo"),
    document.getElementById("westInfo"),
    document.getElementById("northInfo"),
    document.getElementById("eastInfo")
];

const roundInfoEl =
    document.getElementById("roundInfo");

const statusEl =
    document.getElementById("status");

const timerEl =
    document.getElementById("timer");

const startBtn =
    document.getElementById("startBtn");

const roundOptionsEl =
    document.getElementById("roundOptions");

const startScreen =
    document.getElementById("startScreen");

const resultScreen =
    document.getElementById("resultScreen");

const resultMessageEl =
    document.getElementById("resultMessage");

const resultListEl =
    document.getElementById("resultList");

const restartBtn =
    document.getElementById("restartBtn");

const confirmExchangeBtn =
    document.getElementById("confirmExchangeBtn");

const pengBtn =
    document.getElementById("pengBtn");

const passBtn =
    document.getElementById("passBtn");

const gangBtn =
    document.getElementById("gangBtn");

const huBtn =
    document.getElementById("huBtn");

const northHandEl =
    document.getElementById("northHand");

const westHandEl =
    document.getElementById("westHand");

const eastHandEl =
    document.getElementById("eastHand");

const aiMeldEls = [
    document.getElementById("westMelds"),
    document.getElementById("northMelds"),
    document.getElementById("eastMelds")
];

// =============================
// 按钮与初始化
// =============================
// =============================
// 按钮
// =============================

startBtn.onclick =
    beginMatch;


restartBtn.onclick = ()=>{

    if(currentRound>=matchRounds){

        startScreen.classList.remove("hidden");
        resultScreen.classList.add("hidden");

    }else{

        startGame();

    }

};


roundOptionsEl.addEventListener("click",event=>{

    const button = event.target.closest("[data-rounds]");

    if(!button){

        return;

    }

    matchRounds = Number(button.dataset.rounds);

    roundOptionsEl.querySelectorAll("[data-rounds]").forEach(option=>{
        option.classList.toggle("selected",option===button);
    });

});


confirmExchangeBtn.onclick =
    exchangeThree;


huBtn.onclick =
    playerHu;


gangBtn.onclick =
    playerGang;


// =============================
// 初始化
// =============================

pengBtn.style.display =
    "none";

passBtn.style.display =
    "none";

gangBtn.style.display =
    "none";

huBtn.style.display =
    "none";

confirmExchangeBtn.style.display =
    "none";

statusEl.textContent =
    "点击「开始游戏」";
