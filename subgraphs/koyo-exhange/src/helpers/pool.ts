import { Address } from '@graphprotocol/graph-ts';

export namespace PoolType {
	export const Weighted = 'Weighted';
	export const Stable = 'Stable';
}

export function getPoolAddress(poolId: string): Address {
	return changetype<Address>(Address.fromHexString(poolId.slice(0, 42)));
}
