"use strict";


// 对单条胡牌记录应用积分变化。只接受真实座位编号，避免 boolean 被当作数组下标。
function applyWinRecordScores(scores,record){
    const winner=record.seat;
    const fan=Number(record.fan);
    if(!Number.isInteger(winner) || winner<0 || winner>3 || !Number.isFinite(fan) || fan<0){
        throw new Error("无效的胡牌积分记录");
    }
    if(record.method==="点炮"){
        const payer=record.payerSeat;
        const payers=Array.isArray(record.payerSeats) ? record.payerSeats : [];
        if(Number.isInteger(payer) && payer>=0 && payer<4 && payer!==winner && payers.includes(payer)){
            scores[winner]+=fan;
            scores[payer]-=fan;
        }
        return;
    }
    const payers=Array.isArray(record.payerSeats)
        ? record.payerSeats
        : [0,1,2,3].filter(seat=>seat!==winner);
    [...new Set(payers)].forEach(payer=>{
        if(Number.isInteger(payer) && payer>=0 && payer<4 && payer!==winner){
            scores[payer]-=fan;
            scores[winner]+=fan;
        }
    });
}

function recordScoreEvent(label,from,to,amount){
    if(from===to || amount<=0){ return; }
    scoreEvents.push({label,from,to,amount});
}

function recordGangScore(kind,winner,source=null){
    const amount = kind==="暗杠" ? 2 : 1;
    if(kind==="明杠" && source!==null){
        recordScoreEvent(kind,source,winner,amount*2);
        return;
    }
    for(let seat=0;seat<4;seat++){
        if(seat!==winner && activePlayers[seat]){
            recordScoreEvent(kind,seat,winner,amount);
        }
    }
}

// =============================
// 暗杠
// =============================

function findGangTiles(){

    return findFourTiles(playerHand);

}


function findFourTiles(hand){

    for(const tile of hand){

        const matchingTiles = hand.filter(
            handTile=>
                handTile.suit===tile.suit &&
                handTile.value===tile.value
        );

        if(matchingTiles.length===4){

            return matchingTiles;

        }

    }

    return null;

}


function canGang(){

    if(pendingPeng){

        return Boolean(findDiscardGangTiles());

    }

    return playerHand.length===playerBaseHandSize()+1 &&
        (Boolean(findGangTiles()) || Boolean(findAddedGang()));

}


function findAddedGang(){

    return playerMelds.find(meld=>
        meld.kind==="peng" &&
        playerHand.some(tile=>
            tile.suit===meld[0].suit &&
            tile.value===meld[0].value
        )
    );

}


function findDiscardGangTiles(){

    if(!pendingPeng){

        return null;

    }

    const matches = playerHand.filter(tile=>
        tile.suit===pendingPeng.tile.suit &&
        tile.value===pendingPeng.tile.value
    );

    return matches.length>=3 ? matches.slice(0,3) : null;

}

// =============================
// 胡牌判断
// =============================

function isSevenPairs(hand){

    if(hand.length!==14){

        return false;

    }

    const counts = {};

    hand.forEach(tile=>{

        const key = tile.suit + tile.value;

        counts[key] = (counts[key]||0)+1;

    });

    return Object.values(counts).every(count=>count%2===0);

}


function getSeatTiles(seat){

    if(seat===0){

        return playerHand.concat(...playerMelds);

    }

    return aiHands[seat-1].concat(...aiMelds[seat-1]);

}


function isPureSuit(tiles){

    return new Set(tiles.map(tile=>tile.suit)).size===1;

}

function tileCounts(tiles){
    const counts={};
    tiles.forEach(tile=>{ const key=tile.suit+tile.value; counts[key]=(counts[key]||0)+1; });
    return counts;
}

function isDragonSevenPairs(hand){
    return isSevenPairs(hand) && Object.values(tileCounts(hand)).some(count=>count===4);
}

function isGoldHook(hand,meldCount){
    return meldCount===4 && hand.length===2 && hand[0].suit===hand[1].suit && hand[0].value===hand[1].value;
}

function isJiangDui(tiles,hand,meldCount){
    return tiles.every(tile=>[2,5,8].includes(tile.value)) && isAllTriplets(hand,meldCount);
}

function isAllTerminals(tiles){
    return tiles.every(tile=>tile.value===1 || tile.value===9);
}

function isAllWithTerminals(hand,melds){
    if(melds.some(meld=>!meld.some(tile=>tile.value===1 || tile.value===9))){
        return false;
    }
    const counts=tileCounts(hand);
    const keys=Object.keys(counts);
    const removeGroup=(group)=>{
        const copy={...counts};
        for(const key of group){ if(!copy[key]){ return null; } copy[key]--; }
        return copy;
    };
    const solve=(left)=>{
        const first=Object.keys(left).find(key=>left[key]>0);
        if(!first){ return true; }
        const suit=first.charAt(0), value=Number(first.slice(1));
        if(left[first]>=3 && (value===1 || value===9)){
            const copy={...left}; copy[first]-=3;
            if(solve(copy)){ return true; }
        }
        if(value===1 && left[suit+"2"]>0 && left[suit+"3"]>0){
            const copy={...left}; copy[first]--; copy[suit+"2"]--; copy[suit+"3"]--;
            if(solve(copy)){ return true; }
        }
        if(value===7 && left[suit+"8"]>0 && left[suit+"9"]>0){
            const copy={...left}; copy[first]--; copy[suit+"8"]--; copy[suit+"9"]--;
            if(solve(copy)){ return true; }
        }
        return false;
    };
    for(const pair of keys){
        if(counts[pair]<2 || ![1,9].includes(Number(pair.slice(1)))){ continue; }
        const rest={...counts}; rest[pair]-=2;
        if(solve(rest)){ return true; }
    }
    return false;
}


function isAllTriplets(hand,meldCount){

    if(hand.length!==14-meldCount*3){

        return false;

    }

    const counts = {};

    hand.forEach(tile=>{

        const key = tile.suit + tile.value;

        counts[key] = (counts[key]||0)+1;

    });

    return Object.values(counts).filter(count=>count%3===2).length===1 &&
        Object.values(counts).every(count=>count%3===0 || count%3===2);

}


function calculateFan(seat,method){

    const hand = seat===0 ? playerHand : aiHands[seat-1];
    const meldCount = seat===0 ? playerMelds.length : aiMelds[seat-1].length;
    const melds = seat===0 ? playerMelds : aiMelds[seat-1];
    const tiles = getSeatTiles(seat);
    const patterns = ["平胡"];
    let fan = 1;

    if(method==="自摸"){

        fan += 1;
        patterns.push("自摸");

    }

    if(isDragonSevenPairs(hand) && meldCount===0){

        fan += 4;
        patterns.push("龙七对");

    }else if(isSevenPairs(hand) && meldCount===0){

        fan += 2;
        patterns.push("七对");

    }else if(isAllTriplets(hand,meldCount)){

        fan += 2;
        patterns.push("碰碰胡");

    }

    if(isPureSuit(tiles)){

        fan += 4;
        patterns.push("清一色");

    }

    if(isPureSuit(tiles) && isSevenPairs(hand) && meldCount===0){
        patterns.push("清七对");
    }

    if(isGoldHook(hand,meldCount)){
        fan += 4;
        patterns.push("金钩钓");
    }

    if(isJiangDui(tiles,hand,meldCount)){
        fan += 4;
        patterns.push("将对");
    }

    if(isAllTerminals(tiles)){
        fan += 4;
        patterns.push("全幺九");
    }

    if(isAllWithTerminals(hand,melds)){
        fan += 2;
        patterns.push("全带幺");
    }

    if(seat===0 && method==="自摸" && lastDrawWasGang){

        fan += 2;
        patterns.push("杠上花");

    }

    if(fan>8){
        fan=8;
        patterns.push("8番封顶");
    }

    return {fan,patterns};

}

function canPlayerHu(hand){

    return !hand.some(tile=>tile.suit===playerLack) &&
        canHu(hand,playerMelds.length);

}


function canAIHu(index,hand){

    return !hand.some(tile=>tile.suit===aiLacks[index]) &&
        canHu(hand,aiMelds[index].length);

}


function canHu(hand,meldCount=0){

    if(hand.length!==14-meldCount*3){
        return false;
    }

    if(meldCount===0 && isSevenPairs(hand)){

        return true;

    }

    /*
        四川麻将这里只先实现：
        1对子 + 4组顺子/刻子
    */

    const counts = {};

    hand.forEach(tile=>{

        const key =
            tile.suit +
            tile.value;

        counts[key] =
            (counts[key]||0)+1;

    });

    const keys =
        Object.keys(counts);

    for(const pair of keys){

        if(counts[pair]<2){
            continue;
        }

        counts[pair]-=2;

        const remaining = [];

        for(const key of keys){

            for(
                let i=0;
                i<counts[key];
                i++
            ){

                remaining.push(key);

            }

        }

        remaining.sort((a,b)=>{

            const suitOrder = {"万":0,"条":1,"筒":2};
            const suitDifference =
                suitOrder[a.charAt(0)]-suitOrder[b.charAt(0)];

            if(suitDifference!==0){

                return suitDifference;

            }

            return Number(a.slice(1))-Number(b.slice(1));

        });

        if(
            canFormSets(
                remaining
            )
        ){

            counts[pair]+=2;

            return true;

        }

        counts[pair]+=2;

    }

    return false;

}


// =============================
// 判断剩余牌
// =============================

function canFormSets(cards){

    if(cards.length===0){
        return true;
    }

    const first =
        cards[0];

    const suit =
        first.charAt(0);

    const value =
        Number(
            first.slice(1)
        );

    // 刻子
    let count=0;

    for(const card of cards){

        if(card===first){
            count++;
        }

    }

    if(count>=3){

        const remaining =
            cards.slice();

        let removed=0;

        for(
            let i=remaining.length-1;
            i>=0;
            i--
        ){

            if(
                remaining[i]===first &&
                removed<3
            ){

                remaining.splice(i,1);

                removed++;

            }

        }

        if(
            canFormSets(
                remaining
            )
        ){

            return true;

        }

    }

    // 顺子
    if(value<=7){

        const second =
            suit+(value+1);

        const third =
            suit+(value+2);

        if(
            cards.includes(second) &&
            cards.includes(third)
        ){

            const remaining =
                cards.slice();

            removeOne(
                remaining,
                first
            );

            removeOne(
                remaining,
                second
            );

            removeOne(
                remaining,
                third
            );

            if(
                canFormSets(
                    remaining
                )
            ){

                return true;

            }

        }

    }

    return false;

}


function removeOne(arr,value){

    const index =
        arr.indexOf(value);

    if(index!==-1){

        arr.splice(
            index,
            1
        );

    }

}
