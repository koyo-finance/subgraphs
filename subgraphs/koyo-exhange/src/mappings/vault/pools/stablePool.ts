import { AmpUpdate, Pool } from '../../../../generated/schema';
import {
	AmpUpdateStarted,
	AmpUpdateStopped,
	StablePool as StablePoolContract,
	SwapFeePercentageChanged,
	Transfer
} from '../../../../generated/templates/StablePool/StablePool';
import { scaleDown } from '../../../helpers/scaling';
import { generalisedHandleBPTTransfer, updateAmpFactor } from '../../../services/pool/pools';

export function handleSwapFeePercentageChange(event: SwapFeePercentageChanged): void {
	const poolAddress = event.address;
	const poolContract = StablePoolContract.bind(poolAddress);

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

export function handleAmpUpdateStarted(event: AmpUpdateStarted): void {
	const poolAddress = event.address;
	const poolContract = StablePoolContract.bind(poolAddress);

	const poolIdTried = poolContract.try_getPoolId();
	const poolId = poolIdTried.value;

	const id = event.transaction.hash.toHexString().concat(event.transactionLogIndex.toString());
	const ampUpdate = new AmpUpdate(id);

	ampUpdate.poolId = poolId.toHexString();
	ampUpdate.scheduledTimestamp = event.block.timestamp.toI32();
	ampUpdate.startTimestamp = event.params.startTime;
	ampUpdate.endTimestamp = event.params.endTime;
	ampUpdate.startAmp = event.params.startValue;
	ampUpdate.endAmp = event.params.endValue;

	ampUpdate.save();
}

export function handleAmpUpdateStopped(event: AmpUpdateStopped): void {
	const poolAddress = event.address;
	const poolContract = StablePoolContract.bind(poolAddress);

	const poolIdTried = poolContract.try_getPoolId();
	const poolId = poolIdTried.value.toHexString();

	const id = event.transaction.hash.toHexString().concat(event.transactionLogIndex.toString());
	const ampUpdate = new AmpUpdate(id);

	ampUpdate.poolId = poolId;
	ampUpdate.scheduledTimestamp = event.block.timestamp.toI32();
	ampUpdate.startTimestamp = event.block.timestamp;
	ampUpdate.endTimestamp = event.block.timestamp;
	ampUpdate.startAmp = event.params.currentValue;
	ampUpdate.endAmp = event.params.currentValue;

	ampUpdate.save();

	const pool = Pool.load(poolId);
	if (pool === null) return;

	updateAmpFactor(pool);
}
