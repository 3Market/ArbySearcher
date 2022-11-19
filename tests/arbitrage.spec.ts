import { Token } from "@uniswap/sdk-core";
import { ArbitrageInputMap, buildPathMap, PathMap } from "../rules/abitrage"
import { pool } from "../types/v3/v3-core/artifacts/contracts/interfaces";

describe('buildPathMap', () => {
    let poolByTokenAddress: ArbitrageInputMap;
    const A = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
    const B = '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6';
    const C = '0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7';
    const D = '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063';
    beforeEach(() => {

        const tokenA = new Token(137, A, 18, 'A');
        const tokenB = new Token(137, B, 18, 'B');
        const tokenC = new Token(137, C, 18, 'C');
        const tokenD = new Token(137, D, 18, 'D');
        poolByTokenAddress = {
            [A] : { 
                inputToken: tokenA,
                outputMap: { 
                    [C]: { outputToken: tokenC, details: [] },
                    [D]: { outputToken: tokenD, details: [] }
                }
            },
            [B] : { 
                inputToken: tokenB,
                outputMap: { 
                    [C]: { outputToken: tokenC, details: [] },
                }
            },
            [C] : { 
                inputToken: tokenC,
                outputMap: { 
                    [A]: { outputToken: tokenA, details: [] },
                    [B]: { outputToken: tokenB, details: [] },
                }
            },
            [D] : { 
                inputToken: tokenD,
                outputMap: { 
                    [A]: { outputToken: tokenA, details: [] },
                }
            }
        };

    })

    it('should not be null', async() => {
        expect(poolByTokenAddress).toBeDefined();
    });

    it('depth 0 should contain neighbors', async() => {
        const pathMap: PathMap = buildPathMap(poolByTokenAddress, 1);
        expect(pathMap[A][A]["0"]).toEqual([]);
        expect(pathMap[A][B]["0"]).toEqual([]);
        expect(pathMap[A][C]["0"][0][0]).toEqual(C);
        expect(pathMap[A][D]["0"][0][0]).toEqual(D);
        expect(pathMap[B][C]["0"][0][0]).toEqual(C);
        expect(pathMap[C][A]["0"][0][0]).toEqual(A);
        expect(pathMap[C][B]["0"][0][0]).toEqual(B);
        expect(pathMap[D][A]["0"][0][0]).toEqual(A);
    });
})