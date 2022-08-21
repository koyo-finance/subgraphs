import { ERC20 } from '../../../generated/GaugeController/ERC20';
import { Pool } from '../../../generated/schema';
import { getPoolAddress } from '../../helpers/pool';

export function getPool(poolId: string): Pool | null {
	return Pool.load(poolId);
}

export function getOrRegisterPool(poolId: string): Pool {
	let pool = getPool(poolId);

	if (pool === null) {
		pool = new Pool(poolId);
		const poolAddress = getPoolAddress(poolId);

		pool.address = poolAddress;

		const bpt = ERC20.bind(poolAddress);

		const nameTried = bpt.try_name();
		const symbolTried = bpt.try_symbol();

		pool.name = nameTried.reverted ? null : nameTried.value;
		pool.symbol = symbolTried.reverted ? null : symbolTried.value;

		pool.save();
	}

	return pool;
}
