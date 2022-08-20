import { decimal } from '@protofire/subgraph-toolkit';
import { Gauge, GaugeDeposit, GaugeLiquidity, GaugeWithdraw } from '../../../generated/schema';
import { Deposit, Gauge as GaugeContract, UpdateLiquidityLimit, Withdraw } from '../../../generated/templates/Gauge/Gauge';
import { getOrRegisterAccount } from '../../services/accounts';
import { getOrRegisterKoyoSnapshot } from '../../services/koyo/snapshot';

export function handleUpdateLiquidityLimit(event: UpdateLiquidityLimit): void {
	getOrRegisterKoyoSnapshot('1', event.block.timestamp.toI32());
	const account = getOrRegisterAccount(event.params.user);
	const gauge = Gauge.load(event.address.toHexString());

	const gaugeLiquidity = new GaugeLiquidity(`${account.id}-${event.address.toHexString()}`);

	gaugeLiquidity.user = account.id;
	gaugeLiquidity.gauge = event.address.toHexString();
	gaugeLiquidity.originalBalance = event.params.original_balance;
	gaugeLiquidity.originalSupply = event.params.original_supply;
	gaugeLiquidity.workingBalance = event.params.working_balance;
	gaugeLiquidity.workingSupply = event.params.working_supply;
	gaugeLiquidity.timestamp = event.block.timestamp;
	gaugeLiquidity.block = event.block.number;
	gaugeLiquidity.transaction = event.transaction.hash;

	gaugeLiquidity.save();

	if (gauge !== null) {
		const gaugeContract = GaugeContract.bind(event.address);

		const killedTried = gaugeContract.try_is_killed();
		gauge.killed = killedTried.reverted ? gauge.killed : killedTried.value;

		gauge.save();
	}
}

export function handleDeposit(event: Deposit): void {
	getOrRegisterKoyoSnapshot('1', event.block.timestamp.toI32());
	const provider = getOrRegisterAccount(event.params.provider);
	const gauge = Gauge.load(event.address.toHexString());

	const deposit = new GaugeDeposit(`${event.transaction.hash.toHexString()}-${event.logIndex.toString()}`);
	deposit.gauge = event.address.toHexString();
	deposit.provider = provider.id;
	deposit.value = decimal.fromBigInt(event.params.value);
	deposit.save();

	if (gauge !== null) {
		const gaugeContract = GaugeContract.bind(event.address);

		const killedTried = gaugeContract.try_is_killed();
		gauge.killed = killedTried.reverted ? gauge.killed : killedTried.value;

		gauge.save();
	}
}

export function handleWithdraw(event: Withdraw): void {
	getOrRegisterKoyoSnapshot('1', event.block.timestamp.toI32());
	const provider = getOrRegisterAccount(event.params.provider);
	const gauge = Gauge.load(event.address.toHexString());

	const withdraw = new GaugeWithdraw(`${event.transaction.hash.toHexString()}-${event.logIndex.toString()}`);
	withdraw.gauge = event.address.toHexString();
	withdraw.provider = provider.id;
	withdraw.value = decimal.fromBigInt(event.params.value);
	withdraw.save();

	if (gauge !== null) {
		const gaugeContract = GaugeContract.bind(event.address);

		const killedTried = gaugeContract.try_is_killed();
		gauge.killed = killedTried.reverted ? gauge.killed : killedTried.value;

		gauge.save();
	}
}
