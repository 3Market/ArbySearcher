import { Currency, Ether, NativeCurrency, SupportedChainId, Token, WETH9 } from '@uniswap/sdk-core'

export const USDC_POLYGON = new Token(
    SupportedChainId.POLYGON,
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    6,
    'USDC',
    'USD Coin'
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
  export const GHST_POLYGON = new Token(
      SupportedChainId.POLYGON,
      '0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7',
      18,
      'GHST',
      'Aavegotchi GHST Token'
  )
  export const GNS_POLYGON = new Token(
    SupportedChainId.POLYGON,
    '0xE5417Af564e4bFDA1c483642db72007871397896',
    18,
    'GNS',
    'Gains Network'
  )

  export const MAI_POLYGON = new Token(
    SupportedChainId.POLYGON,
    '0xa3Fa99A148fA48D14Ed51d610c367C61876997F1',
    18,
    'MAI',
    'MAI'
  )

  export const ETH_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    18,
    'ETH',
    'Ether'
  )

  export const SAND_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683",
    18,
    'SAND',
    'SAND'
  )

  export const OLD_QUICK_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0x831753DD7087CaC61aB5644b308642cc1c33Dc13",
    18,
    'QUICK(OLD)',
    'Quickswap Old token'
  )

  export const NEW_QUICK_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0xB5C064F955D8e7F38fE0460C556a72987494eE17",
    18,
    'QUICK(New)',
    'Quickswap New token'
  )

  export const LINK_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39",
    18,
    'LINK',
    'Chainlink'
  )

  export const QI_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0x580A84C73811E1839F75d86d75d88cCa0c241fF4",
    18,
    'QI',
    'Qi DAO'
  )

  export const ORBS_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0x614389EaAE0A6821DC49062D56BDA3d9d45Fa2ff",
    18,
    'ORBS',
    'Orbs'
  )

  export const MCO2_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0xAa7DbD1598251f856C12f63557A4C4397c253Cea",
    18,
    'MCO2',
    'Moss Carbon Credit'
  )

  export const AAVE_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0xD6DF932A45C0f255f85145f286eA0b292B21C90B",
    18,
    'AAVE',
    'Aave'
  )

  export const ASTRAFER_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0xDfCe1e99A31C4597a3f8A8945cBfa9037655e335",
    18,
    'ASTRAFER',
    'Astrafer'
  )

  export const LIDO_POLYGON = new Token(
    SupportedChainId.POLYGON,
    "0xC3C7d422809852031b44ab29EEC9F1EfF2A58756",
    18,
    'LDO',
    'Lido DAO Token'
  )

  export const STABLE_ASSETS = [
    USDC_POLYGON,
    USDT_POLYGON,
    DAI_POLYGON,
    MAI_POLYGON
  ]

  export const PRIMARY_ARBITRAGE_ASSETS = [
    ...STABLE_ASSETS,
    WMATIC_POLYGON,
    ETH_POLYGON,
    WBTC_POLYGON,
    GHST_POLYGON,
    GNS_POLYGON,
    SAND_POLYGON,
    OLD_QUICK_POLYGON,
    LINK_POLYGON,
    QI_POLYGON,
    MCO2_POLYGON,
    AAVE_POLYGON,
    ASTRAFER_POLYGON,
    LIDO_POLYGON
  ]