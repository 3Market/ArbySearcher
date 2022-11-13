import { BigNumber } from "ethers";
import { Interface } from "ethers/lib/utils"
import { Call } from './utils';
import { UniswapInterfaceMulticall } from "../types/v3/UniswapInterfaceMulticall";
import { resolve } from "path";

const DEFAULT_GAS_REQUIRED = 1_000_000;

export type MappedCallResponse<T> = [
    BigNumber,
    ([boolean, BigNumber, string] & {
      success: boolean;
      gasUsed: BigNumber;
      returnData: string;
    })[]
  ] & {
    blockNumber: BigNumber;
    returnData: ([boolean, BigNumber, string] & {
      success: boolean;
      gasUsed: BigNumber;
      returnData: T;
    })[];
  }

export type CallResponse = MappedCallResponse<string>

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
  

export function executeMulticall<T>(
    multicallContract: UniswapInterfaceMulticall,
    addresses: (string)[],
    contractInterface: Interface,
    methodName: string,
    callInputs?: OptionalMethodInputs
  ) : Promise<MappedCallResponse<T>> {

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
    const result = multicallContract.callStatic.multicall(calls).then(response => {
        if(!(response instanceof Object)) {
            return response
        }

        const clone: any = Object.assign({}, response);
        clone.returnData = response.returnData.map(v => {
            const vClone: any = Object.assign({}, v);
            vClone.returnData = contractInterface.decodeFunctionResult(methodName, v.returnData);
            return vClone;
        });

        return clone;
    })

    //Hack: not sure how to return the exected map type
    return result as any;
}