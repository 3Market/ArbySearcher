import { BigNumber, ethers } from 'ethers';
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json' 
import { abi as MulticallABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/UniswapInterfaceMulticall.sol/UniswapInterfaceMulticall.json'
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { computePoolAddress, FeeAmount, priceToClosestTick } from '@uniswap/v3-sdk'
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
import { buildPairs, PairData } from './rules/pairsGenerator';
import { logQuotes, logSlot0Data } from './rules/logs';
import { QuoterInterface } from './types/v3/v3-periphery/artifacts/contracts/lens/Quoter';
import { UniswapInterfaceMulticall } from './types/v3/UniswapInterfaceMulticall';

env.config();

const arbySearch = async () => {

    const INFURA_URL_MAINNET = process.env.INFURA_URL_MAINNET
    const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_MAINNET);
    const factoryAddress = V3_CORE_FACTORY_ADDRESSES[SupportedExchanges.Uniswap];
    const multicallAddress = MULTICALL_ADDRESS[SupportedExchanges.Uniswap];
    const quoterAddress = QUOTER_ADDRESS[SupportedExchanges.Uniswap];
    const tradeAmount = "1";

    // const pairs = buildPairs(PRIMARY_ARBITRAGE_ASSETS, [FeeAmount.LOWEST, FeeAmount.LOW]);
    const pairs = buildPairs([USDC_POLYGON, USDT_POLYGON, DAI_POLYGON], [FeeAmount.LOWEST, FeeAmount.LOW]);
    const poolAddresses = pairs.filter(p => !!p.feeAmount)
        .map(p => computePoolAddress({factoryAddress: factoryAddress, tokenA: p.token0, tokenB: p.token1, fee: p.feeAmount ?? 0}))

    console.log('pool address: ' + poolAddresses);

    const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface
    const QUOTER_INTERFACE = new Interface(QuoterABI) as QuoterInterface

    const multicallContract = getMulticallContract(multicallAddress, MulticallABI, provider);
    const slot0Response = await multipleContractSingleValue<slot0Response>(multicallContract, poolAddresses, POOL_STATE_INTERFACE, 'slot0')
        .catch(err => console.log('error:' + err))
    
    const quoterParams = getQuoterParams(pairs, tradeAmount);
    const quotesResponse = await singleContractMultipleValue<BigNumber>(multicallContract, quoterAddress, QUOTER_INTERFACE, 'quoteExactInputSingle', quoterParams)

    // const quoterContract = getQuoterContract(quoterAddress, QuoterABI, provider);
    // const quote = await getQuotedPrice(quoterContract, tradeAmount, USDC_POLYGON, USDT_POLYGON, feeAmount);
    // const formattedQuote = formatPrice(quote, USDT_POLYGON.decimals);
    // console.log(`quote: ${formattedQuote}`);

    if(!(quotesResponse instanceof Object)) {
        throw new Error('void quotes response');
    }

    logQuotes(quotesResponse as MappedCallResponse<BigNumber>);

    if(!(slot0Response instanceof Object)) {
        throw new Error('void slot0 response');
    }

    logSlot0Data(slot0Response as MappedCallResponse<slot0Response>);
}

function getQuoterParams(pairs: PairData[], tokenAmount: string) {
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

function formatPrice(amount: BigNumber, decimals: number) {
    return amount.toNumber() / Math.pow(10, decimals)
}

const getQuotedPrice = async (quoterContract: Quoter, inputAmount: string, inputToken: Token, quoteToken: Token, feeAmount: FeeAmount) => { 
    const parsedAmountIn = ethers.utils.parseUnits(inputAmount, inputToken.decimals);
    return quoterContract.callStatic.quoteExactInputSingle(inputToken.address, quoteToken.address, feeAmount, parsedAmountIn, 0);
}


arbySearch();