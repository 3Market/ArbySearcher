import { BigNumber, ethers } from 'ethers';
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json' 
import { abi as MulticallABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/UniswapInterfaceMulticall.sol/UniswapInterfaceMulticall.json'
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { computePoolAddress, FeeAmount, Pool } from '@uniswap/v3-sdk'
import { MULTICALL_ADDRESS, QUOTER_ADDRESS, SupportedExchanges, V3_CORE_FACTORY_ADDRESSES } from "./rules/constants";
import { USDC_POLYGON, USDT_POLYGON, DAI_POLYGON, PRIMARY_ARBITRAGE_ASSETS } from "./rules/tokens";
import env from 'dotenv'
import { Interface } from 'ethers/lib/utils';
import { IUniswapV3PoolStateInterface } from './types/v3/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState';
import { MappedCallResponse, MethodArg, singleContractMultipleValue, multipleContractSingleValue } from './rules/mutlipleContractSingleData';
import { slot0Response } from './rules/decodeResults';
import { getMulticallContract, getQuoterContract } from './rules/getContract';
import { Token } from '@uniswap/sdk-core';
import { Quoter } from './types/v3/v3-periphery/artifacts/contracts/lens';
import { format } from 'path';
import { buildPairs, fetchQuickswapTokenlist, PairData } from './rules/pairsGenerator';
import { logPools, logQuotes, logSlot0Data, logTokenPrices } from './rules/logs';
import { QuoterInterface } from './types/v3/v3-periphery/artifacts/contracts/lens/Quoter';
// import { getAvailableUniPools } from './rules/pool';
import { getQuotedPrice, getQuoterParams } from './rules/quoterRule';
import type { JsonRpcProvider } from '@ethersproject/providers'
import { getAvailableUniPools, getPools, PoolData } from './rules/pool';
import { UniswapInterfaceMulticall } from './types/v3/UniswapInterfaceMulticall';
import { calculateSuperficialArbitrages } from './rules/abitrage';
import { getAllTicksForPool } from './rules/ticks';
import { pool } from './types/v3/v3-core/artifacts/contracts/interfaces';
import { fetchTokenPrices } from './rules/prices';


env.config();

const arbySearch = async () => {

    const INFURA_URL_MAINNET = process.env.INFURA_URL_MAINNET
    const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_MAINNET);
    const factoryAddress = V3_CORE_FACTORY_ADDRESSES[SupportedExchanges.Uniswap];
    const multicallAddress = MULTICALL_ADDRESS[SupportedExchanges.Uniswap];
    const quoterAddress = QUOTER_ADDRESS[SupportedExchanges.Uniswap];
    const tradeAmount = "1";

    //const tradableTokens = await fetchQuickswapTokenlist();
    //const pairs = buildPairs(tradableTokens, [FeeAmount.LOWEST, FeeAmount.LOW]);

    //const pairs = buildPairs(PRIMARY_ARBITRAGE_ASSETS, [FeeAmount.LOWEST, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH]);
    const pairs = buildPairs([USDC_POLYGON, USDT_POLYGON, DAI_POLYGON], [FeeAmount.LOWEST, FeeAmount.LOW]);

    console.log(pairs.length);
    
    const allPoolData = await getAvailableUniPools(pairs, tradeAmount, factoryAddress, provider);
    const availablePoolData = allPoolData.filter(x => x.isQuotable);

    console.log(availablePoolData.length);

    const poolAddresses = availablePoolData.map(x => x.poolAddress);
    console.log('pool address: ' + poolAddresses);

    const multicallContract = getMulticallContract(multicallAddress, MulticallABI, provider);

    const pools = await getPools(availablePoolData, multicallContract);
    logPools(pools);

    const poolsWithliquidity = pools.filter(x => x.liquidity.toString() !== '0');
    console.log(`num of pools with liquidity: ${poolsWithliquidity.length}`);
    calculateSuperficialArbitrages(poolsWithliquidity);
    
    //logSlot0Data(slot0Response as MappedCallResponse<slot0Response>);

    const QUOTER_INTERFACE = new Interface(QuoterABI) as QuoterInterface
    const quoterParams = getQuoterParams(availablePoolData, tradeAmount);
    const quotesResponse = await singleContractMultipleValue<BigNumber>(multicallContract, quoterAddress, QUOTER_INTERFACE, 'quoteExactInputSingle', quoterParams)
        .catch(err => console.log('quotes error:' + err))


    if(!(quotesResponse instanceof Object)) {
        throw new Error('void quotes response');
    }
    //logQuotes(quotesResponse as MappedCallResponse<BigNumber>);

    await getAllTicksForPool('0x45dda9cb7c25131df268515131f647d726f50608', multicallContract);

    const priceMap = await fetchTokenPrices(PRIMARY_ARBITRAGE_ASSETS.map(x => x.address));
    logTokenPrices(PRIMARY_ARBITRAGE_ASSETS, priceMap);
}


function formatPrice(amount: BigNumber, decimals: number) {
    return amount.toNumber() / Math.pow(10, decimals)
}


arbySearch();