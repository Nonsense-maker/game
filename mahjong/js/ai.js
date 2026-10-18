"use strict";

function aiDelay(){

    return 1000+Math.floor(Math.random()*2001);

}

// =============================
// AI 手牌
// =============================

function renderAIHands(){

    renderAIHand(
        westHandEl,
        aiHands[0],
        true
    );

    renderAIHand(
        northHandEl,
        aiHands[1],
        false
    );

    renderAIHand(
        eastHandEl,
        aiHands[2],
        true
    );

}


function renderAIHand(container,hand,vertical){

    container.innerHTML = "";

    for(let i=0;i<hand.length;i++){

        const el =
            document.createElement("div");

        el.className = "ai-tile";

        container.appendChild(el);

    }

}

// =============================
// AI选择换三张
// =============================

function chooseAIExchange(hand){

    const counts = {
        "万":0,
        "条":0,
        "筒":0
    };

    hand.forEach(tile=>{
        counts[tile.suit]++;
    });

    // 必须选择至少有3张的花色
    const available =
        suits.filter(
            suit=>counts[suit]>=3
        );

    let target = available[0];

    for(const suit of available){

        if(counts[suit] < counts[target]){

            target = suit;

        }

    }

    return hand
        .filter(tile=>tile.suit===target)
        .slice(0,3);

}

function aiCanClaim(index,tile){
    if(!activePlayers[index+1]){ return null; }
    const matches = aiHands[index].filter(card=>card.suit===tile.suit && card.value===tile.value);
    if(matches.length>=3){ return {kind:"明杠",tiles:matches.slice(0,3)}; }
    if(matches.length>=2 && Math.random()<.7){ return {kind:"碰",tiles:matches.slice(0,2)}; }
    return null;
}

function tryAiClaim(tile,sourceSeat,continueGame){
    const candidateCount=sourceSeat===0 ? 3 : 2;
    for(let offset=1;offset<=candidateCount;offset++){
        const seat=((sourceSeat-1+offset)%3)+1;
        const index=seat-1;
        const claim=aiCanClaim(index,tile);
        if(!claim){ continue; }
        aiHands[index]=removeTiles(aiHands[index],claim.tiles);
        const meld=[...claim.tiles,tile];
        meld.kind=claim.kind==="碰" ? "peng" : "gang";
        aiMelds[index].push(meld);
        if(lastDiscardEl){ lastDiscardEl.remove(); }
        if(claim.kind==="明杠"){ recordGangScore("明杠",seat,sourceSeat); }
        activeSeat=seat;
        statusEl.textContent=`AI${seat}${claim.kind} ${tileLabel(tile)}，${claim.kind==="明杠" ? "正在补牌" : "正在出牌"}`;
        render();
        setTimeout(()=>aiTurnOne(index,claim.kind==="碰"),aiDelay());
        return true;
    }
    continueGame();
    return false;
}

function aiTurn(startIndex=0){

    if(phase!=="playing"){
        return;
    }

    aiTurnOne(startIndex);

}


function aiTurnOne(index,skipDraw=false){

    if(
        phase!=="playing" ||
        index>=3
    ){

        if(phase==="playing"){

            playerDraw();

        }

        return;
    }

    if(!activePlayers[index+1]){

        setTimeout(
            ()=>aiTurnOne(index+1),
            aiDelay()
        );

        return;

    }

    activeSeat = index+1;

    if(wall.length===0 && !skipDraw){

        endGame(
            "牌墙已经摸完，本局结束"
        );

        return;
    }

    const hand =
        aiHands[index];

    // 被碰/明杠后直接出牌；正常回合先摸牌。
    if(!skipDraw){
        hand.push(wall.pop());
        sortHand(hand);
    }

    render();

    const aiGangTiles = findFourTiles(hand);

    if(aiGangTiles){

        aiHands[index] = removeTiles(hand,aiGangTiles);
        aiMelds[index].push(aiGangTiles);
        aiGangTiles.kind = "gang";
        aiGangTiles.concealed = true;
        recordGangScore("暗杠",index+1);
        statusEl.textContent = `AI${index+1}暗杠，正在补牌`;
        render();

        setTimeout(
            ()=>aiTurnOne(index),
            aiDelay()
        );

        return;

    }

    // AI自摸
    if(
        canAIHu(index,hand)
    ){

        declareWin(
            index+1,
            `AI${index+1}自摸胡牌！`,
            ()=>aiTurnOne(index+1)
        );

        return;
    }

    // AI出牌
    const discardIndex =
        chooseAIDiscard(
            hand,
            aiLacks[index]
        );

    const tile =
        hand.splice(
            discardIndex,
            1
        )[0];

    addDiscard(tile,index+1);

    render();

    const huSeats = getDiscardHuSeats(tile,index+1);

    if(huSeats.length){

        if(huSeats.includes(0)){

            offerDiscardHu(
                huSeats,
                tile,
                index+1,
                ()=>aiTurnOne(index+1)
            );

        }else{

            resolveDiscardHu(
                huSeats,
                tile,
                index+1,
                ()=>aiTurnOne(index+1)
            );

        }

        return;

    }

    if(canPeng(tile)){

        offerPeng(tile,index);

        return;

    }

    if(tryAiClaim(tile,index+1,()=>setTimeout(()=>aiTurnOne(index+1),aiDelay()))){
        return;
    }


}

// AI出牌策略
// =============================

function chooseAIDiscard(hand,lack){

    const lackIndexes = [];

    hand.forEach(
        (tile,index)=>{

            if(tile.suit===lack){

                lackIndexes.push(index);

            }

        }
    );

    if(lackIndexes.length){

        return lackIndexes[
            Math.floor(
                Math.random() *
                lackIndexes.length
            )
        ];

    }

    let bestIndexes = [];
    let lowestKeepScore = Infinity;

    hand.forEach((tile,index)=>{

        const keepScore = getAITileKeepScore(tile,hand);

        if(keepScore<lowestKeepScore){

            lowestKeepScore = keepScore;
            bestIndexes = [index];

        }else if(keepScore===lowestKeepScore){

            bestIndexes.push(index);

        }

    });

    return bestIndexes[
        Math.floor(Math.random()*bestIndexes.length)
    ];

}


function getAITileKeepScore(tile,hand){

    const sameTiles = hand.filter(handTile=>
        handTile.suit===tile.suit &&
        handTile.value===tile.value
    ).length;

    const nearbyTiles = hand.filter(handTile=>
        handTile.suit===tile.suit &&
        handTile.value!==tile.value &&
        Math.abs(handTile.value-tile.value)<=2
    ).length;

    const afterDiscard = hand.filter(card=>card!==tile);
    const waits = countWaitingTiles(afterDiscard);
    const exposed = discardHistory.filter(card=>card.suit===tile.suit && card.value===tile.value).length;
    let score = (sameTiles-1)*6 + nearbyTiles*2 + waits*3 - exposed;

    if(tile.value===1 || tile.value===9){

        score -= 1;

    }

    return score;

}

function countWaitingTiles(hand){
    if(hand.length%3!==1){ return 0; }
    let count=0;
    for(const suit of suits){
        for(let value=1;value<=9;value++){
            if(canHu(hand.concat([{suit,value}]))){ count++; }
        }
    }
    return count;
}
