"use strict";

const suits = ["万","条","筒"];

// =============================
// 创建牌
// =============================
// =============================
// 创建牌
// =============================

function createTiles(){

    const tiles = [];

    for(const suit of suits){

        for(let value=1;value<=9;value++){

            for(let copy=0;copy<4;copy++){

                tiles.push({
                    suit,
                    value,
                    id:
                        suit +
                        value +
                        "-" +
                        copy +
                        "-" +
                        Math.random()
                });

            }

        }

    }

    return tiles;
}

// =============================
// 洗牌
// =============================
// =============================
// 洗牌
// =============================

function shuffle(arr){

    for(let i=arr.length-1;i>0;i--){

        const j =
            Math.floor(Math.random()*(i+1));

        [arr[i],arr[j]] =
            [arr[j],arr[i]];
    }
}

// =============================
// 排序
// =============================
// =============================
// 排序
// =============================

function sortHand(hand){

    const order = {
        "万":0,
        "条":1,
        "筒":2
    };

    hand.sort((a,b)=>{

        if(order[a.suit] !== order[b.suit]){

            return order[a.suit] -
                   order[b.suit];
        }

        return a.value-b.value;

    });
}

function tileLabel(tile){
    return `${tile.value}${tile.suit}`;
}

// =============================
// 删除牌
// =============================
// =============================
// 删除牌
// =============================

function removeTiles(hand,tiles){

    const result =
        hand.slice();

    for(const tile of tiles){

        const index =
            result.indexOf(tile);

        if(index!==-1){

            result.splice(index,1);

        }

    }

    return result;
}
