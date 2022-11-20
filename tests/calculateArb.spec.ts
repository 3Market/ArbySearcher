import { CurrencyAmount, Price, Token } from "@uniswap/sdk-core";
import { ethers } from "ethers";
import { ArbitrageInputMap, calculateArb, PathMap } from "../rules/abitrage"
import { logArbitrageMap } from "../rules/logs";
import { pool } from "../types/v3/v3-core/artifacts/contracts/interfaces";

describe('calculateArb', () => {
    let poolByTokenAddress: ArbitrageInputMap;
    const tokenA = new Token(137, '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', 18, 'A', 'A Token');
    const tokenB = new Token(137, '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6', 18, 'B', 'B Token');
    const tokenC = new Token(137, '0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7', 18, 'C', 'C Token');
    beforeEach(() => {
        poolByTokenAddress = {
            [tokenA.address] : { 
                inputToken: tokenA,
                outputMap: { 
                    [tokenB.address]: { outputToken: tokenB, details: [
                        {
                            poolAddress: '0xAB',
                            liquidity:  '100',
                            outputAmount: new Price<Token, Token>(tokenA, tokenB, "1", "2"),
                        }
                    ] },
                    [tokenC.address]: { outputToken: tokenC, details: [
                        {
                            poolAddress: '0xAC',
                            liquidity:  '100',
                            outputAmount: new Price<Token, Token>(tokenA, tokenC, "4", "1"),
                        }
                    ] },

                }
            },
            [tokenB.address] : { 
                inputToken: tokenB,
                outputMap: { 
                    [tokenC.address]: { outputToken: tokenC, details: [
                        {
                            poolAddress: '0xBC',
                            liquidity:  '100',
                            outputAmount: new Price<Token, Token>(tokenB, tokenC, "1", "2"),
                        }
                    ] },
                    [tokenA.address]: { outputToken: tokenA, details: [
                        {
                            poolAddress: '0xAC',
                            liquidity:  '100',
                            outputAmount: new Price<Token, Token>(tokenB, tokenA, "2", "1"),
                        }
                    ] },

                }
            },
            [tokenC.address] : { 
                inputToken: tokenC,
                outputMap: { 
                    [tokenA.address]: { outputToken: tokenA, details: [
                        {
                            poolAddress: '0xAC',
                            liquidity:  '100',
                            outputAmount: new Price<Token, Token>(tokenC, tokenA, "1", "4"),
                        }
                    ] },
                    [tokenB.address]: { outputToken: tokenB, details: [
                        {
                            poolAddress: '0xBC',
                            liquidity:  '100',
                            outputAmount: new Price<Token, Token>(tokenC, tokenB, "2", "1"),
                        }
                    ]  },
                }
            },
        };
    })

    it('calculate Arb should return proper amount', async() => {
        const rawAmount = ethers.utils.parseUnits("1", tokenA.decimals);
        
        const amount = CurrencyAmount.fromRawAmount(tokenA, rawAmount.toString())

        console.log(`${tokenA.address} to ${amount.currency.address} ${tokenA.address === amount.currency.address}` )

        const outputAmount = calculateArb(amount, [tokenB.address, tokenC.address, tokenA.address], poolByTokenAddress);
        
        const expectedRawAmount = ethers.utils.parseUnits("16", tokenA.decimals);
        const expectedAmount = CurrencyAmount.fromRawAmount(tokenA, expectedRawAmount.toString())
        expect(expectedAmount.equalTo(outputAmount)).toBeTruthy();
        
    });
})