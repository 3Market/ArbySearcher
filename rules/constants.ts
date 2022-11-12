export enum SupportedExchanges {
    Quickswap = 'Quickswap',
    Uniswap = 'Uniswap',
}

type ExchangeAddressMap = { [exchange in SupportedExchanges]: string };

export const V3_SWAP_ROUTER_ADDRESSES: ExchangeAddressMap = {
    [SupportedExchanges.Quickswap]: '0xf5b509bB0909a69B1c207E495f687a596C168E12',
    [SupportedExchanges.Uniswap]: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
};

export const V3_CORE_FACTORY_ADDRESSES: ExchangeAddressMap = {
    [SupportedExchanges.Quickswap]: '0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28',
    [SupportedExchanges.Uniswap]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
};
  
export const POOL_DEPLOYER_ADDRESS: ExchangeAddressMap = {
    [SupportedExchanges.Quickswap]: '0x2D98E2FA9da15aa6dC9581AB097Ced7af697CB92',
    [SupportedExchanges.Uniswap]: '',
};

export const MULTICALL_ADDRESS: ExchangeAddressMap = {
    [SupportedExchanges.Quickswap]: '0x6ccb9426CeceE2903FbD97fd833fD1D31c100292',
    [SupportedExchanges.Uniswap]:'0x1F98415757620B543A52E61c46B32eB19261F984'
    // [SupportedExchanges.Uniswap]: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
};