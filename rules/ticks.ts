import { LiquidityMath, Pool, SwapMath, TickMath } from "@uniswap/v3-sdk";
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

const MAX_UINT_256 = JSBI.BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface

export async function getTickRangeResponses(lowerBound: number, upperBound: number, pool: ExtendedPool,
    multicallContract: UniswapInterfaceMulticall) {
    
    const tickSpacing = pool.tickSpacing;

    const parameters = [];
    for(let i = lowerBound; i <= upperBound; i+= tickSpacing) {
        parameters.push([i]);
    }

    return singleContractMultipleValue<TickResponse>(
            multicallContract, pool.poolAddress, POOL_STATE_INTERFACE, 'ticks', parameters)
        .catch(err => console.log('Mapped Call Responose error:' + err)) as Promise<MappedCallResponse<TickResponse>>
}

export function getPoolContract(poolAddress: string, provider: JsonRpcProvider) {
    return getContract<IUniswapV3PoolState>(poolAddress, IUniswapV3PoolStateABI, provider) as IUniswapV3PoolState;
}

export function getTickBounds(tick: number, poolSpacing: number) :{lowerTick: number, upperTick:number } {
   const result: any = {}
   //Round towards negative infinity
   result.lowerTick =  Math.floor(tick / poolSpacing) * poolSpacing;
   result.upperTick = result.lowerTick + poolSpacing;
   return result;
}

export function calculateTickRange(currentTick: number, poolSpacing: number, targetPrice: JSBI) 
    :{lowerTick: number, upperTick:number } 
{
    let {lowerTick, upperTick } = getTickBounds(currentTick, poolSpacing);
    let finalTick = TickMath.getTickAtSqrtRatio(targetPrice);
    let finalBounds = getTickBounds(finalTick, poolSpacing);

    return {
       lowerTick: Math.min(lowerTick, finalBounds.lowerTick),
       upperTick: Math.max(upperTick, finalBounds.upperTick)
    }
}
 

//amount of x in range; sp - sqrt of current price, sb - sqrt of max price
function x_in_range(L: JSBI, currentPrice: JSBI, priceBounds: JSBI) {
    // L * (sb - sp) / (sp * sb)
    const dif = JSBI.subtract(priceBounds, currentPrice);
    const product = JSBI.multiply(currentPrice, priceBounds);
    const ratio = JSBI.divide(dif, product);
    return JSBI.multiply(L, ratio);
}

//TODO: this looks wrong, this doesn't account for the portion of the 
//liquidity which has already been traded if this was the current tick range
//amount of y in range; sp - sqrt of current price, sa - sqrt of min price
function y_in_range(L: JSBI, sp: JSBI, sa: JSBI) {
    // L * (sp - sa)
    const dif = JSBI.subtract(sp, sa);
    return JSBI.multiply(L, dif);
}

export async function volumeToReachTargetPrice(pool: ExtendedPool, isDirection0For1: boolean, 
      multicallContract: UniswapInterfaceMulticall, sMaxPriceTarget: JSBI) {
    // how much of X or Y tokens we need to *buy* to get to the target price?
    let deltaTokenIn: JSBI = JSBI.BigInt(0);
    let deltaTokenOut: JSBI = JSBI.BigInt(0);

    const tickSpacing = pool.tickSpacing;

    let liquidity = pool.liquidity;
    let sPriceCurrent: JSBI = pool.sqrtRatioX96
    let {lowerTick, upperTick} = getTickBounds(pool.tickCurrent, tickSpacing);
    let tickRange = calculateTickRange(pool.tickCurrent, tickSpacing, sMaxPriceTarget);

    const tickRangeResponse = await getTickRangeResponses(tickRange.lowerTick, tickRange.upperTick, pool, multicallContract);
    const tickToResponseMap: {[key: string]:TickResponse} = {};
    tickRangeResponse.returnData.map((data, i) => {
        const key = tickRange.lowerTick + (i*tickSpacing);
        tickToResponseMap[key] = data.returnData
    });

    //if direction is 0 for 1 then the price direction should be decreasing
    let nextTick = isDirection0For1 ? lowerTick : upperTick;
    //the tick range bounds should reflect the tick bound of the price inclusive to overflow
    let limitTick = isDirection0For1 ? tickRange.lowerTick : tickRange.upperTick;
    console.log(`TC: ${pool.tickCurrent}, TL: ${lowerTick}, TU: ${upperTick}, TRL: ${tickRange.lowerTick} TRU: ${tickRange.upperTick}`);
    console.log(`is0For1: ${isDirection0For1} limit tick: ${limitTick}`);

    const direction = isDirection0For1 ? -1 : 1;
    while(nextTick != limitTick) {
        const nextPrice = getNextPrice(nextTick, isDirection0For1, sMaxPriceTarget); 
        const [sqrtPriceX96, amountIn, amountOut, feeAmount]
              = SwapMath.computeSwapStep(sPriceCurrent, nextPrice, liquidity, MAX_UINT_256, pool.fee);

        //console.log(`amountIn=${amountIn} amountOut=${amountOut}`);
        //console.log(`  currentTick=${TickMath.getTickAtSqrtRatio(sPriceCurrent)} nextTick=${TickMath.getTickAtSqrtRatio(nextPrice)} `);

        deltaTokenIn = JSBI.ADD(JSBI.ADD(deltaTokenIn, amountIn), feeAmount);
        deltaTokenOut = JSBI.ADD(deltaTokenOut, amountOut);

        sPriceCurrent = sqrtPriceX96
        const { liquidityNet } = tickToResponseMap[nextTick];
        let normalizedLiquidityNet = JSBI.BigInt(liquidityNet.toString());
        if (isDirection0For1) {
            // if we're moving leftward, we interpret liquidityNet as the opposite sign
            // safe because liquidityNet cannot be type(int128).min
            normalizedLiquidityNet = JSBI.unaryMinus(normalizedLiquidityNet);
        }

        liquidity = LiquidityMath.addDelta(liquidity, normalizedLiquidityNet);

        nextTick = nextTick + (tickSpacing * direction);
    }
    return { amountIn: deltaTokenIn, amountOut: deltaTokenOut }
}

function getNextPrice(nextTick: number, isDirection0For1:boolean, sMaxPriceTarget: JSBI) {
    const nextPriceTarget = TickMath.getSqrtRatioAtTick(nextTick);
    // Verbose for readability
    if(isDirection0For1) {
        // If the Direction is 0 for 1 then the price should be decreasing
        // there for we want to take the larger price as 
        // (the least price will be beyond our target)
        return JSBI.greaterThan(nextPriceTarget, sMaxPriceTarget) ? nextPriceTarget : sMaxPriceTarget
    } else {
        // If the Direction is 1 for 0 then the price should be increasing
        // there for we want to take the lesser price as 
        // (the higher price will be beyond our target)
        return JSBI.greaterThan(nextPriceTarget, sMaxPriceTarget) ? sMaxPriceTarget : nextPriceTarget 
    }
}

async function volumeToReachTargetPriceOld(pool: ExtendedPool, provider: JsonRpcProvider) {
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
