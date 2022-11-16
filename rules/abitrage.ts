import { Pool } from '@uniswap/v3-sdk'
import Heap from 'heap-js';
import _ from 'lodash';
import { from } from "linq-to-typescript"
import { hexStripZeros } from 'ethers/lib/utils';
import { pool } from '../types/v3/v3-core/artifacts/contracts/interfaces';


type Mapish = { [k: string]: boolean };

//Developer Note:
// We have an array of pools each pool has T0 and T1,
// T0 and T1 belong to a set {Tokens} however T0 may not have all the same tokens t1 has (0due to liquidity constraints)
// 1. Pools with only 1 exit should be filtered out as leafs cannot be arbitraged
// 2. Pools need to be aggregate into forwards and backwards paths
// 3. Each pools should be store as a Dictionary, and each dictionary should contain an object with min and max heap of the (prices - fee)
//       In the future this should support how much liquidity it would take to move the price to the next pool
// 4. 
//Note: Superfical does not take the impact the swap would have on the market
export function CalculateSuperficialArbitrages(pools: Pool[], depth: 2) {

    const tokens = from(pools.flatMap(x => [x.token0, x.token1])).distinct().toArray();
    pools.reduce((result: any, currentValue) => {
        // If an array already present for key, push it to the array. Else create an array and push the object
        (result[currentValue.token0.address] = result[currentValue.token0.address] || []).push(
            currentValue
        );
        // Return the current iteration `result` value, this will be taken as next iteration `result` value and accumulate
        return result;
    }, {});

    //const poolGroups = _.groupBy(pools, x => `${x.token0.address}-${x.token1.address}`);
    const linqGroups = from(pools).groupBy(x => `${x.token0.address}-${x.token1.address}` );
    const poolMaps = linqGroups.select(x => {
        return {
            key: x.key,
            minHeap: Heap.heapify(x.toArray(), minComparator),
            maxHeap: Heap.heapify(x.toArray(), maxComparator)
        }
    }).toMap(x => x.key);
        
}

function minComparator(a: Pool, b: Pool) {
    return 1;
    //return a.token1Price.subtract(b.token1Price).toFixed(a.token1.decimals);
}

function maxComparator(a: Pool, b: Pool) {
    return 1;
    //return a.token1Price.subtract(b.token1Price).toFixed(a.token1.decimals);
}
