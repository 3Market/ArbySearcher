import { ethers } from "ethers";
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json' 
import SwapRouterABI from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json'
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk'
import { SupportedExchanges, V3_CORE_FACTORY_ADDRESSES } from "./rules/constants";
import { USDC_POLYGON, USDT_POLYGON } from "./rules/tokens";
import env from 'dotenv'

env.config();

const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET

const INFURA_URL_MAINNET = process.env.INFURA_URL_MAINNET
const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_MAINNET);
const factoryAddress = V3_CORE_FACTORY_ADDRESSES[SupportedExchanges.Uniswap];
console.log('factory address:' + factoryAddress);

const feeAmount = FeeAmount.HIGH
const poolAddress = computePoolAddress({factoryAddress: factoryAddress, tokenA: USDC_POLYGON, tokenB: USDT_POLYGON, fee: feeAmount});
console.log('pool address: ' + poolAddress);



