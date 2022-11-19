import { Pool } from '@uniswap/v3-sdk'
import _, { mapKeys } from 'lodash';
import { from } from "linq-to-typescript"
import { hexStripZeros } from 'ethers/lib/utils';
import { pool } from '../types/v3/v3-core/artifacts/contracts/interfaces';
import { ExtendedPool } from './pool';
import Heap from 'heap';
import { Price, Token } from '@uniswap/sdk-core';
import { logArbitrageMap, logPathMap } from './logs';
import { Queue } from 'queue-typescript';
import { defaultMaxListeners } from 'events';
import { BigNumber } from 'ethers';


export type ArbitrageInputMap = Map<ArbitrageInputNode>
export type ArbitrageOutputDetailMap = Map<ArbitrageOutputDetail>
export type Map<TValue> = {[key:string]:TValue }
export type PathMap = Map<Map<Map<string[][]>>>
export type CircuitMap = Map<string[][]>;

 interface ArbitrageInputNode {
    inputToken: Token
    outputMap: ArbitrageOutputDetailMap
 }

 interface ArbitrageOutputDetail {
    outputToken: Token
    details: ArbitragePoolDetail[]
 }

 interface ArbitragePoolDetail {
    poolAddress: string
    liquidity: string
    outputAmount: Price<Token, Token>
 }

//Developer Note:
// We have an array of pools each pool has T0 and T1,
// T0 and T1 belong to a set {Tokens} however T0 may not have all the same tokens t1 has (0due to liquidity constraints)
// 1. Pools with only 1 exit should be filtered out as leafs cannot be arbitraged
// 2. Pools need to be aggregate into forwards and backwards paths
// 3. Each pools should be store as a Dictionary, and each dictionary should contain an object with min and max heap of the (prices - fee)
//       In the future this should support how much liquidity it would take to move the price to the next pool
// 4. Calculating the optimal route.  
//       Calculating the optimal route is an issue, since the aribtrage calcations are done on a backend server 
//       the long it takes to calculate the aribtrage, the less probability that the arbitrage is still going 
//       to be there when the transaction is executed.
//    Soltions: 
//    
///   Ideally you could precaluate everything using Bellman Fords' so and map the routes based off the weighed size of everything 
//    However if we were to take all the pool into consideration it would take alot of computing power to make sure that all the routes were 
//    precalcuted per block. Instead it may be more ideal to hook into a websocket for v3 and maintain a running map of all the precalculate routes
//    dynamically update them based off of the affects of any transaction on the block chain.  But that would be an institution level project
//    add utter madness to develop

//    The alternative should be more time efficient, and robust enough for what were trying to achieve.
//    Self Balancing pools will work the following way:
//         1. user swaps from T0 - T1, leaving T0 imbalanced.
//         2. Precalculate all the routes from T1 with back to the intial pool included for rebalance based on N depth (Multihops)
//         3. Chain the swap back together to reenter to original pool with a la
//    Example:  
//Note: Superfical does not take the impact the swap would have on the market
export function calculateSuperficialArbitrages(pools: ExtendedPool[], depth = 2) {

    const tokens = from(pools.flatMap(x => [x.token0, x.token1])).distinct().toArray();
    const poolByTokenAddress = getArbitrageMapOrderOutputDesc(pools);
    
    //logArbitrageMap(poolByTokenAddress);
    console.log('---------------------------------');
    const pathMap = buildPathMap(poolByTokenAddress, 3);
    console.log('---------------------------------');
    //logPathMap(pathMap);

    const circuits = getCircuits(pathMap, poolByTokenAddress);
    logCircuits(circuits);
}

function logCircuits(circuitMap: CircuitMap) {
  for(let key in circuitMap)  {
    console.log(`circuits for key: ${key}`);
    circuitMap[key].forEach(path => {
        console.log(`\t${key}->${path.join('->')}`)
    }) 
  }  
}

function getCircuits(pathMap: PathMap, poolByTokenAddress: ArbitrageInputMap) {
    const circuitMap: CircuitMap = {};
    for (let key in poolByTokenAddress) {
        circuitMap[key] = [];
        const circuitPaths = pathMap[key][key];
        for(let depth in circuitPaths) {
            console.log('Any');
            circuitPaths[depth].forEach(path => circuitMap[key].push(path));
        }
    }

    return circuitMap;
}

//Gets all the simple paths up to K depth
// 1. Iterate over all the nodes, add the node neighbors as a path
// 2. Foreach additional iteration, iterate over all the neighbor paths from the depth before which end in my node and then append all my neighbors.
// A-C A-D B-C C-A C-B D-A
// 0 A ->
export function buildPathMap(poolByTokenAddress: ArbitrageInputMap,  maxDepth: number = 7) {
   const pathMap: PathMap = {}
   for(let inputKey in poolByTokenAddress) {
      pathMap[inputKey] = {}; 
      for(let outputKey in poolByTokenAddress) {
        pathMap[inputKey][outputKey] = {};
        pathMap[inputKey][outputKey][0] = [];
        if(poolByTokenAddress[inputKey].outputMap[outputKey]) {
            pathMap[inputKey][outputKey][0].push([outputKey]);
        }
      }
   }

   for(let i = 1; i < maxDepth; i++) {
      for(let inputKey in poolByTokenAddress) {
        for(let outputKey in poolByTokenAddress) {
            
            const ioPathMap = pathMap[inputKey][outputKey] || {};
            //Initialize depth if it doesn't exist
            ioPathMap[i] = ioPathMap[i] || [];
            const currentIOPathMap = ioPathMap[i];
            const previousIOPathMap = ioPathMap[i-1];
            // All the new paths are equal to all the previous paths 
            // plus all of the neighbors of the node which the previous path ended with

            for(let ppi in previousIOPathMap) {
                const previousPaths = previousIOPathMap[ppi]
                const [pathEnd] = previousPaths.slice(-1);
                console.log(`Adding Paths to ${poolByTokenAddress[inputKey].inputToken.symbol}-${poolByTokenAddress[inputKey].outputMap[outputKey].outputToken.symbol} at depth ${i}`);
                console.log(`key: ${poolByTokenAddress[inputKey].inputToken.address}`);
                for(let neighbor in poolByTokenAddress[pathEnd].outputMap) {
                    const newPath = previousPaths.slice(0);
                    newPath.push(neighbor);

                    console.log(`\t Path: ${newPath.join('->')}`);
                    currentIOPathMap.push(newPath);
                }
            }
        }
      }
   }

   return pathMap;
}

function populateArbitrageDetails(map: ArbitrageInputMap, inputToken: Token, outputToken: Token, pool: ExtendedPool, isReverse:boolean) {
    const inputKey = inputToken.address;
    if(!map[inputKey]) {        
        map[inputKey] = {
            inputToken: inputToken,
            outputMap: {}
        }
    }

    const outputKey = outputToken.address;
    const outputMap = map[inputKey].outputMap; 
    if(!outputMap[outputKey]) {
        outputMap[outputKey] = 
        {
            outputToken: outputToken,
            details: []
        }
    }

    outputMap[outputKey].details.push({
        poolAddress: pool.poolAddress,
        liquidity: pool.liquidity.toString(),
        //The price is how much you will get out given you put in 1 in the other side
        //so to get the output amount is equvalent to the input tokens price
        //Ref: WMATIC-USDT:10000 t0 price: 0.93758 t1 price: 1.06658
        outputAmount: isReverse ? pool.token1Price : pool.token0Price
    })
}

function getArbitrageMapOrderOutputDesc(pools: ExtendedPool[]) {
    const aribtrageMap: ArbitrageInputMap = pools.reduce((result: ArbitrageInputMap, currentValue) => {

        populateArbitrageDetails(result, currentValue.token0, currentValue.token1, currentValue, false);
        populateArbitrageDetails(result, currentValue.token1, currentValue.token0, currentValue, true);

        // Return the current iteration `result` value, this will be taken as next iteration `result` value and accumulate
        return result;
    }, {});

    const mapKeys = Object.keys(aribtrageMap);

    console.log('len:' + mapKeys.length);
    mapKeys.forEach(inputKey => {
        const node = aribtrageMap[inputKey];

        const outputKeys = Object.keys(node.outputMap);

        outputKeys.forEach(outputKey => {
            const outputNode = node.outputMap[outputKey];
            outputNode.details = outputNode.details 
              .sort((a,b) => a.outputAmount.greaterThan(b.outputAmount) ? -1 : 1)
        })
    })

    return aribtrageMap;
}
