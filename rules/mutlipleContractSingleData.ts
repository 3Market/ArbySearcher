import { BigNumber } from "ethers";
import { Interface } from "ethers/lib/utils"
import { Call } from './utils';
import { resolve } from "path";
import { UniswapInterfaceMulticall } from "../types/v3";

//Note: Multicall will throw an error if the contract call exceeds the expected provisioned gas required
// so we jack the number up insanely high to assure execution
const DEFAULT_STATIC_CALL_GAS_REQUIRED = 1_000_000_000_000;

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

export type MethodArg = string | number | BigNumber;
export type MethodArgs = Array<MethodArg | MethodArg[]>;
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
  
export function multipleContractMultipleValue<T>(
    multicallContract: UniswapInterfaceMulticall,
    addresses: (string)[],
    contractInterface: Interface,
    methodName: string,
    callInputs: OptionalMethodInputs[]
  ): Promise<MappedCallResponse<T>>  {
    const fragment = contractInterface.getFunction(methodName);
    
    //TODO: This code was translated from react, where the state can be null
    //TODO: verify whether we actually need to validate these properties
    if(!fragment) {
        throw new Error(`Invalid Fragment: '${fragment}'`)
    }

    const callDatas = callInputs.map(i => {
      if(!isValidMethodArgs(i)) {
        throw new Error(`Invalid Method Args: '${i}'`)
      }
      return contractInterface.encodeFunctionData(fragment, i);
    });

    const calls = addresses.map((address, i) => { return { target: address, callData: callDatas[i], gasLimit: BigNumber.from(DEFAULT_STATIC_CALL_GAS_REQUIRED) }});
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

    return result as Promise<MappedCallResponse<T>>;
  }

export function multipleContractSingleValue<T>(
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
    const calls = addresses.map(address => { return { target: address, callData, gasLimit: BigNumber.from(DEFAULT_STATIC_CALL_GAS_REQUIRED) }});
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

    return result as Promise<MappedCallResponse<T>>;
}

export function singleContractMultipleValue<T>(
  multicallContract: UniswapInterfaceMulticall,
  address: string,
  contractInterface: Interface,
  methodName: string,
  callInputs: OptionalMethodInputs[] = [undefined]
) : Promise<MappedCallResponse<T>> {

  //Use Ethers to get the fragmented function
  const fragment = contractInterface.getFunction(methodName);
  if(!fragment) {
      throw new Error(`Invalid Fragment: '${fragment}'`)
  }

  // This will validate we're passing valid method arguments
  const callDatas = callInputs.map(i => {

    if(!isValidMethodArgs(i)) {
      throw new Error(`Invalid Method Args: '${i}'`)
    }
    return contractInterface.encodeFunctionData(fragment, i);
  });

  // We construct the call data for our example we're using the same call data for eac
  const calls = callDatas.map((callData, i) => { return { target: address, callData, gasLimit: BigNumber.from(DEFAULT_STATIC_CALL_GAS_REQUIRED) }});
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

  return result as Promise<MappedCallResponse<T>>;
}