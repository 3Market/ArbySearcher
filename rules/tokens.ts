import { Currency, Ether, NativeCurrency, SupportedChainId, Token, WETH9 } from '@uniswap/sdk-core'

export const USDC_POLYGON = new Token(
    SupportedChainId.POLYGON,
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    6,
    'USDC',
    'USD//C'
 )

export const DAI_POLYGON = new Token(
    SupportedChainId.POLYGON,
    '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    18,
    'DAI',
    'Dai Stablecoin'
  )
  export const USDT_POLYGON = new Token(
    SupportedChainId.POLYGON,
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    6,
    'USDT',
    'Tether USD'
  )
  export const WBTC_POLYGON = new Token(
    SupportedChainId.POLYGON,
    '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
    8,
    'WBTC',
    'Wrapped BTC'
  )
  export const WMATIC_POLYGON = new Token(
    SupportedChainId.POLYGON,
    '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    18,
    'WMATIC',
    'Wrapped MATIC'
  )