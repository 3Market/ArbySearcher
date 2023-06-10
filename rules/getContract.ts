import { getAddress } from "@ethersproject/address";
import { Contract } from '@ethersproject/contracts';
import { AddressZero } from '@ethersproject/constants'
import type { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers'

import { UniswapInterfaceMulticall } from "../types/v3";
import { Quoter } from "../types/v3/v3-periphery/artifacts/contracts/lens";


export function getMulticallContract(address: string, abi: any, provider: JsonRpcProvider): UniswapInterfaceMulticall { 
    return getContract(address, abi, provider, undefined) as UniswapInterfaceMulticall;
}

export function getQuoterContract(address: string, abi: any, provider: JsonRpcProvider): Quoter {
    return getContract(address, abi, provider, undefined) as Quoter;
}

// returns the checksummed address if the address is valid, otherwise returns false
export function isAddress(value: any): string | false {
    try {
      return getAddress(value)
    } catch {
      return false
    }
  }

export function getContract<T extends Contract = Contract>(address: string, ABI: any, provider: JsonRpcProvider, account?: string): Contract {
    if (!isAddress(address) || address === AddressZero) {
      throw Error(`Invalid 'address' parameter '${address}'.`)
    }
  
    return new Contract(address, ABI, getProviderOrSigner(provider, account) as any) as T 
  }

// account is not optional
function getSigner(provider: JsonRpcProvider, account: string): JsonRpcSigner {
    return provider.getSigner(account).connectUnchecked()
  }
  
  // account is optional
  function getProviderOrSigner(provider: JsonRpcProvider, account?: string): JsonRpcProvider | JsonRpcSigner {
    return account ? getSigner(provider, account) : provider
  }