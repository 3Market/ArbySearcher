import { Pool, TickMath } from "@uniswap/v3-sdk";
import { Interface } from "ethers/lib/utils";
import { IUniswapV3PoolState, IUniswapV3PoolStateInterface } from "../types/v3/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState";
import { slot0Response, TickResponse } from "./decodeResults";
import { MappedCallResponse, singleContractMultipleValue } from "./mutlipleContractSingleData";
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { UniswapInterfaceMulticall } from '../types/v3/UniswapInterfaceMulticall';
import { logTickResponse } from "./logs";
import { BigNumber } from "ethers";
import { CurrencyAmount, Token } from "@uniswap/sdk-core";
import { pool } from "../types/v3/v3-core/artifacts/contracts/interfaces";
import { ExtendedPool } from "./pool";
import { getContract } from "./getContract";
import type { JsonRpcProvider } from '@ethersproject/providers'
import JSBI from "jsbi";

const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface
const PoolTickChunk = 1000;

export async function GetTickRange(multicallContract: UniswapInterfaceMulticall, pool: ExtendedPool, additionalPct: number = 10) {
    const tickSpacing = pool.tickSpacing;
    const {upperTick: upperBound, lowerTick: lowerBounds } = getTickBounds(pool.tickCurrent, tickSpacing)

    const parameters = [];
    const startTick = lowerBounds - (PoolTickChunk * tickSpacing);
    for(let i = 0; i < (PoolTickChunk * 2); i++) {
        const currentTick = (i*tickSpacing) + startTick;
        parameters.push([i]);
    }
    console.log('Making Request')
    const tickResponse = await singleContractMultipleValue<TickResponse>(
            multicallContract, pool.poolAddress, POOL_STATE_INTERFACE, 'ticks', parameters)
        .catch(err => console.log('Mapped Call Responose error:' + err)) as MappedCallResponse<TickResponse>

    logTickResponse(tickResponse);
}

export function getPoolContract(poolAddress: string, provider: JsonRpcProvider) {
    return getContract<IUniswapV3PoolState>(poolAddress, IUniswapV3PoolStateABI, provider) as IUniswapV3PoolState;
}

export function getTickBounds(tick: number, poolSpacing: number) :{lowerTick: number, upperTick:number } {
   const result: any = {}
   result.upperTick =  Math.floor(tick / poolSpacing) * poolSpacing;
   result.lowerTick = result.lowerBounds + poolSpacing;
   return result;
}

//amount of x in range; sp - sqrt of current price, sb - sqrt of max price
function x_in_range(L: JSBI, currentPrice: JSBI, priceBounds: JSBI) {
    // L * (sb - sp) / (sp * sb)
    const dif = JSBI.subtract(priceBounds, currentPrice);
    const product = JSBI.multiply(currentPrice, priceBounds);
    const ratio = JSBI.divide(dif, product);
    return JSBI.multiply(L, ratio);
}

//amount of y in range; sp - sqrt of current price, sa - sqrt of min price
function y_in_range(L: JSBI, sp: JSBI, sa: JSBI) {
    // L * (sp - sa)
    const dif = JSBI.subtract(sp, sa);
    return JSBI.multiply(L, dif);
}



async function volumeToReachTargetPrice(pool: ExtendedPool, provider: JsonRpcProvider) {
    // how much of X or Y tokens we need to *buy* to get to the target price?
    let deltaTokens: JSBI = JSBI.BigInt(0);
    const tickSpacing = pool.tickSpacing;
    let {lowerTick, upperTick} = getTickBounds(pool.tickCurrent, tickSpacing);
    const decimalsX = pool.token0.decimals;
    const decimalsY = pool.token1.decimals;
    const contract = getPoolContract(pool.poolAddress, provider);
    let liquidity = pool.liquidity;
    let sPriceCurrent: JSBI = pool.sqrtRatioX96
    let sPriceUpper: JSBI = TickMath.getSqrtRatioAtTick(upperTick);
    let sPriceLower: JSBI = TickMath.getSqrtRatioAtTick(lowerTick);
    const sPriceTarget: JSBI = JSBI.ADD(pool.sqrtRatioX96, 1);
    

    if (sPriceTarget > sPriceCurrent) {
        // too few Y in the pool; we need to buy some X to increase amount of Y in pool
        while (sPriceTarget > sPriceCurrent) {
            if (sPriceTarget > sPriceUpper) {
                // not in the current price range; use all X in the range
                const x = x_in_range(liquidity, sPriceCurrent, sPriceUpper)
                deltaTokens = JSBI.ADD(deltaTokens, x);
                // query the blockchain for liquidity in the next tick range
                
                const nextTickRange = await contract.ticks(upperTick);
                liquidity = JSBI.add(liquidity, JSBI.BigInt(nextTickRange.liquidityNet.toString()))
                // adjust the price and the range limits
                sPriceCurrent = sPriceUpper
                lowerTick = upperTick
                upperTick += tickSpacing
                sPriceLower = sPriceUpper
                sPriceUpper = TickMath.getSqrtRatioAtTick(upperTick)
            }
            else {
                // in the current price range
                const x = x_in_range(liquidity, sPriceCurrent, sPriceTarget)
                deltaTokens = JSBI.ADD(deltaTokens, x);
                sPriceCurrent = sPriceTarget
            }
        }
        console.log(`need to buy ${JSBI.divide(deltaTokens,  JSBI.BigInt(10 ** decimalsX)).toString()} X tokens`)
    }
    else if (sPriceTarget < sPriceCurrent) {
        // too much Y in the pool; we need to buy some Y to decrease amount of Y in pool
        while (sPriceTarget < sPriceCurrent) {
            if (sPriceTarget < sPriceLower) {
                // not in the current price range; use all Y in the range
                const y = y_in_range(liquidity, sPriceCurrent, sPriceLower)
                deltaTokens = JSBI.ADD(deltaTokens, y);
                
                // query the blockchain for liquidityNet in the *current* tick range
                const currentTickRange = await contract.ticks(lowerTick);
                liquidity = JSBI.subtract(liquidity, JSBI.BigInt(currentTickRange.liquidityNet.toString()))
                // adjust the price and the range limits
                sPriceCurrent = sPriceLower
                upperTick = lowerTick
                lowerTick -= tickSpacing
                sPriceUpper = sPriceLower
                sPriceLower = TickMath.getSqrtRatioAtTick(lowerTick)
            } else {
                // in the current price range
                const y = y_in_range(liquidity, sPriceCurrent, sPriceTarget)
                deltaTokens = JSBI.ADD(deltaTokens, y);
                sPriceCurrent = sPriceTarget
            }
        }
        console.log(`need to buy ${JSBI.divide(deltaTokens,  JSBI.BigInt(10 ** decimalsY)).toString() } Y tokens`);
    }
}