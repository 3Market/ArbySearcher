import { TickMath } from "@uniswap/v3-sdk";
import { Interface } from "ethers/lib/utils";
import { IUniswapV3PoolStateInterface } from "../types/v3/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState";
import { TickResponse } from "./decodeResults";
import { MappedCallResponse, singleContractMultipleValue } from "./mutlipleContractSingleData";
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { UniswapInterfaceMulticall } from '../types/v3/UniswapInterfaceMulticall';
import { logTickResponse } from "./logs";

export async function getAllTicksForPool(poolAddress: string, multicallContract: UniswapInterfaceMulticall) {
    const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface

    //TODO: Get this from the contract
    const TICK_SPACING = 10;

    const parameters = [];
    // for(let i = TickMath.MIN_TICK; i < TickMath.MAX_TICK; i++) {
    for(let i = 206000; i < 210000; i+= TICK_SPACING) {
        parameters.push([i]);
    }
    console.log('Making Request')
    const tickResponse = await singleContractMultipleValue<TickResponse>(
            multicallContract, poolAddress, POOL_STATE_INTERFACE, 'ticks', parameters)
        .catch(err => console.log('Mapped Call Responose error:' + err)) as MappedCallResponse<TickResponse>

    logTickResponse(tickResponse);
    
        // liquidity += tickRange.liquidityNet
        // sqrtPriceLow = 1.0001 ** (tick // 2)
        // sqrtPriceHigh = 1.0001 ** ((tick + TICK_SPACING) // 2)
}