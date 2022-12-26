import { BigNumber } from 'ethers';
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { abi as FactoryABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json'
import { computePoolAddress, FeeAmount, Pool, Tick, TickConstructorArgs, TickDataProvider } from '@uniswap/v3-sdk'
import {  QUOTER_ADDRESS, SupportedExchanges } from "./constants";
import { Interface } from 'ethers/lib/utils';
import { IUniswapV3PoolStateInterface } from '../types/v3/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState';
import { MappedCallResponse, multipleContractSingleValue, singleContractMultipleValue } from './mutlipleContractSingleData';
import { slot0Response } from './decodeResults';
import { getQuoterContract } from './getContract';
import { PoolDetails } from './pairsGenerator';
// import { getAvailableUniPools } from './rules/pool';
import { getQuotedPrice } from './quoterRule';
import type { JsonRpcProvider } from '@ethersproject/providers'
import { UniswapInterfaceMulticall } from '../types/v3/UniswapInterfaceMulticall';
import { BigintIsh, sqrt, Token } from '@uniswap/sdk-core';
import { IUniswapV3FactoryInterface } from '../types/v3/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory';
import { logPoolResponse } from './logs';

export interface ExtendedPoolDetails extends PoolDetails {
    poolAddress: string,
    exists: boolean,
}

export class ExtendedPool extends Pool {
    poolAddress: string;
    constructor(
        poolAddress: string,
        tokenA: Token, 
        tokenB: Token, 
        fee: FeeAmount, 
        sqrtRatioX96: BigintIsh, 
        liquidity: BigintIsh, 
        tickCurrent: number, 
        ticks?: TickDataProvider | (Tick | TickConstructorArgs)[]) {
            super(tokenA, tokenB, fee, sqrtRatioX96, liquidity, tickCurrent, ticks)
            this.poolAddress = poolAddress;
    }
}

export const getPools = async(poolData: ExtendedPoolDetails[], multicallContract: UniswapInterfaceMulticall) => {

    const poolAddresses = poolData.map(p => p.poolAddress); 
    const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface
    const slot0Response = await multipleContractSingleValue<slot0Response>(multicallContract, poolAddresses, POOL_STATE_INTERFACE, 'slot0')
        .catch(err => console.log('slot0 error:' + err)) as MappedCallResponse<slot0Response>

    //TODO: these should come from the same block
    const liquiditiesResponse = await multipleContractSingleValue<[BigNumber]>(multicallContract, poolAddresses, POOL_STATE_INTERFACE, 'liquidity')
        .catch(err => console.log('Liquidity error:' + err)) as MappedCallResponse<[BigNumber]>
    
    console.log('get pools');

    const s0length = slot0Response.returnData.length;
    const liquidityLength = liquiditiesResponse.returnData.length; 
    if(s0length != poolData.length) {
        throw new Error(`slot0 length: ${s0length} does not equal pool data length: ${poolData.length}`)
    }
    if (liquidityLength != poolData.length) {
        throw new Error(`liquidity length: ${s0length} does not equal pool data length: ${poolData.length}`)
    }

    return poolData.map((p, i) => { 
        const poolState = slot0Response.returnData[i].returnData;
        const liquidity = liquiditiesResponse.returnData[i].returnData[0];

        return new ExtendedPool(
            p.poolAddress,
            p.token0,
            p.token1,
            p.feeAmount ?? 0,
            poolState.sqrtPriceX96.toString(),
            liquidity.toString(),
            poolState.tick); 
    });
}

export async function getAvailablePoolsFromFactory(pairs: PoolDetails[], multicallContract: UniswapInterfaceMulticall, factoryAddress: string, provider: JsonRpcProvider) 
     : Promise<ExtendedPoolDetails[]> {

    const V3_FACTORY_INTERFACE = new Interface(FactoryABI) as IUniswapV3FactoryInterface
    const params = pairs.map(p => [p.token0.address, p.token1.address, p.feeAmount?.toString()])
    const poolsResponse = await singleContractMultipleValue<string>(multicallContract, factoryAddress, V3_FACTORY_INTERFACE, 'getPool', params)
            .catch(err => console.log('error:' + err)) as MappedCallResponse<string>

    //logPoolResponse(poolsResponse);

    return pairs.map((pair, i) => {
        const pool = poolsResponse.returnData[i];
        return {
            ...pair,
            exists: pool.success,
            //We need to lower for some bs checksum reasons
            poolAddress: pool.returnData.toString().toLowerCase()
        }
    }).filter(x => x.exists);
}