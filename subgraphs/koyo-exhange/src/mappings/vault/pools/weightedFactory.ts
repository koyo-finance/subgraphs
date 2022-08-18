import { Address, Bytes } from '@graphprotocol/graph-ts';
import { PoolCreated as OracleWeightedPoolCreated } from '../../../../generated/OracleWeightedPoolFactory/OracleWeightedPoolFactory';
import { WeightedPool as WeightedPoolTemplate } from '../../../../generated/templates';
import { Vault } from '../../../../generated/WeightedPoolFactory/Vault';
import { WeightedPool as WeightedPoolContract } from '../../../../generated/WeightedPoolFactory/WeightedPool';
import { PoolCreated } from '../../../../generated/WeightedPoolFactory/WeightedPoolFactory';
import { PoolType } from '../../../helpers/pool';
import { getOrRegisterAccount } from '../../../services/accounts';
import { handleNewPool, updatePoolWeights } from '../../../services/pool/pools';
import { getOrRegisterPoolToken } from '../../../services/pool/tokens';
import { findOrRegisterVault } from '../../../services/vault';

function createWeightedPool(event: PoolCreated, poolType: string): string {
	const poolAddress: Address = event.params.pool;
	const poolContract = WeightedPoolContract.bind(poolAddress);

	const poolId = poolContract.try_getPoolId().value;
	const swapFee = poolContract.try_getSwapFeePercentage().value;
	const owner = poolContract.try_getOwner().value;

	const account = getOrRegisterAccount(owner);

	const pool = handleNewPool(changetype<OracleWeightedPoolCreated>(event), poolId, swapFee);
	pool.poolType = poolType;
	pool.factory = event.address;
	pool.owner = account.id;

	const vaultContract = Vault.bind(Address.fromBytes(findOrRegisterVault().address));
	const tokensTried = vaultContract.try_getPoolTokens(poolId);

	if (!tokensTried.reverted) {
		const tokens = tokensTried.value.value0;
		pool.tokensList = changetype<Bytes[]>(tokens);

		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let i: i32 = 0; i < tokens.length; i++) {
			getOrRegisterPoolToken(poolId.toHexString(), tokens[i]);
		}
	}
	pool.save();

	// Load pool with initial weights
	updatePoolWeights(poolId.toHexString());

	return poolId.toHexString();
}

export function handleNewWeightedPool(event: PoolCreated): void {
	createWeightedPool(event, PoolType.Weighted);
	WeightedPoolTemplate.create(event.params.pool);
}
