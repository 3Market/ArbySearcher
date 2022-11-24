import { BigNumber } from 'ethers';
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { computePoolAddress, FeeAmount, Pool, Tick, TickConstructorArgs, TickDataProvider } from '@uniswap/v3-sdk'
import {  QUOTER_ADDRESS, SupportedExchanges } from "./constants";
import { Interface } from 'ethers/lib/utils';
import { IUniswapV3PoolStateInterface } from '../types/v3/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState';
import { MappedCallResponse, multipleContractSingleValue } from './mutlipleContractSingleData';
import { slot0Response } from './decodeResults';
import { getQuoterContract } from './getContract';
import { PairData } from './pairsGenerator';
// import { getAvailableUniPools } from './rules/pool';
import { getQuotedPrice } from './quoterRule';
import type { JsonRpcProvider } from '@ethersproject/providers'
import { UniswapInterfaceMulticall } from '../types/v3/UniswapInterfaceMulticall';
import { BigintIsh, sqrt, Token } from '@uniswap/sdk-core';

export interface PoolData extends PairData {
    poolAddress: string,
    isQuotable: boolean,
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

export const getPools = async(poolData: PoolData[], multicallContract: UniswapInterfaceMulticall) => {

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

export async function getAvailableUniPools(pairs: PairData[], tradeAmount: string, factoryAddress: string, provider: JsonRpcProvider) 
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