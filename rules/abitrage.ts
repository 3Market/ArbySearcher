import { Pool } from '@uniswap/v3-sdk'
import _, { mapKeys } from 'lodash';
import { from } from "linq-to-typescript"
import { hexStripZeros } from 'ethers/lib/utils';
import { pool } from '../types/v3/v3-core/artifacts/contracts/interfaces';
import { ExtendedPool } from './pool';
import Heap from 'heap';
import { Price, Token } from '@uniswap/sdk-core';
import { logArbitrageMap } from './logs';


export type ArbitrageMap = {[key:string]:ArbitrageDetails[] }
interface ArbitrageDetails {
    poolAddress: string,
    inputToken: Token,
    outputToken: Token,
    outputAmount: Price<Token, Token>
}

//Developer Note:
// We have an array of pools each pool has T0 and T1,
// T0 and T1 belong to a set {Tokens} however T0 may not have all the same tokens t1 has (0due to liquidity constraints)
// 1. Pools with only 1 exit should be filtered out as leafs cannot be arbitraged
// 2. Pools need to be aggregate into forwards and backwards paths
// 3. Each pools should be store as a Dictionary, and each dictionary should contain an object with min and max heap of the (prices - fee)
//       In the future this should support how much liquidity it would take to move the price to the next pool
// 4. 
//Note: Superfical does not take the impact the swap would have on the market
export function calculateSuperficialArbitrages(pools: ExtendedPool[], depth = 2) {

    const tokens = from(pools.flatMap(x => [x.token0, x.token1])).distinct().toArray();
    const poolByTokenAddress = getArbitrageMapOrderOutputDesc(pools);
    
    logArbitrageMap(poolByTokenAddress);

    // tokens.forEach(t => {
    //     const tokenPools = poolByTokenAddress[t.address]
    // })
        
}

function getArbitrageMapOrderOutputDesc(pools: ExtendedPool[]) {
    const aribtrageMap: ArbitrageMap = pools.reduce((result: any, currentValue) => {

        // if(!currentValue.token0Price || !currentValue.token1Price) {
        //     console.log(`${currentValue.token0.name}-${currentValue.token1.name} t0Price: ${currentValue.token0Price.toSignificant(6)} t1Price: ${currentValue.token1Price.toSignificant(6)}` );
        // }

        // If an array already present for key, push it to the array. Else create an array and push the object
        (result[currentValue.token0.address] = result[currentValue.token0.address] || []).push(
            {
                poolAddress: currentValue.poolAddress,
                inputToken: currentValue.token0,
                outputToken: currentValue.token1,
                //The price is how much you will get out given you put in 1 in the other side
                //so to get the output amount is equvalent to the input tokens price
                //Ref: WMATIC-USDT:10000 t0 price: 0.93758 t1 price: 1.06658 
                outputAmount: currentValue.token0Price,      
            } 
        );

        // If an array already present for key, push it to the array. Else create an array and push the object
        (result[currentValue.token1.address] = result[currentValue.token1.address] || []).push(
            {
                poolAddress: currentValue.poolAddress,
                inputToken: currentValue.token1,
                outputToken: currentValue.token0,
                //The price is how much you will get out given you put in 1 in the other side
                //so to get the output amount is equvalent to the input tokens price
                //Ref: WMATIC-USDT:10000 t0 price: 0.93758 t1 price: 1.06658 
                outputAmount: currentValue.token1Price,      
            }
        );
        // Return the current iteration `result` value, this will be taken as next iteration `result` value and accumulate
        return result;
    }, {});

    const mapKeys = Object.keys(aribtrageMap);

    console.log('len:' + mapKeys.length);
    mapKeys.forEach(k => {

        aribtrageMap[k] = aribtrageMap[k]
        .map((x,i) => { if(!x.outputAmount)console.log(`k:${k} i:${i}`); return x})
        .sort((a,b) => a.outputAmount.asFraction.greaterThan(b.outputAmount) ? 0 : 1);
    })

    return aribtrageMap;
}


function minComparator(a: Pool, b: Pool) {
    return 1;
    //return a.token1Price.subtract(b.token1Price).toFixed(a.token1.decimals);
}

function maxComparator(a: Pool, b: Pool) {
    return 1;
    //return a.token1Price.subtract(b.token1Price).toFixed(a.token1.decimals);
}
