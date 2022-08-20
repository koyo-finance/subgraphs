import { BigInt } from '@graphprotocol/graph-ts';
import { decimal, integer } from '@protofire/subgraph-toolkit';
import { ERC20 as ERC20Contract } from '../../../generated/GaugeController/ERC20';
import { Gauge as GaugeContract } from '../../../generated/GaugeController/Gauge';
import {
	AddType,
	GaugeController as GaugeControllerContract,
	NewGauge,
	NewGaugeWeight,
	NewTypeWeight,
	VoteForGauge
} from '../../../generated/GaugeController/GaugeController';
import { WeightedPool as WeightedPoolContract } from '../../../generated/GaugeController/WeightedPool';
import { Gauge, GaugeTotalWeight, GaugeType, GaugeTypeWeight, GaugeWeight, GaugeWeightVote } from '../../../generated/schema';
import { Gauge as GaugeTemplate } from '../../../generated/templates';
import { GAUGE_TOTAL_WEIGHT_PRECISION } from '../../constants';
import { getOrRegisterAccount } from '../../services/accounts';
import { getGaugeType, registerGaugeType } from '../../services/gauge-types';
import { findOrRegisterKoyo } from '../../services/koyo';
import { getOrRegisterKoyoSnapshot } from '../../services/koyo/snapshot';
import { getPool } from '../../services/pool/pools';

const WEEK = integer.fromNumber(604800);

export function handleAddType(event: AddType): void {
	getOrRegisterKoyoSnapshot('1', event.block.timestamp.toI32());
	const gaugeController = GaugeControllerContract.bind(event.address);
	const nextWeek = nextPeriod(event.block.timestamp, WEEK);

	// Add gauge type
	const gaugeType = registerGaugeType(event.params.type_id.toString(), event.params.name);
	gaugeType.save();

	// Save gauge type weight
	const typeWeight = new GaugeTypeWeight(nextWeek.toString());
	typeWeight.type = gaugeType.id;
	typeWeight.time = nextWeek;
	typeWeight.weight = decimal.fromBigInt(gaugeController.points_type_weight(event.params.type_id, nextWeek));
	typeWeight.save();

	// Save total weight
	const totalWeight = new GaugeTotalWeight(nextWeek.toString());
	totalWeight.time = nextWeek;
	totalWeight.weight = decimal.fromBigInt(gaugeController.points_total(nextWeek), GAUGE_TOTAL_WEIGHT_PRECISION);
	totalWeight.save();

	const vault = findOrRegisterKoyo();
	vault.gaugeTypeCount = integer.increment(vault.gaugeTypeCount);
	vault.save();
}

export function handleNewGauge(event: NewGauge): void {
	getOrRegisterKoyoSnapshot('1', event.block.timestamp.toI32());
	const gaugeController = GaugeControllerContract.bind(event.address);
	const gauge_ = GaugeContract.bind(event.params.addr);
	const gaugeERC20Contract = ERC20Contract.bind(event.params.addr);
	const nextWeek = nextPeriod(event.block.timestamp, WEEK);
	// Get or register gauge type
	let gaugeType = getGaugeType(event.params.gauge_type.toString());

	if (gaugeType === null) {
		gaugeType = registerGaugeType(event.params.gauge_type.toString(), gaugeController.gauge_type_names(event.params.gauge_type));
	}

	gaugeType.gaugeCount = gaugeType.gaugeCount.plus(integer.ONE);
	gaugeType.save();

	// Add gauge instance
	const gauge = new Gauge(event.params.addr.toHexString());
	gauge.address = event.params.addr;
	gauge.type = gaugeType.id;
	gauge.killed = false;

	gauge.created = event.block.timestamp;
	gauge.createdAtBlock = event.block.number;
	gauge.createdAtTransaction = event.transaction.hash;

	const gaugeNameTried = gaugeERC20Contract.try_name();
	gauge.name = gaugeNameTried.reverted ? '' : gaugeNameTried.value;
	const gaugeSymbolTried = gaugeERC20Contract.try_symbol();
	gauge.symbol = gaugeSymbolTried.reverted ? '' : gaugeSymbolTried.value;

	const lpTokenTried = GaugeContract.bind(event.params.addr).try_lp_token();

	if (!lpTokenTried.reverted) {
		const pool_ = WeightedPoolContract.bind(lpTokenTried.value);
		const poolIdTried = pool_.try_getPoolId();

		if (!poolIdTried.reverted) {
			const pool = getPool(poolIdTried.value.toHexString());
			if (pool) gauge.pool = pool.id;
		}
	}

	gauge.save();

	// Save gauge weight
	const gaugeWeight = new GaugeWeight(`${gauge.id}-${nextWeek.toString()}`);
	gaugeWeight.gauge = gauge.id;
	gaugeWeight.time = nextWeek;
	gaugeWeight.weight = decimal.fromBigInt(event.params.weight);
	gaugeWeight.save();

	// Save total weight
	const totalWeight = new GaugeTotalWeight(nextWeek.toString());
	totalWeight.time = nextWeek;
	totalWeight.weight = decimal.fromBigInt(gaugeController.points_total(nextWeek), GAUGE_TOTAL_WEIGHT_PRECISION);
	totalWeight.save();

	const vault = findOrRegisterKoyo();
	vault.gaugeCount = integer.increment(vault.gaugeCount);
	vault.save();

	// Start indexing gauge events
	GaugeTemplate.create(event.params.addr);
}

export function handleNewGaugeWeight(event: NewGaugeWeight): void {
	const gauge = Gauge.load(event.params.gauge_address.toHexString());

	if (gauge !== null) {
		const gaugeController = GaugeControllerContract.bind(event.address);
		const nextWeek = nextPeriod(event.params.time, WEEK);

		// Save gauge weight
		const gaugeWeight = new GaugeWeight(`${gauge.id}-${nextWeek.toString()}`);
		gaugeWeight.gauge = gauge.id;
		gaugeWeight.time = nextWeek;
		gaugeWeight.weight = decimal.fromBigInt(event.params.weight);
		gaugeWeight.save();

		// Save total weight
		const totalWeight = new GaugeTotalWeight(nextWeek.toString());
		totalWeight.time = nextWeek;
		totalWeight.weight = decimal.fromBigInt(gaugeController.points_total(nextWeek), GAUGE_TOTAL_WEIGHT_PRECISION);
		totalWeight.save();
	}
}

export function handleNewTypeWeight(event: NewTypeWeight): void {
	getOrRegisterKoyoSnapshot('1', event.block.timestamp.toI32());
	const gaugeType = GaugeType.load(event.params.type_id.toString());

	if (gaugeType !== null) {
		const typeWeight = new GaugeTypeWeight(`${gaugeType.id}-${event.params.time.toString()}`);
		typeWeight.type = gaugeType.id;
		typeWeight.time = event.params.time;
		typeWeight.weight = decimal.fromBigInt(event.params.weight);
		typeWeight.save();

		const totalWeight = new GaugeTotalWeight(event.params.time.toString());
		totalWeight.time = event.params.time;
		totalWeight.weight = decimal.fromBigInt(event.params.total_weight, GAUGE_TOTAL_WEIGHT_PRECISION);
		totalWeight.save();
	}
}

export function handleVoteForGauge(event: VoteForGauge): void {
	getOrRegisterKoyoSnapshot('1', event.block.timestamp.toI32());
	const gauge = Gauge.load(event.params.gauge_addr.toHexString());

	if (gauge !== null) {
		const gaugeController = GaugeControllerContract.bind(event.address);
		const nextWeek = nextPeriod(event.params.time, WEEK);

		// Save gauge weight
		const gaugeWeight = new GaugeWeight(`${gauge.id}-${nextWeek.toString()}`);
		gaugeWeight.gauge = gauge.id;
		gaugeWeight.time = nextWeek;
		gaugeWeight.weight = decimal.fromBigInt(gaugeController.points_weight(event.params.gauge_addr, nextWeek).bias);
		gaugeWeight.save();

		// Save total weight
		const totalWeight = new GaugeTotalWeight(nextWeek.toString());
		totalWeight.time = nextWeek;
		totalWeight.weight = decimal.fromBigInt(gaugeController.points_total(nextWeek), GAUGE_TOTAL_WEIGHT_PRECISION);
		totalWeight.save();

		// Save user's gauge weight vote
		const user = getOrRegisterAccount(event.params.user);

		const vote = new GaugeWeightVote(`${gauge.id}-${user.id}-${event.params.time.toString()}`);
		vote.gauge = gauge.id;
		vote.user = user.id;
		vote.time = event.params.time;
		vote.weight = decimal.fromBigInt(event.params.weight);
		vote.save();
	}
}

function nextPeriod(timestamp: BigInt, period: BigInt): BigInt {
	const nextPeriod = timestamp.plus(period);
	return nextPeriod.div(period).times(period);
}
