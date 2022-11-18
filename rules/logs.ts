import { Pool } from "@uniswap/v3-sdk";
import { BigNumber } from "ethers";
import { ArbitrageInputMap } from "./abitrage";
import { slot0Response } from "./decodeResults";
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

export function logQuotes(slot0Data: MappedCallResponse<BigNumber>) {
    console.log(`LOG QUOTES -----`)

    console.log(`length: ${slot0Data.length}`)

    console.log(`block number: ${slot0Data.blockNumber}`);
    slot0Data.returnData.forEach(returnData => {
        console.log(`success: ${returnData.success}`);
        console.log(`return data: ${returnData.returnData}`);
    })
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
            console.log(`\t ${outputNode.outputToken.name}`);
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