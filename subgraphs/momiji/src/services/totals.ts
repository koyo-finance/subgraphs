import { BigDecimal } from '@graphprotocol/graph-ts';
import { DailyTotal, HourlyTotal, Total } from '../../generated/schema';
import { ONE, ZERO, ZERO_BD } from '../constants';
import { getDayTotalTimestamp, getHourTotalTimestamp } from '../helpers/time';

export function getOrCreateTotals(): Total {
	let total = Total.load('1');
	if (!total) {
		total = new Total('1');
		total.tokens = ZERO;
		total.orders = ZERO;
		total.traders = ZERO;
		total.settlements = ZERO;
		total.volumeEth = ZERO_BD;
		total.volumeUsd = ZERO_BD;
		total.feesEth = ZERO_BD;
		total.feesUsd = ZERO_BD;
		total.numberOfTrades = ZERO;
	}

	return total as Total;
}

export function getOrCreateDailyTotals(timestamp: i32): DailyTotal {
	const totalId = timestamp.toString();
	let total = DailyTotal.load(totalId);

	if (!total) {
		total = new DailyTotal(totalId);
		total.timestamp = timestamp;
		total.orders = ZERO;
		total.settlements = ZERO;
		total.volumeUsd = ZERO_BD;
		total.volumeEth = ZERO_BD;
		total.feesUsd = ZERO_BD;
		total.feesEth = ZERO_BD;
		total.numberOfTrades = ZERO;
	}

	return total as DailyTotal;
}

export function getOrCreateHourlyTotals(timestamp: i32): HourlyTotal {
	const totalId = timestamp.toString();
	let total = HourlyTotal.load(totalId);

	if (!total) {
		total = new HourlyTotal(totalId);
		total.timestamp = timestamp;
		total.orders = ZERO;
		total.settlements = ZERO;
		total.volumeUsd = ZERO_BD;
		total.volumeEth = ZERO_BD;
		total.feesUsd = ZERO_BD;
		total.feesEth = ZERO_BD;
		total.numberOfTrades = ZERO;
	}

	return total as HourlyTotal;
}

export function updateTokenTotalsCount(): void {
	const total = getOrCreateTotals();
	const prevTokensCount = total.tokens;

	total.tokens = prevTokensCount.plus(ONE);
	total.save();
}
//    We made the decision to avoid this for now.
//    https://github.com/cowprotocol/subgraph/issues/47#issuecomment-1183515135
//
//    function updateDailyTokensCount(timestamp: i32, tokenId: string): void {
//        let total = getOrCreateDailyTotals(timestamp)
//        let prevtotalTokens = total.totalTokens
//        let prevTokens = total.tokens
//        prevTokens.push(tokenId)
//        total.tokens = prevTokens
//        total.totalTokens = prevtotalTokens.plus(ONE_BI)
//        total.save()
//    }
//
//    function updateHourlyTokensCount(timestamp: i32, tokenId: string): void {
//        let total = getOrCreateHourlyTotals(timestamp)
//        let prevtotalTokens = total.totalTokens
//        let prevTokens = total.tokens
//        prevTokens.push(tokenId)
//        total.tokens = prevTokens
//        total.totalTokens = prevtotalTokens.plus(ONE_BI)
//        total.save()
//    }
//
//    export function addTokenCount(timestamp: i32, tokenId: string): void{
//        let dayTimestamp = getDayTotalTimestamp(timestamp)
//        let hourTimestamp = getHourTotalTimestamp(timestamp)
//         updateDailyTokensCount(dayTimestamp, tokenId)
//         updateHourlyTokensCount(hourTimestamp, tokenId)
//        updateTokenTotalsCount()
//    }

export function updateOrdersTotalsCount(): void {
	const total = getOrCreateTotals();
	const prevOrdersCount = total.orders;

	total.orders = prevOrdersCount.plus(ONE);
	total.save();
}

export function updateHourlyOrdersCount(timestamp: i32): void {
	const total = getOrCreateHourlyTotals(timestamp);
	const prevtotalOrders = total.orders;

	total.orders = prevtotalOrders.plus(ONE);
	total.save();
}

export function updateDailyOrdersCount(timestamp: i32): void {
	const total = getOrCreateDailyTotals(timestamp);
	const prevtotalOrders = total.orders;

	total.orders = prevtotalOrders.plus(ONE);
	total.save();
}

export function addOrderCount(timestamp: i32): void {
	const dayTimestamp = getDayTotalTimestamp(timestamp);
	const hourTimestamp = getHourTotalTimestamp(timestamp);

	updateDailyOrdersCount(dayTimestamp);
	updateHourlyOrdersCount(hourTimestamp);
	updateOrdersTotalsCount();
}

export function addTraderCount(): void {
	const total = getOrCreateTotals();
	const prevTradersCount = total.traders;
	total.traders = prevTradersCount.plus(ONE);
	total.save();
}

function updateSettlementsTotalsCount(): void {
	const total = getOrCreateTotals();
	const prevSettlementsCount = total.settlements;
	total.settlements = prevSettlementsCount.plus(ONE);
	total.save();
}

function updateDailySettlementsCount(timestamp: i32): void {
	const total = getOrCreateDailyTotals(timestamp);
	const prevtotalSettlements = total.settlements;

	total.settlements = prevtotalSettlements.plus(ONE);
	total.save();
}

function updateHourlySettlementsCount(timestamp: i32): void {
	const total = getOrCreateHourlyTotals(timestamp);
	const prevtotalSettlements = total.settlements;

	total.settlements = prevtotalSettlements.plus(ONE);
	total.save();
}

export function addSettlementCount(timestamp: i32): void {
	const dayTimestamp = getDayTotalTimestamp(timestamp);
	const hourTimestamp = getHourTotalTimestamp(timestamp);
	updateDailySettlementsCount(dayTimestamp);
	updateHourlySettlementsCount(hourTimestamp);
	updateSettlementsTotalsCount();
}

function updateVolumesAndFeesTotals(
	volumeEth: BigDecimal | null,
	volumeUsd: BigDecimal | null,
	feesEth: BigDecimal | null,
	feesUsd: BigDecimal | null
): void {
	const total = getOrCreateTotals();
	const prevVolumeEth = total.volumeEth;
	const prevVolumeUsd = total.volumeUsd;
	const prevFeesEth = total.feesEth;
	const prevFeesUsd = total.feesUsd;
	const prevTrades = total.numberOfTrades;

	if (volumeEth && prevVolumeEth) {
		total.volumeEth = prevVolumeEth.plus(volumeEth);
	}
	if (volumeUsd && prevVolumeUsd) {
		total.volumeUsd = prevVolumeUsd.plus(volumeUsd);
	}
	if (feesEth && prevFeesEth) {
		total.feesEth = prevFeesEth.plus(feesEth);
	}
	if (feesUsd && prevFeesUsd) {
		total.feesUsd = prevFeesUsd.plus(feesUsd);
	}
	total.numberOfTrades = prevTrades.plus(ONE);
	total.save();
}

function updateHourlyVolumesAndFees(
	volumeEth: BigDecimal | null,
	volumeUsd: BigDecimal | null,
	feesEth: BigDecimal | null,
	feesUsd: BigDecimal | null,
	timestamp: i32
): void {
	const total = getOrCreateHourlyTotals(timestamp);
	const prevVolumeEth = total.volumeEth;
	const prevVolumeUsd = total.volumeUsd;
	const prevFeesEth = total.feesEth;
	const prevFeesUsd = total.feesUsd;
	const prevTrades = total.numberOfTrades;

	if (volumeEth && prevVolumeEth) {
		total.volumeEth = prevVolumeEth.plus(volumeEth);
	}
	if (volumeUsd && prevVolumeUsd) {
		total.volumeUsd = prevVolumeUsd.plus(volumeUsd);
	}
	if (feesEth && prevFeesEth) {
		total.feesEth = prevFeesEth.plus(feesEth);
	}
	if (feesUsd && prevFeesUsd) {
		total.feesUsd = prevFeesUsd.plus(feesUsd);
	}
	total.numberOfTrades = prevTrades.plus(ONE);
	total.save();
}

function updateDailyVolumesAndFees(
	volumeEth: BigDecimal | null,
	volumeUsd: BigDecimal | null,
	feesEth: BigDecimal | null,
	feesUsd: BigDecimal | null,
	timestamp: i32
): void {
	const total = getOrCreateDailyTotals(timestamp);
	const prevVolumeEth = total.volumeEth;
	const prevVolumeUsd = total.volumeUsd;
	const prevFeesEth = total.feesEth;
	const prevFeesUsd = total.feesUsd;
	const prevTrades = total.numberOfTrades;

	if (volumeEth && prevVolumeEth) {
		total.volumeEth = prevVolumeEth.plus(volumeEth);
	}
	if (volumeUsd && prevVolumeUsd) {
		total.volumeUsd = prevVolumeUsd.plus(volumeUsd);
	}
	if (feesEth && prevFeesEth) {
		total.feesEth = prevFeesEth.plus(feesEth);
	}
	if (feesUsd && prevFeesUsd) {
		total.feesUsd = prevFeesUsd.plus(feesUsd);
	}
	total.numberOfTrades = prevTrades.plus(ONE);
	total.save();
}

export function addVolumesAndFees(
	volumeEth: BigDecimal | null,
	volumeUsd: BigDecimal | null,
	feesEth: BigDecimal | null,
	feesUsd: BigDecimal | null,
	timestamp: i32
): void {
	const dayTimestamp = getDayTotalTimestamp(timestamp);
	const hourTimestamp = getHourTotalTimestamp(timestamp);
	updateDailyVolumesAndFees(volumeEth, volumeUsd, feesEth, feesUsd, dayTimestamp);
	updateHourlyVolumesAndFees(volumeEth, volumeUsd, feesEth, feesUsd, hourTimestamp);
	updateVolumesAndFeesTotals(volumeEth, volumeUsd, feesEth, feesUsd);
}
