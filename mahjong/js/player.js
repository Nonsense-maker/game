"use strict";

function tileFaceSrc(tile){
    const suit = tile.suit === "万" ? "wan" : tile.suit === "条" ? "tiao" : "tong";
    return `assets/tile-faces/${suit}${tile.value}.svg`;
}

function makeTileFace(tile, alt=""){
    const img = document.createElement("img");
    img.src = tileFaceSrc(tile);
    img.alt = alt || tileLabel(tile);
    img.draggable = false;
    img.setAttribute("aria-hidden", "true");
    return img;
}


function clearPlayerTimer(){

    clearInterval(playerTimerId);
    playerTimerId = null;
    playerTimerSeconds = 0;
    timerEl.textContent = "";

}


function startPlayerTimer(){

    clearPlayerTimer();

    if(phase==="waiting" || phase==="ended" || !activePlayers[0]){

        return;

    }

    playerTimerSeconds = 60;
    timerEl.textContent = "剩余 60 秒";

    playerTimerId = setInterval(()=>{

        playerTimerSeconds--;
        timerEl.textContent = `剩余 ${playerTimerSeconds} 秒`;

        if(playerTimerSeconds<=0){

            clearPlayerTimer();
            runAutomaticPlayerAction();

        }

    },1000);

}


function getLegalDiscardIndexes(){

    const hasLack = playerHand.some(tile=>tile.suit===playerLack);

    return playerHand
        .map((tile,index)=>({tile,index}))
        .filter(({tile})=>!hasLack || tile.suit===playerLack)
        .map(({index})=>index);

}


function runAutomaticPlayerAction(){

    if(phase==="exchange"){

        const suitsToExchange = suits.filter(suit=>
            playerHand.filter(tile=>tile.suit===suit).length>=3
        );

        const suit = suitsToExchange[
            Math.floor(Math.random()*suitsToExchange.length)
        ];

        selectedTiles = playerHand
            .map((tile,index)=>({tile,index}))
            .filter(({tile})=>tile.suit===suit)
            .slice(0,3)
            .map(({index})=>index);

        exchangeThree();

        return;

    }

    if(phase==="lack"){

        choosePlayerLack(
            suits[Math.floor(Math.random()*suits.length)]
        );

        return;

    }

    if(phase!=="playing"){

        return;

    }

    if(pendingDiscardHu){

        Math.random()<.5 ? takePendingDiscardHu() : passDiscardHu();

        return;

    }

    if(pendingPeng){

        Math.random()<.5 ? playerPeng() : passPeng();

        return;

    }

    const actions = [];

    if(pendingHu){

        actions.push(playerHu);

    }

    if(canGang()){

        actions.push(playerGang);

    }

    const legalDiscards = getLegalDiscardIndexes();

    if(legalDiscards.length){

        actions.push(()=>{
            const index = legalDiscards[
                Math.floor(Math.random()*legalDiscards.length)
            ];

            discardTile(index);
        });

    }

    if(actions.length){

        actions[Math.floor(Math.random()*actions.length)]();

    }

}

// =============================
// 玩家手牌
// =============================

function renderPlayerHand(){

    playerHandEl.innerHTML = "";

    playerHand.forEach((tile,index)=>{

        const el =
            document.createElement("div");

        el.className = "tile";

        if(selectedTiles.includes(index)){

            el.classList.add("selected");

        }

        if(tile===drawnTile){

            el.classList.add("drawn");

        }

        el.appendChild(makeTileFace(tile));

        el.onclick = (event)=>{

            event.preventDefault();
            event.stopPropagation();

            if(phase === "exchange"){
                toggleExchangeTile(index);
                return;
            }

            if(phase === "playing"){
                discardTile(index);
            }

        };

        playerHandEl.appendChild(el);

    });

}

// =============================
// 换三张选择
// =============================

function toggleExchangeTile(index){

    if(selectedTiles.includes(index)){

        selectedTiles =
            selectedTiles.filter(
                i=>i!==index
            );

    }else{

        if(selectedTiles.length>=3){
            return;
        }

        if(selectedTiles.length>0){

            const firstSuit =
                playerHand[
                    selectedTiles[0]
                ].suit;

            if(
                playerHand[index].suit !==
                firstSuit
            ){

                statusEl.textContent =
                    "换三张必须选择同一种花色";

                return;
            }

        }

        selectedTiles.push(index);

    }

    renderPlayerHand();

    if(selectedTiles.length===3){

        confirmExchangeBtn.disabled = false;

        statusEl.textContent =
            "已选择3张，点击「确认换三张」";

    }else{

        confirmExchangeBtn.disabled = true;

        statusEl.textContent =
            `已选择 ${selectedTiles.length} 张`;

    }

}

// =============================
// 换三张
// =============================

function exchangeThree(){

    if(selectedTiles.length!==3){

        statusEl.textContent =
            "必须选择3张同花色的牌";

        return;
    }

    const selected =
        selectedTiles.map(
            index=>playerHand[index]
        );

    const suit =
        selected[0].suit;

    if(
        !selected.every(
            tile=>tile.suit===suit
        )
    ){

        statusEl.textContent =
            "必须选择同一种花色";

        return;
    }

    const aiSelected =
        aiHands.map(
            hand=>chooseAIExchange(hand)
        );

    if(
        aiSelected.some(
            tiles=>tiles.length!==3
        )
    ){

        statusEl.textContent =
            "AI换三张失败，请重新开始";

        return;
    }

    /*
        换牌不再在玩家之间传递。
        每家从牌墙拿到三张同花色、且不同于交出花色的牌；
        四家交出的牌最后再洗回牌墙。
    */

    const outgoing = [selected,...aiSelected];
    const incoming = [];

    for(const tiles of outgoing){

        const replacements =
            takeReplacementTiles(tiles[0].suit);

        if(!replacements){

            wall.push(...incoming.flat());

            statusEl.textContent =
                "牌墙中没有足够的可换牌，请重新开始";

            return;

        }

        incoming.push(replacements);

    }

    playerHand = removeTiles(playerHand,selected);
    playerHand.push(...incoming[0]);

    for(let i=0;i<3;i++){

        aiHands[i] = removeTiles(aiHands[i],aiSelected[i]);
        aiHands[i].push(...incoming[i+1]);

    }

    wall.push(...outgoing.flat());
    shuffle(wall);

    sortHand(playerHand);

    aiHands.forEach(sortHand);

    selectedTiles = [];

    clearPlayerTimer();

    chooseLacks();

    phase = "lack";

    confirmExchangeBtn.style.display = "none";

    showLackButtons();

    render();

}


function takeReplacementTiles(originalSuit){

    const availableSuits = suits.filter(suit=>
        suit!==originalSuit &&
        wall.filter(tile=>tile.suit===suit).length>=3
    );

    if(!availableSuits.length){

        return null;

    }

    const replacementSuit = availableSuits[
        Math.floor(Math.random()*availableSuits.length)
    ];

    const replacements = [];

    for(let i=wall.length-1;i>=0 && replacements.length<3;i--){

        if(wall[i].suit===replacementSuit){

            replacements.push(wall.splice(i,1)[0]);

        }

    }

    return replacements;

}

// =============================
// AI定缺
// =============================

function chooseLacks(){

    for(let i=0;i<3;i++){

        aiLacks[i] =
            chooseAILack(
                aiHands[i]
            );

    }

}


function chooseAILack(hand){

    const counts = {
        "万":0,
        "条":0,
        "筒":0
    };

    hand.forEach(tile=>{
        counts[tile.suit]++;
    });

    let lack = suits[0];

    for(const suit of suits){

        if(
            counts[suit] <
            counts[lack]
        ){

            lack = suit;

        }

    }

    return lack;
}

// =============================
// 显示定缺
// =============================

function showLackButtons(){

    statusEl.innerHTML =
        "请选择定缺：";

    suits.forEach(suit=>{

        const btn =
            document.createElement("button");

        btn.className = "lack-btn";

        btn.textContent =
            `缺${suit}`;

        btn.onclick = ()=>{

            choosePlayerLack(suit);

        };

        statusEl.appendChild(btn);

    });

    startPlayerTimer();

}


// =============================
// 玩家定缺
// =============================

function choosePlayerLack(suit){

    clearPlayerTimer();

    playerLack = suit;

    phase = "playing";

    statusEl.textContent =
        `你的定缺：${suit}`;

    render();

    setTimeout(
        ()=>{
            if(dealerSeat===0){
                playerDraw();
            }else{
                aiTurnOne(dealerSeat-1);
            }
        },
        dealerSeat===0 ? 500 : aiDelay()
    );

}

// =============================
// 玩家摸牌
// =============================

function playerDraw(){

    if(phase!=="playing"){
        return;
    }

    if(!activePlayers[0]){

        aiTurn(0);

        return;

    }

    activeSeat = 0;

    if(wall.length===0){

        endGame("牌墙已经摸完，本局结束");

        return;
    }

    if(playerHand.length!==playerBaseHandSize()){
        return;
    }

    const tile =
        wall.pop();

    playerHand.push(tile);
    drawnTile = tile;

    pendingHu =
        canPlayerHu(playerHand);

    gangBtn.style.display =
        canGang() ? "" : "none";

    if(pendingHu){

        huBtn.style.display = "";
        huBtn.onclick = playerHu;

        statusEl.textContent =
            "你可以自摸胡牌！";

    }else{

        huBtn.style.display =
            "none";

        statusEl.textContent =
            "轮到你出牌";

    }

    render();

    startPlayerTimer();

}


// =============================
// 玩家出牌
// =============================

function discardTile(index){

    if(phase!=="playing"){
        return;
    }

    if(!activePlayers[0]){

        return;

    }

    if(playerHand.length!==playerBaseHandSize()+1){

        statusEl.textContent =
            "请先摸牌";

        return;
    }

    const tile =
        playerHand[index];

    // 定缺限制
    const hasLack =
        playerHand.some(
            t=>t.suit===playerLack
        );

    if(
        hasLack &&
        tile.suit!==playerLack
    ){

        statusEl.textContent =
            `你还有${playerLack}牌，必须先打定缺牌`;

        return;
    }

    clearPlayerTimer();

    playerHand.splice(
        index,
        1
    );

    drawnTile = null;
    sortHand(playerHand);

    addDiscard(tile,0);

    pendingHu = false;

    pendingPeng = null;
    lastDrawWasGang = false;

    huBtn.style.display =
        "none";

    gangBtn.style.display =
        "none";

    render();

    const aiHuSeats = getDiscardHuSeats(tile,0);

    if(aiHuSeats.length){

        resolveDiscardHu(
            aiHuSeats,
            tile,
            0,
            ()=>aiTurn(0)
        );

        return;

    }

    if(tryAiClaim(tile,0,()=>{})){
        return;
    }

    // AI行动
    const nextAiIndex = nextAiIndexAfterPlayerDiscard;

    nextAiIndexAfterPlayerDiscard = 0;

    setTimeout(
        ()=>aiTurn(nextAiIndex),
        aiDelay()
    );

}

// =============================
// 玩家牌点击
// =============================

playerHandEl.addEventListener(
    "click",
    event=>{

        if(phase!=="playing"){
            return;
        }

        const tiles =
            Array.from(
                playerHandEl.children
            );

        const index =
            tiles.indexOf(
                event.target
            );

        if(index===-1){
            return;
        }

        discardTile(index);

    }
);

// =============================
// 多家同时胡
// =============================

function getDiscardHuSeats(tile,discarderSeat){

    const huSeats = [];

    for(let seat=0;seat<4;seat++){

        if(seat===discarderSeat || !activePlayers[seat]){

            continue;

        }

        if(seat===0){

            const testHand = playerHand.concat([tile]);

            if(
                testHand.length===14-playerMelds.length*3 &&
                canPlayerHu(testHand)
            ){

                huSeats.push(seat);

            }

        }else if(canAIHu(seat-1,aiHands[seat-1].concat([tile]))){

            huSeats.push(seat);

        }

    }

    return huSeats;

}


function offerDiscardHu(huSeats,tile,discarderSeat,continueGame){

    pendingDiscardHu = {
        huSeats,
        tile,
        discarderSeat,
        continueGame
    };

    pendingHu = true;
    pengBtn.style.display = "none";
    huBtn.style.display = "";
    passBtn.style.display = "";
    huBtn.onclick = takePendingDiscardHu;
    passBtn.onclick = passDiscardHu;

    const otherWinners = huSeats.filter(seat=>seat!==0).length;

    statusEl.textContent = otherWinners
        ? `可一炮多响：你与 ${otherWinners} 家可胡，请选择「胡」或「过」`
        : `${getSeatName(discarderSeat)}打出 ${tileLabel(tile)}，你可以胡，请选择「胡」或「过」`;

    startPlayerTimer();

}


function takePendingDiscardHu(){

    if(!pendingDiscardHu){

        return;

    }

    const pending = pendingDiscardHu;

    clearPlayerTimer();
    pendingDiscardHu = null;
    resolveDiscardHu(
        pending.huSeats,
        pending.tile,
        pending.discarderSeat,
        pending.continueGame
    );

}


function passDiscardHu(){

    if(!pendingDiscardHu){

        return;

    }

    const pending = pendingDiscardHu;

    clearPlayerTimer();
    pendingDiscardHu = null;
    const aiHuSeats = pending.huSeats.filter(seat=>seat!==0);

    if(aiHuSeats.length){

        resolveDiscardHu(
            aiHuSeats,
            pending.tile,
            pending.discarderSeat,
            pending.continueGame
        );

    }else{

        huBtn.style.display = "none";
        passBtn.style.display = "none";
        pendingHu = false;
        pending.continueGame();

    }

}


function resolveDiscardHu(huSeats,tile,discarderSeat,continueGame){

    const names = huSeats.map(seat=>seat===0 ? "你" : getSeatName(seat));
    const discarderName = discarderSeat===0 ? "你" : getSeatName(discarderSeat);

    declareWins(
        huSeats,
        `${names.join("、")}胡了 ${tileLabel(tile)}（${discarderName}放炮）！`,
        continueGame,
        "点炮",
        discarderSeat
    );

}

// =============================
// 碰
// =============================

function playerBaseHandSize(){

    return 13-playerMelds.length*3;

}


function canPeng(tile){

    if(!activePlayers[0]){

        return false;

    }

    if(playerHand.length!==playerBaseHandSize()){

        return false;

    }

    return playerHand.filter(
        handTile=>
            handTile.suit===tile.suit &&
            handTile.value===tile.value
    ).length>=2;

}


function offerPeng(tile,sourceIndex){

    pendingPeng = {
        tile,
        sourceIndex,
        discardEl:lastDiscardEl
    };

    pengBtn.style.display = "";
    pengBtn.disabled = false;
    pengBtn.onclick = playerPeng;

    passBtn.style.display = "";
    passBtn.disabled = false;
    passBtn.onclick = passPeng;

    gangBtn.style.display =
        findDiscardGangTiles() ? "" : "none";

    statusEl.textContent =
        `${getSeatName(sourceIndex+1)}打出 ${tileLabel(tile)}，请选择「碰」或「过」`;

    startPlayerTimer();

}


function passPeng(){

    if(!pendingPeng || phase!=="playing"){

        return;

    }

    const sourceIndex = pendingPeng.sourceIndex;
    const tile = pendingPeng.tile;

    clearPlayerTimer();
    pendingPeng = null;
    pengBtn.style.display = "none";
    passBtn.style.display = "none";
    gangBtn.style.display = "none";

    tryAiClaim(
        tile,
        sourceIndex+1,
        ()=>setTimeout(()=>aiTurnOne(sourceIndex+1),aiDelay())
    );

}


function playerPeng(){

    if(!pendingPeng || phase!=="playing"){

        return;

    }

    const {tile,sourceIndex,discardEl} = pendingPeng;

    clearPlayerTimer();

    const matchingTiles = playerHand.filter(
        handTile=>
            handTile.suit===tile.suit &&
            handTile.value===tile.value
    ).slice(0,2);

    if(matchingTiles.length!==2){

        passPeng();

        return;

    }

    playerHand = removeTiles(playerHand,matchingTiles);
    const meld = [...matchingTiles,tile];
    meld.kind = "peng";
    playerMelds.push(meld);

    if(discardEl){

        discardEl.remove();

    }

    pendingPeng = null;
    pengBtn.style.display = "none";
    passBtn.style.display = "none";
    gangBtn.style.display = "none";
    nextAiIndexAfterPlayerDiscard = sourceIndex+1;
    drawnTile = null;
    activeSeat = 0;

    sortHand(playerHand);
    render();

    statusEl.textContent =
        `你碰了 ${tileLabel(tile)}，请立即出牌`;

    startPlayerTimer();

}

function playerGang(){

    if(phase!=="playing"){

        return;

    }

    const gangTiles = findGangTiles();
    const addedMeld = findAddedGang();
    const discardGangTiles = findDiscardGangTiles();

    if(!canGang()){

        statusEl.textContent = "当前没有可暗杠的四张相同牌";

        return;

    }

    // 补杠的第四张牌可以被其余仍在场的玩家抢杠胡。
    if(addedMeld && !discardGangTiles){
        const extraTile = playerHand.find(tile=>
            tile.suit===addedMeld[0].suit && tile.value===addedMeld[0].value
        );
        const robbers=[];
        for(let seat=1;seat<4;seat++){
            if(activePlayers[seat] && canAIHu(seat-1,aiHands[seat-1].concat([extraTile]))){
                robbers.push(seat);
            }
        }
        if(robbers.length){
            clearPlayerTimer();
            playerHand=removeTiles(playerHand,[extraTile]);
            addDiscard(extraTile,0);
            declareWins(
                robbers,
                `你补杠 ${tileLabel(extraTile)} 被抢杠胡！`,
                ()=>aiTurn(0),
                "点炮",
                0
            );
            return;
        }
    }

    clearPlayerTimer();

    let gangTile;
    let gangKind;

    if(discardGangTiles){

        const pending = pendingPeng;

        playerHand = removeTiles(playerHand,discardGangTiles);
        const meld = [...discardGangTiles,pending.tile];
        meld.kind = "gang";
        playerMelds.push(meld);
        if(pending.discardEl){
            pending.discardEl.remove();
        }
        pendingPeng = null;
        pengBtn.style.display = "none";
        passBtn.style.display = "none";
        gangTile = pending.tile;
        gangKind = "明杠";
        recordGangScore(gangKind,0,pending.sourceIndex+1);

    }else if(addedMeld){

        const extraTile = playerHand.find(tile=>
            tile.suit===addedMeld[0].suit &&
            tile.value===addedMeld[0].value
        );

        playerHand = removeTiles(playerHand,[extraTile]);
        addedMeld.push(extraTile);
        addedMeld.kind = "gang";
        gangTile = extraTile;
        gangKind = "补杠";
        recordGangScore(gangKind,0);

    }else{

        playerHand = removeTiles(playerHand,gangTiles);
        gangTiles.kind = "gang";
        playerMelds.push(gangTiles);
        gangTile = gangTiles[0];
        gangKind = "暗杠";
        recordGangScore(gangKind,0);

    }

    lastDrawWasGang = true;
    drawnTile = null;

    gangBtn.style.display = "none";
    huBtn.style.display = "none";
    pendingHu = false;

    render();

    statusEl.textContent =
        `你${gangKind} ${tileLabel(gangTile)}，正在补牌`;

    setTimeout(playerDraw,300);

}

// =============================
// 胡
// =============================

function playerHu(){

    if(
        playerHand.length===playerBaseHandSize()+1 &&
        canPlayerHu(playerHand)
    ){

        declareWin(
            0,
            "🎉 你自摸胡牌了！",
            ()=>aiTurn(0)
        );

        return;
    }

    statusEl.textContent =
        "这副牌目前不能胡";

}
