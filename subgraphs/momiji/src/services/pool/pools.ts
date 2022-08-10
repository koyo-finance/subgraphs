import { Address } from '@graphprotocol/graph-ts';
import { KoyoPool } from '../../../generated/schema';
import { OracleWeightedPool as OracleWeightedPoolContract } from '../../../generated/Vault/OracleWeightedPool';
import { ZERO_BD } from '../../constants';
import { scaleDown } from '../../helpers/scaling';
import { getOrRegisterPoolToken } from './tokens';

export function getPool(poolId: string): KoyoPool | null {
	return KoyoPool.load(poolId);
}

export function updatePoolWeights(poolId: string): void {
	const pool = getPool(poolId);
	if (pool === null) return;

	const poolContract = OracleWeightedPoolContract.bind(changetype<Address>(pool.address));

	const tokensList = pool.tokensList;
	const weightsTried = poolContract.try_getNormalizedWeights();
	if (!weightsTried.reverted) {
		const weights = weightsTried.value;

		if (weights.length === tokensList.length) {
			let totalWeight = ZERO_BD;

			for (let i = 0; i < tokensList.length; i++) {
				const tokenAddress = changetype<Address>(tokensList[i]);
				const weight = weights[i];

				const poolToken = getOrRegisterPoolToken(poolId, tokenAddress);
				if (poolToken !== null) {
					poolToken.weight = scaleDown(weight, 18);
					poolToken.save();
				}

				totalWeight = totalWeight.plus(scaleDown(weight, 18));
			}

			pool.totalWeight = totalWeight;
		}
	}

	pool.save();
}
