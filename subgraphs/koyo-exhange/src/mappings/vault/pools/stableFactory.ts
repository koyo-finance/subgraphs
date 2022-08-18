import { Address, Bytes } from '@graphprotocol/graph-ts';
import { PoolCreated as OracleWeightedPoolCreated } from '../../../../generated/OracleWeightedPoolFactory/OracleWeightedPoolFactory';
import { Vault } from '../../../../generated/OracleWeightedPoolFactory/Vault';
import { StablePool as StablePoolContract } from '../../../../generated/StablePoolFactory/StablePool';
import { PoolCreated } from '../../../../generated/StablePoolFactory/StablePoolFactory';
import { StablePool as StablePoolTemplate } from '../../../../generated/templates';
import { PoolType } from '../../../helpers/pool';
import { getOrRegisterAccount } from '../../../services/accounts';
import { handleNewPool } from '../../../services/pool/pools';
import { getOrRegisterPoolToken } from '../../../services/pool/tokens';
import { findOrRegisterVault } from '../../../services/vault';

function createStablePool(event: PoolCreated, poolType: string): string {
	const poolAddress: Address = event.params.pool;
	const poolContract = StablePoolContract.bind(poolAddress);

	const poolIdTried = poolContract.try_getPoolId();
	const poolId = poolIdTried.value;

	const swapFeeTried = poolContract.try_getSwapFeePercentage();
	const swapFee = swapFeeTried.value;

	const ownerTried = poolContract.try_getOwner();
	const owner = ownerTried.value;

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

	return poolId.toHexString();
}

export function handleNewStablePool(event: PoolCreated): void {
	createStablePool(event, PoolType.Stable);
	StablePoolTemplate.create(event.params.pool);
}
