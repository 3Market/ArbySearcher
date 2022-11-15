import { computePoolAddress } from "@uniswap/v3-sdk/dist/utils/computePoolAddress";
import { getQuoterContract } from "./getContract";
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { QUOTER_ADDRESS, SupportedExchanges } from "./constants";
import { JsonRpcProvider } from '@ethersproject/providers'
import { getQuotedPrice } from "./quoterRule";

import { PairData } from "./pairsGenerator";

export interface PoolData extends PairData {
    poolAddress: string,
    isQuotable: boolean,
}

//Do not use: For some reason this causes a runtime error
export async function getAvailableUniPoolsBROKEN(pairs: PairData[], tradeAmount: string, factoryAddress: string, provider: JsonRpcProvider) 
    : Promise<PoolData[]> {

    const poolData = pairs.filter(p => !!p.feeAmount)
    .map(p => {
        return {
        ...p,
        poolAddress: computePoolAddress({factoryAddress: factoryAddress, tokenA: p.token0, tokenB: p.token1, fee: p.feeAmount ?? 0}),
        isQuotable: false
        } as PoolData
    })

    const quoterContract = getQuoterContract(QUOTER_ADDRESS[SupportedExchanges.Uniswap], QuoterABI, provider);
    const quotePromises = poolData.map(data => {
    const dataEnclosure = data;
    const quote = getQuotedPrice(quoterContract, tradeAmount, data.token0, data.token1, data.feeAmount ?? 0)
        .then(r =>{
            dataEnclosure.isQuotable = true;
            return dataEnclosure; 
        })
        .catch(err => { 
            dataEnclosure.isQuotable = false
            return dataEnclosure;
        });
        return quote;
    })

    return Promise.all(quotePromises);
}