import { BigNumber } from "ethers";
import { Interface } from "ethers/lib/utils"
import { Call } from './utils';
import { UniswapInterfaceMulticall } from "../types/v3/UniswapInterfaceMulticall";

const DEFAULT_GAS_REQUIRED = 1_000_000;
type MethodArg = string | number | BigNumber;
type MethodArgs = Array<MethodArg | MethodArg[]>;
type OptionalMethodInputs =
  | Array<MethodArg | MethodArg[] | undefined>
  | undefined;

  function isMethodArg(x: unknown): x is MethodArg {
    return (
      BigNumber.isBigNumber(x) || ['string', 'number'].indexOf(typeof x) !== -1
    );
  }
  
  function isValidMethodArgs(x: unknown): x is MethodArgs | undefined {
    return (
      x === undefined ||
      (Array.isArray(x) &&
        x.every(
          (xi) => isMethodArg(xi) || (Array.isArray(xi) && xi.every(isMethodArg)),
        ))
    );
  }
  

export function executeMulticall(
    multicallContract: UniswapInterfaceMulticall,
    addresses: (string)[],
    contractInterface: Interface,
    methodName: string,
    callInputs?: OptionalMethodInputs
  ) {

    const fragment = contractInterface.getFunction(methodName);
    
    //TODO: This code was translated from react, where the state can be null
    //TODO: verify whether we actually need to validate these properties
    if(!fragment) {
        throw new Error(`Invalid Fragment: '${fragment}'`)
    }

    if(!isValidMethodArgs(callInputs)) {
        throw new Error(`Invalid Method Args: '${callInputs}'`)
    }

    const callData =  contractInterface.encodeFunctionData(fragment, callInputs);
    const calls = addresses.map(address => { return { target: address, callData, gasLimit: BigNumber.from(DEFAULT_GAS_REQUIRED) }});
    return multicallContract.callStatic.multicall(calls)
}