import { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";
import { ethers } from "ethers";
import { Quoter } from "../types/v3/v3-periphery/artifacts/contracts/lens/Quoter";
import { PairData } from "./pairsGenerator";

export function getQuoterParams(pairs: PairData[], tokenAmount: string) {
    return pairs.map(p => {
        //TODO: the token amount needs to be normalized do a dollar, this is for testing purposes
        const parsedAmountIn = ethers.utils.parseUnits(tokenAmount, p.token0.decimals);
        return [
                p.token0.address, 
                p.token1.address, 
                p.feeAmount?.toString(), 
                parsedAmountIn, 
                0]
    })
}

export const getQuotedPrice = async (quoterContract: Quoter, inputAmount: string, inputToken: Token, quoteToken: Token, feeAmount: FeeAmount) => { 
    const parsedAmountIn = ethers.utils.parseUnits(inputAmount, inputToken.decimals);
    return quoterContract.callStatic.quoteExactInputSingle(inputToken.address, quoteToken.address, feeAmount, parsedAmountIn, 0);
}