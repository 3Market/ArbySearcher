import { Pool } from "@uniswap/v3-sdk";
import { BigNumber } from "ethers";
import { ArbitrageInputMap, CircuitMap, PathMap } from "./abitrage";
import { slot0Response, TickResponse } from "./decodeResults";
import { MappedCallResponse } from "./mutlipleContractSingleData";

export function logSlot0Data(slot0Data: MappedCallResponse<slot0Response>) {
    console.log(`length: ${slot0Data.length}`)

    console.log(`block number: ${slot0Data.blockNumber}`);
    slot0Data.returnData.forEach(returnData => {
        console.log(`success: ${returnData.success}`);
        console.log(`return data: ${returnData.returnData}`);
        console.log(`sqrtPriceX96: ${returnData.returnData.sqrtPriceX96}`);
    })
}

export function logTickResponse(slot0Data: MappedCallResponse<TickResponse>) {
    console.log(`length: ${slot0Data.length}`)

    console.log(`block number: ${slot0Data.blockNumber}`);
    slot0Data.returnData.forEach((returnData, i) => {
        console.log(`success: ${returnData.success}`);
        console.log(`Index: ${i} is Initialized: ${returnData.returnData.initialized} data: ${returnData.returnData}`);
    })
}



export function logCircuits(circuitMap: CircuitMap) {
    for(let key in circuitMap)  {
      console.log(`circuits for key: ${key}`);
      circuitMap[key].forEach(path => {
          console.log(`\t${key}->${path.join('->')}`)
      }) 
    }  
  }

export function logQuotes(slot0Data: MappedCallResponse<BigNumber>) {
    console.log(`LOG QUOTES -----`)

    console.log(`length: ${slot0Data.length}`)

    console.log(`block number: ${slot0Data.blockNumber}`);
    slot0Data.returnData.forEach(returnData => {
        console.log(`success: ${returnData.success}`);
        console.log(`return data: ${returnData.returnData}`);
    })
}

export function logPathMap(map: PathMap) {
    Object.keys(map).forEach(inputKey => {
        console.log(`key: ${inputKey} has paths`);
        const inputNode = map[inputKey];

        Object.keys(inputNode).forEach(outputKey => {
            console.log(`\t to output: ${outputKey}`);
            const outputDepthMap = inputNode[outputKey];
            Object.keys(outputDepthMap).forEach(depth => {
                console.log(`\t\t at depth: ${depth}`)
                const paths = outputDepthMap[depth];
                paths.forEach(path =>{
                    console.log(`\t\t\t path: ${path.join('->')}`)
                })
            })
        })
    });
}

export function logArbitrageMap(map: ArbitrageInputMap) {
    Object.keys(map).forEach(inputKey => {
        const inputNode = map[inputKey];
        const i = inputNode.inputToken;
        console.log(`Token: ${i.name} key: ${inputKey}`);
        const outputMap = inputNode.outputMap;
        Object.keys(outputMap).forEach(outputKey => {
            const outputNode = outputMap[outputKey];
            const o = outputNode.outputToken;
            console.log(`\t ${outputNode.outputToken.name} - address-Key: ${outputKey}`);
            outputNode.details.forEach(d => {
                console.log(`\t\t ${i.symbol}-${o.symbol} price: ${d.outputAmount.toSignificant(6)} Liquidity:${d.liquidity} Pool Address: ${d.poolAddress}`); 
            })
        })
    })
}

export function logPools(pools: Pool[]) {
    pools.forEach(p => {
        console.log(`${p.token0.symbol}-${p.token1.symbol}:${p.fee} t0 price: ${p.token0Price.toSignificant(6)} t1 price: ${p.token1Price.toSignificant(6)}`)
    })
}