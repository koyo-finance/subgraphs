import { Address } from '@graphprotocol/graph-ts';
import { PoolShare } from '../../../generated/schema';
import { ZERO_BD } from '../../constants';
import { getPoolAddress } from '../../helpers/pool';
import { getPoolShareId } from '../../helpers/share';
import { getOrRegisterAccount } from '../accounts';

export function getOrRegisterPoolShare(poolId: string, lpAddress: Address): PoolShare {
	const poolShareId = getPoolShareId(getPoolAddress(poolId), lpAddress);
	let poolShare = PoolShare.load(poolShareId);

	if (poolShare === null) {
		const account = getOrRegisterAccount(lpAddress);
		poolShare = new PoolShare(poolShareId);

		poolShare.account = account.id;
		poolShare.poolId = poolId;
		poolShare.balance = ZERO_BD;

		poolShare.save();
	}

	return poolShare;
}
