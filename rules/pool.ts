import { BigNumber } from 'ethers';
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { abi as FactoryABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json'
import { abi as ERC20ABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IERC20Minimal.sol/IERC20Minimal.json'
import { ADDRESS_ZERO, computePoolAddress, FeeAmount, Pool, Tick, TickConstructorArgs, TickDataProvider } from '@uniswap/v3-sdk'
import {  QUOTER_ADDRESS, SupportedExchanges } from "./constants";
import { Interface } from 'ethers/lib/utils';
import { IUniswapV3PoolStateInterface } from '../types/v3/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState';
import { IERC20MinimalInterface } from '../types/v3/v3-core/artifacts/contracts/interfaces/IERC20Minimal';
import { MappedCallResponse, multipleContractMultipleValue, multipleContractSingleValue, singleContractMultipleValue } from './mutlipleContractSingleData';
import { slot0Response } from './decodeResults';
import { getQuoterContract } from './getContract';
import { PoolDetails } from './pairsGenerator';
// import { getAvailableUniPools } from './rules/pool';
import { getQuotedPrice } from './quoterRule';
import type { JsonRpcProvider } from '@ethersproject/providers'
import { UniswapInterfaceMulticall } from '../types/v3/UniswapInterfaceMulticall';
import { BigintIsh, CurrencyAmount, Price, sqrt, Token } from '@uniswap/sdk-core';
import { IUniswapV3FactoryInterface } from '../types/v3/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory';
import { logBalances, logPoolResponse } from './logs';
import { pick } from 'lodash';
import JSBI from 'jsbi';
import { USDC_POLYGON } from './tokens';

export interface ExtendedPoolDetails extends PoolDetails {
    poolAddress: string,
    shouldInclude: boolean,
    token0Balance?: CurrencyAmount<Token>
    token1Balance?: CurrencyAmount<Token>
    token0BalanceUSD?: number,
    token1BalanceUSD?: number,
    token0USDPrice?: number,
    token1USDPrice?: number
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

const V3_FACTORY_INTERFACE = new Interface(FactoryABI) as IUniswapV3FactoryInterface
const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface
const ECR20_INTERFACE = new Interface(ERC20ABI) as IERC20MinimalInterface

export const getPools = async(poolData: ExtendedPoolDetails[], multicallContract: UniswapInterfaceMulticall) => {

    const poolAddresses = poolData.map(p => p.poolAddress); 
    const slot0Response = await multipleContractSingleValue<slot0Response>(multicallContract, poolAddresses, POOL_STATE_INTERFACE, 'slot0')
        .catch(err => console.log('slot0 error:' + err)) as MappedCallResponse<slot0Response>

    //TODO: these should come from the same block
    const liquiditiesResponse = await multipleContractSingleValue<[BigNumber]>(multicallContract, poolAddresses, POOL_STATE_INTERFACE, 'liquidity')
        .catch(err => console.log('Liquidity error:' + err)) as MappedCallResponse<[BigNumber]>
    
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

export async function filterPools(pairs: ExtendedPoolDetails[], priceMap: {[key:string]:number }, multicallContract: UniswapInterfaceMulticall) {

    const token0Calls = pairs.map(x => { return { tokenAddress: x.token0.address, callInput: x.poolAddress }})
    const token1Calls = pairs.map(x => { return { tokenAddress: x.token1.address, callInput: x.poolAddress }})


    const token0Erc20Address = token0Calls.map(x => x.tokenAddress);
    const token0CallInputs = token0Calls.map(x => [x.callInput]);

    const token0Balances = await multipleContractMultipleValue<[BigNumber]>(multicallContract, token0Erc20Address, ECR20_INTERFACE, "balanceOf", token0CallInputs);

    const token1Erc20Address = token1Calls.map(x => x.tokenAddress);
    const token1CallInputs = token1Calls.map(x => [x.callInput]);
    const token1Balances = await multipleContractMultipleValue<[BigNumber]>(multicallContract, token1Erc20Address, ECR20_INTERFACE, "balanceOf", token1CallInputs);

    pairs.forEach((pair, i) => { 
        const t0JSBI = JSBI.BigInt(token0Balances.returnData[i].returnData[0]);
        const t1JSBI = JSBI.BigInt(token1Balances.returnData[i].returnData[0]);
        const token0USDPrice = priceMap[pair.token0.address]
        const token1USDPrice = priceMap[pair.token1.address]

        const balance0Price = new Price<Token, Token>(pair.token0, USDC_POLYGON, 1 * 10 ** pair.token0.decimals, Math.round(token0USDPrice * 1000000))
        const balance1Price = new Price<Token, Token>(pair.token1, USDC_POLYGON, 1 * 10 ** pair.token1.decimals, Math.round(token1USDPrice * 1000000))

        const t0Balance = CurrencyAmount.fromRawAmount(pair.token0, t0JSBI)
        const t1Balance = CurrencyAmount.fromRawAmount(pair.token1, t1JSBI)
        pair.token0Balance = t0Balance
        pair.token1Balance = t1Balance
        pair.token0USDPrice = token0USDPrice
        pair.token1USDPrice = token1USDPrice
        pair.token0BalanceUSD = Number(balance0Price.quote(t0Balance).toFixed(2))
        pair.token1BalanceUSD = Number(balance1Price.quote(t1Balance).toFixed(2))
    })

}


export async function getAvailableUniPools(pairs: PoolDetails[], tradeAmount: string, factoryAddress: string, provider: JsonRpcProvider) 
    : Promise<ExtendedPoolDetails[]> {

    const poolData = pairs.filter(p => !!p.feeAmount)
    .map(p => {
        return {
        ...p,
        poolAddress: computePoolAddress({factoryAddress: factoryAddress, tokenA: p.token0, tokenB: p.token1, fee: p.feeAmount ?? 0}),
        shouldInclude: false
        } as ExtendedPoolDetails
    })

    const quoterContract = getQuoterContract(QUOTER_ADDRESS[SupportedExchanges.Uniswap], QuoterABI, provider);
    const quotePromises = poolData.map(data => {
    const quote = getQuotedPrice(quoterContract, tradeAmount, data.token0, data.token1, data.feeAmount ?? 0)
        .then(r =>{
            data.shouldInclude = true;
            return data; 
        })
        .catch(err => { 
            console.log(`Pool is not Quotable: ${data.poolAddress}`)
            data.shouldInclude = false
            return data;
        });
        return quote;
    })

    return Promise.all(quotePromises);
}

export async function getAvailablePoolsFromFactory(pairs: PoolDetails[], multicallContract: UniswapInterfaceMulticall, factoryAddress: string, provider: JsonRpcProvider) 
     : Promise<ExtendedPoolDetails[]> {

    const params = pairs.map(p => [p.token0.address, p.token1.address, p.feeAmount?.toString()])
    const poolsResponse = await singleContractMultipleValue<string>(multicallContract, factoryAddress, V3_FACTORY_INTERFACE, 'getPool', params)
            .catch(err => console.log('error:' + err)) as MappedCallResponse<string>

    return pairs.map((pair, i) => {
        const pool = poolsResponse.returnData[i];
        return {
            ...pair,
            shouldInclude: pool.success,
            poolAddress: pool.returnData[0]
        }
    }).filter(x => x.shouldInclude && x.poolAddress !== ADDRESS_ZERO)
}