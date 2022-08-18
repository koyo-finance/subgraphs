import { Pool } from '../../../../generated/schema';
import {
	OracleWeightedPool as OracleWeightedPoolContract,
	SwapFeePercentageChanged,
	Transfer
} from '../../../../generated/templates/OracleWeightedPool/OracleWeightedPool';
import { scaleDown } from '../../../helpers/scaling';
import { generalisedHandleBPTTransfer } from '../../../services/pool/pools';

export function handleSwapFeePercentageChange(event: SwapFeePercentageChanged): void {
	const poolAddress = event.address;
	const poolContract = OracleWeightedPoolContract.bind(poolAddress);

	const poolIdTried = poolContract.try_getPoolId();
	const poolId = poolIdTried.value;

	const pool = Pool.load(poolId.toHexString()) as Pool;

	pool.swapFee = scaleDown(event.params.swapFeePercentage, 18);

	pool.save();
}

export function handleTransfer(event: Transfer): void {
	const poolAddress = event.address;
	const from = event.params.from;
	const to = event.params.to;
	const value = event.params.value;

	generalisedHandleBPTTransfer(poolAddress, from, to, value);
}
