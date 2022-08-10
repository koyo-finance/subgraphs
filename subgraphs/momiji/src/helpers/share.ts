import { Address } from '@graphprotocol/graph-ts';

export function getPoolShareId(poolControllerAddress: Address, lpAddress: Address): string {
	return poolControllerAddress //
		.toHex()
		.concat('-')
		.concat(lpAddress.toHex());
}
