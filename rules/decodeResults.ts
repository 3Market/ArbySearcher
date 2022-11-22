import { BigNumber } from "ethers";

export type slot0Response = {
    sqrtPriceX96: BigNumber;
    tick: number;
    observationIndex: number;
    observationCardinality: number;
    observationCardinalityNext: number;
    feeProtocol: number;
    unlocked: boolean;
}

export type TickResponse = {
    liquidityGross: BigNumber;
    liquidityNet: BigNumber;
    feeGrowthOutside0X128: BigNumber;
    feeGrowthOutside1X128: BigNumber;
    tickCumulativeOutside: BigNumber;
    secondsPerLiquidityOutsideX128: BigNumber;
    secondsOutside: number;
    initialized: boolean;
  }