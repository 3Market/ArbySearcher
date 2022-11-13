import { ethers } from 'ethers';
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json' 
import { abi as SwapRouterABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json'
import { abi as MulticallABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/UniswapInterfaceMulticall.sol/UniswapInterfaceMulticall.json'
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk'
import { MULTICALL_ADDRESS, SupportedExchanges, V3_CORE_FACTORY_ADDRESSES } from "./rules/constants";
import { USDC_POLYGON, USDT_POLYGON, DAI_POLYGON } from "./rules/tokens";
import env from 'dotenv'
import { getMulticall } from "./rules/multicall";
import JSBI from 'jsbi';
import { Fraction } from '@uniswap/sdk-core';
import { Interface } from 'ethers/lib/utils';
import { IUniswapV3PoolStateInterface } from './types/v3/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState';
import { MappedCallResponse, executeMulticall } from './rules/mutlipleContractSingleData';
import { slot0Response } from './rules/decodeResults';

env.config();

const arbySearch = async () => {

    const WALLET_ADDRESS = process.env.WALLET_ADDRESS ?? '';
    const INFURA_URL_MAINNET = process.env.INFURA_URL_MAINNET
    const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_MAINNET);
    const factoryAddress = V3_CORE_FACTORY_ADDRESSES[SupportedExchanges.Uniswap];
    const multicallAddress = MULTICALL_ADDRESS[SupportedExchanges.Uniswap];
    console.log('factory address:' + factoryAddress);

    const feeAmount = FeeAmount.LOW
    const poolAddress1 = computePoolAddress({factoryAddress: factoryAddress, tokenA: USDC_POLYGON, tokenB: USDT_POLYGON, fee: feeAmount});
    const poolAddress2 = computePoolAddress({factoryAddress: factoryAddress, tokenA: USDC_POLYGON, tokenB: DAI_POLYGON, fee: feeAmount});
    // const poolAddress3 = computePoolAddress({factoryAddress: factoryAddress, tokenA: USDC_POLYGON, tokenB: USDT_POLYGON, fee: FeeAmount.HIGH});
    // const poolAddress4 = computePoolAddress({factoryAddress: factoryAddress, tokenA: USDC_POLYGON, tokenB: DAI_POLYGON, fee: FeeAmount.HIGH});
    const poolAddresses = [
        poolAddress1, 
        poolAddress2,
        // poolAddress3,
        // poolAddress4
    ];
    console.log('pool address: ' + poolAddresses);

    const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface

    const multicallContract = getMulticall(provider, multicallAddress, MulticallABI);
    const results = await executeMulticall(multicallContract, poolAddresses, POOL_STATE_INTERFACE, 'slot0').catch(err => console.log('error:' + err))
    
    if(!(results instanceof Object)) {
        throw new Error('void response');
    }

    const resultsData = results as MappedCallResponse<slot0Response>;
    console.log(`length: ${resultsData.length}`)

    console.log(`block number: ${resultsData.blockNumber}`);
    resultsData.returnData.forEach(returnData => {
        console.log(`success: ${returnData.success}`);
        console.log(`return data: ${returnData.returnData}`);
        console.log(`sqrtPriceX96: ${returnData.returnData.sqrtPriceX96}`);
    })
}



arbySearch();