import { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";
import _ from "lodash";

export type PairData = {
    name: string,
    token0: Token,
    token1: Token,
    feeAmount: FeeAmount | null
}

const quickswapTokenlistUrl = 'https://unpkg.com/quickswap-default-token-list@latest/build/quickswap-default.tokenlist.json';
export const fetchQuickswapTokenlist = async () => {
    
    return fetch(quickswapTokenlistUrl)
    .then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        }
        return response.json().then(r => r.tokens as Token[]);
    })
}

export function buildPairs(tokens: Token[], feeAmounts: FeeAmount[]) {
    return combineAllPairs(tokens, feeAmounts);
}

function combineAllPairs(tokens: Token[], feeAmounts: FeeAmount[]) {
    const sortedTokens = _.orderBy(tokens, 'address', 'asc');
    const pairs: PairData[] = [];
    for(let feeAmount of feeAmounts)
        for(let i = 0; i < sortedTokens.length; i++) {
            for(let j = i + 1; j < sortedTokens.length; j++) {
            const token0 = sortedTokens[i];
            const token1 = sortedTokens[j];
            const name = `${token0.symbol}-${token1.symbol}`
            pairs.push(
                {
                    name,
                    token0: token0,
                    token1: token1,
                    feeAmount: feeAmount
                }
            )
        }
    }

    return pairs;
}