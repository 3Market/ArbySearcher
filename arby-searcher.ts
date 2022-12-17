import { BigNumber, ethers } from 'ethers';
import { abi as MulticallABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/UniswapInterfaceMulticall.sol/UniswapInterfaceMulticall.json'
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { computePoolAddress, FeeAmount, Pool, TickMath } from '@uniswap/v3-sdk'
import { MULTICALL_ADDRESS, QUOTER_ADDRESS, SupportedExchanges, V3_CORE_FACTORY_ADDRESSES } from "./rules/constants";
import { USDC_POLYGON, USDT_POLYGON, DAI_POLYGON, PRIMARY_ARBITRAGE_ASSETS, ETH_POLYGON } from "./rules/tokens";
import env from 'dotenv'
import { Interface } from 'ethers/lib/utils';
import { MappedCallResponse, MethodArg, singleContractMultipleValue, multipleContractSingleValue } from './rules/mutlipleContractSingleData';
import { slot0Response } from './rules/decodeResults';
import { getContract, getMulticallContract, getQuoterContract } from './rules/getContract';
import { Quoter } from './types/v3/v3-periphery/artifacts/contracts/lens';
import { format } from 'path';
import { buildPairs, fetchQuickswapTokenlist, PairData } from './rules/pairsGenerator';
import { logPools, logQuotes, logSlot0Data, logTokenPrices } from './rules/logs';
import { QuoterInterface } from './types/v3/v3-periphery/artifacts/contracts/lens/Quoter';
// import { getAvailableUniPools } from './rules/pool';
import { getParsedQuotedPrice, getQuotedPrice, getQuoterParams } from './rules/quoterRule';
import type { JsonRpcProvider } from '@ethersproject/providers'
import { ExtendedPool, getAvailableUniPools, getPools, PoolData } from './rules/pool';
import { UniswapInterfaceMulticall } from './types/v3/UniswapInterfaceMulticall';
import { calculateSuperficialArbitrages } from './rules/abitrage';
import { getPoolContract, volumeToReachTargetPrice } from './rules/ticks';
import { fetchTokenPrices } from './rules/prices';
import JSBI from "jsbi";
import { Fraction } from '@uniswap/sdk-core';

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
    const pairs = buildPairs([USDC_POLYGON, USDT_POLYGON, DAI_POLYGON, ETH_POLYGON], [FeeAmount.LOWEST, FeeAmount.LOW]);

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

    //await getAllTicksForPool('0x45dda9cb7c25131df268515131f647d726f50608', multicallContract);

    const priceMap = await fetchTokenPrices(PRIMARY_ARBITRAGE_ASSETS.map(x => x.address));
    logTokenPrices(PRIMARY_ARBITRAGE_ASSETS, priceMap);

    const USDC_WETH_LOW_UNISWAP_POOL_ADDRESS = '0x45dda9cb7c25131df268515131f647d726f50608';
    const usdcWethPool = poolsWithliquidity.filter(x => x.poolAddress.toLowerCase() == USDC_WETH_LOW_UNISWAP_POOL_ADDRESS)[0]

    await verifyVolumeToReachTargetPrice(provider, multicallContract, usdcWethPool, -10);
    await verifyVolumeToReachTargetPrice(provider, multicallContract, usdcWethPool, +10);

    await verifyVolumeToReachTargetPrice(provider, multicallContract, usdcWethPool, -100);
    await verifyVolumeToReachTargetPrice(provider, multicallContract, usdcWethPool, +100);

    await verifyVolumeToReachTargetPrice(provider, multicallContract, usdcWethPool, -1000);
    await verifyVolumeToReachTargetPrice(provider, multicallContract, usdcWethPool, +1000);
}

async function verifyVolumeToReachTargetPrice(provider: JsonRpcProvider, 
          multicallContract: UniswapInterfaceMulticall, pool: ExtendedPool,
          deltaTicks: number) {
    console.log(`verifying that amounts match, deltaTicks: ${deltaTicks}...`);
    const priceTarget = TickMath.getSqrtRatioAtTick(pool.tickCurrent + deltaTicks);
    const isDirection0For1 = JSBI.lessThan(priceTarget, pool.sqrtRatioX96);
    const amounts = await volumeToReachTargetPrice(pool, isDirection0For1, multicallContract, priceTarget);

    const assetIn = isDirection0For1 ? USDC_POLYGON : ETH_POLYGON;
    const assetOut = isDirection0For1 ? ETH_POLYGON : USDC_POLYGON;
    const expectedAmountOut = formatJSBI(amounts.amountOut, assetOut.decimals);
    console.log(`Amount In: ${formatJSBI(amounts.amountIn, assetIn.decimals)} 
        Out: ${expectedAmountOut}`);

    const quoterContract = getContract(QUOTER_ADDRESS[SupportedExchanges.Uniswap], QuoterABI, provider) as Quoter;
    const parsedAmountIn = BigNumber.from(amounts.amountIn.toString());
    const quoterAmountOutBN = await getParsedQuotedPrice(quoterContract, parsedAmountIn, assetIn, assetOut, FeeAmount.LOW);
    const quoterAmountOut = JSBI.BigInt(quoterAmountOutBN.toString());

    const maxErrorPercent = 0; // set this to nonzero to allow some errors
    if (!approximatelyEqual(amounts.amountOut, quoterAmountOut, maxErrorPercent)) {
        console.log(`failed! Calculated amount out: ${expectedAmountOut}, quoter result: ${formatJSBI(quoterAmountOut, assetOut.decimals)}`);
        return false;
    }
    console.log(`verified!\n`);
    return true;
}

function formatJSBI(amount: JSBI, decimals: number) {
    return new Fraction(amount, JSBI.BigInt(Math.pow(10, decimals))).toSignificant(decimals)
}

function formatPrice(amount: BigNumber, decimals: number) {
    return parseInt(amount.toHexString()) / Math.pow(10, decimals)
}

function approximatelyEqual(x: JSBI, y: JSBI, maxErrorPercent: number) {
    const _100 = JSBI.BigInt(100);
    const minY = JSBI.divide(JSBI.multiply(y, JSBI.BigInt(100 - maxErrorPercent)), _100);
    if (JSBI.lessThan(x, minY)) {
        return false;
    }
    const maxY = JSBI.divide(JSBI.multiply(y, JSBI.BigInt(100 + maxErrorPercent)), _100);
    if (JSBI.greaterThan(x, maxY)) {
        return false;
    }
    return true;
}

// not used for now
function approximatelyEqualIgnoreSomeDigits(x: JSBI, y: JSBI, digits: number) {
    const n = JSBI.BigInt(Math.pow(10, digits));
    x = JSBI.divide(x, n);
    y = JSBI.divide(y, n);
    return JSBI.equal(x, y);
}

arbySearch();
