import { Koyo } from '../../generated/schema';
import { VAULT_ADDRESS, ZERO, ZERO_BD } from '../constants';

export function findOrRegisterVault(): Koyo {
	let vault = Koyo.load('1');

	if (vault === null) {
		vault = new Koyo('1');

		vault.poolCount = 0;

		vault.totalLiquidity = ZERO_BD;
		vault.totalSwapVolume = ZERO_BD;
		vault.totalSwapFee = ZERO_BD;
		vault.totalSwapCount = ZERO;

		vault.address = VAULT_ADDRESS;
	}

	return vault;
}
