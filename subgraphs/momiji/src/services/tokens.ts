import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { DEFAULT_DECIMALS } from '@protofire/subgraph-toolkit';
import { ERC20 } from '../../generated/GPV2Settlement/ERC20';
import { Token, TokenDailyTotal, TokenHourlyTotal, TokenTradingEvent } from '../../generated/schema';
import { ONE, ZERO, ZERO_BD } from '../constants';
import { getDayTotalTimestamp, getHourTotalTimestamp } from '../helpers/time';
import { updateTokenTotalsCount } from './totals';

export function getOrCreateToken(tokenAddress: Address, timestamp: i32): Token {
	const tokenId = tokenAddress.toHexString();
	let token = Token.load(tokenId);

	// check if token exists
	if (!token) {
		// creates a new token and fill properites
		token = new Token(tokenId);
		token.address = tokenAddress;
		token.firstTradeTimestamp = timestamp ? timestamp : 0;

		// try contract calls for filling decimals, name and symbol
		const erc20Token = ERC20.bind(tokenAddress);
		const tokenDecimals = erc20Token.try_decimals();
		const tokenName = erc20Token.try_name();
		const tokenSymbol = erc20Token.try_symbol();
		token.decimals = tokenDecimals.reverted ? DEFAULT_DECIMALS : tokenDecimals.value;
		token.name = tokenName.reverted ? '' : tokenName.value;
		token.symbol = tokenSymbol.reverted ? '' : tokenSymbol.value;
		token.totalVolume = ZERO;

		token.priceEth = ZERO_BD;
		token.priceUsd = ZERO_BD;

		token.numberOfTrades = 0;
		token.totalVolumeEth = ZERO_BD;
		token.totalVolumeUsd = ZERO_BD;

		// add token created to the totals
		// code commented https://github.com/cowprotocol/subgraph/issues/47#issuecomment-1183515135
		// totals.addTokenCount(timestamp, tokenId)
		updateTokenTotalsCount();
	}

	// adding timestamp for token created by uniswap logic
	// start counting that token
	if (!token.firstTradeTimestamp) {
		token.firstTradeTimestamp = timestamp;
	}

	token.save();

	return token as Token;
}

export function getTokenDecimals(tokenAddress: Address): number {
	const tokenId = tokenAddress.toHexString();
	const token = Token.load(tokenId);

	if (token) {
		return token.decimals;
	}

	const erc20Token = ERC20.bind(tokenAddress);
	const tokenDecimals = erc20Token.try_decimals();

	return tokenDecimals.reverted ? DEFAULT_DECIMALS : tokenDecimals.value;
}

export function createTokenTradingEvent(
	timestamp: i32,
	tokenId: string,
	tradeId: string,
	amount: BigInt,
	amountEth: BigDecimal | null,
	amountUsd: BigDecimal | null,
	tokenPrice: BigDecimal | null
): void {
	const id = tokenId + timestamp.toString();
	const tradingEvent = new TokenTradingEvent(id);
	tradingEvent.token = tokenId;
	tradingEvent.trade = tradeId;
	tradingEvent.timestamp = timestamp;
	tradingEvent.amountEth = amountEth;
	tradingEvent.amountUsd = amountUsd;
	tradingEvent.save();
	updateTokenDailyTotal(timestamp, tokenId, amount, amountEth, amountUsd, tokenPrice);
	updateTokenHourlyTotal(timestamp, tokenId, amount, amountEth, amountUsd, tokenPrice);
}

function getOrCreateTokenDailyTotal(tokenId: string, timestamp: i32): TokenDailyTotal {
	const dailyTimestamp = getDayTotalTimestamp(timestamp);
	const dailyTimestampId = `${tokenId}-${dailyTimestamp.toString()}`;
	let total = TokenDailyTotal.load(dailyTimestampId);

	if (!total) {
		total = new TokenDailyTotal(dailyTimestampId);
		total.token = tokenId;
		total.timestamp = timestamp;
		total.totalVolume = ZERO;
		total.totalVolumeEth = ZERO_BD;
		total.totalVolumeUsd = ZERO_BD;
		total.totalTrades = ZERO;
		total.openPrice = ZERO_BD;
		total.closePrice = ZERO_BD;
		total.higherPrice = ZERO_BD;
		total.lowerPrice = ZERO_BD;
		total.averagePrice = ZERO_BD;
	}

	return total as TokenDailyTotal;
}

function getOrCreateTokenHourlyTotal(tokenId: string, timestamp: i32): TokenHourlyTotal {
	const hourlyTimestamp = getHourTotalTimestamp(timestamp);
	const hourlyTimestampId = `${tokenId}-${hourlyTimestamp.toString()}`;
	let total = TokenHourlyTotal.load(hourlyTimestampId);

	if (!total) {
		total = new TokenHourlyTotal(hourlyTimestampId);
		total.token = tokenId;
		total.timestamp = timestamp;
		total.totalVolume = ZERO;
		total.totalVolumeEth = ZERO_BD;
		total.totalVolumeUsd = ZERO_BD;
		total.totalTrades = ZERO;
		total.openPrice = ZERO_BD;
		total.closePrice = ZERO_BD;
		total.higherPrice = ZERO_BD;
		total.lowerPrice = ZERO_BD;
		total.averagePrice = ZERO_BD;
	}

	return total as TokenHourlyTotal;
}

function updateTokenDailyTotal(
	timestamp: i32,
	tokenId: string,
	amount: BigInt,
	amountEth: BigDecimal | null,
	amountUsd: BigDecimal | null,
	tokenPrice: BigDecimal | null
): void {
	const total = getOrCreateTokenDailyTotal(tokenId, timestamp);

	// check if it is first trade
	if (total.totalTrades === ZERO) {
		total.totalVolume = amount;
		total.totalVolumeEth = amountEth ? amountEth : ZERO_BD;
		total.totalVolumeUsd = amountUsd ? amountUsd : ZERO_BD;
		total.totalTrades = ONE;
		if (tokenPrice) {
			const priceBD = tokenPrice as BigDecimal;
			total.openPrice = priceBD;
			total.lowerPrice = priceBD;
			total.higherPrice = priceBD;
			total.averagePrice = priceBD;
		}
	} else {
		const prevTotalVolume = total.totalVolume;
		const prevTotalVolumeEth = total.totalVolumeEth;
		const prevTotalVolumeUsd = total.totalVolumeUsd;
		const prevTotalTrades = total.totalTrades;
		total.totalVolume = prevTotalVolume.plus(amount);
		total.totalVolumeEth = amountEth ? prevTotalVolumeEth.plus(amountEth) : prevTotalVolumeEth;
		total.totalVolumeUsd = amountUsd ? prevTotalVolumeUsd.plus(amountUsd) : prevTotalVolumeUsd;
		total.totalTrades = prevTotalTrades.plus(ONE);
		if (tokenPrice) {
			const priceBD = tokenPrice as BigDecimal;
			if (priceBD.lt(total.lowerPrice)) {
				total.lowerPrice = priceBD;
			}
			if (priceBD.gt(total.higherPrice)) {
				total.higherPrice = priceBD;
			}

			total.averagePrice = calculateWeightedAveragePrice(total.totalVolume, total.averagePrice, amount, priceBD);
		}
	}
	if (tokenPrice) {
		total.closePrice = tokenPrice as BigDecimal;
	}

	total.save();
}

function calculateWeightedAveragePrice(prevVol: BigInt, prevAvgPrice: BigDecimal, currentVol: BigInt, currentPrice: BigDecimal): BigDecimal {
	const prevVolumeBD = prevVol.toBigDecimal();
	const prevValWeighted = prevVolumeBD.times(prevAvgPrice);
	const currentVolumeBD = currentVol.toBigDecimal();
	const currentAvgWeighted = currentVolumeBD.times(currentPrice);

	const numerator = prevValWeighted.plus(currentAvgWeighted);
	const denominator = prevVolumeBD.plus(currentVolumeBD);
	return numerator.div(denominator) as BigDecimal;
}
function updateTokenHourlyTotal(
	timestamp: i32,
	tokenId: string,
	amount: BigInt,
	amountEth: BigDecimal | null,
	amountUsd: BigDecimal | null,
	tokenPrice: BigDecimal | null
): void {
	const total = getOrCreateTokenHourlyTotal(tokenId, timestamp);

	// check if it is first trade
	if (total.totalTrades === ZERO) {
		total.totalVolume = amount;
		total.totalVolumeEth = amountEth ? amountEth : ZERO_BD;
		total.totalVolumeUsd = amountUsd ? amountUsd : ZERO_BD;
		total.totalTrades = ONE;
		if (tokenPrice) {
			const priceBD = tokenPrice as BigDecimal;
			total.openPrice = priceBD;
			total.lowerPrice = priceBD;
			total.higherPrice = priceBD;
			total.averagePrice = priceBD;
		}
	} else {
		const prevTotalVolume = total.totalVolume;
		const prevTotalVolumeEth = total.totalVolumeEth;
		const prevTotalVolumeUsd = total.totalVolumeUsd;
		const prevTotalTrades = total.totalTrades;
		total.totalVolume = prevTotalVolume.plus(amount);
		total.totalVolumeEth = amountEth ? prevTotalVolumeEth.plus(amountEth) : prevTotalVolumeEth;
		total.totalVolumeUsd = amountUsd ? prevTotalVolumeUsd.plus(amountUsd) : prevTotalVolumeUsd;
		total.totalTrades = prevTotalTrades.plus(ONE);
		if (tokenPrice) {
			const priceBD = tokenPrice as BigDecimal;
			if (priceBD.lt(total.lowerPrice)) {
				total.lowerPrice = priceBD;
			}
			if (priceBD.gt(total.higherPrice)) {
				total.higherPrice = priceBD;
			}

			total.averagePrice = calculateWeightedAveragePrice(total.totalVolume, total.averagePrice, amount, priceBD);
		}
	}
	if (tokenPrice) {
		total.closePrice = tokenPrice as BigDecimal;
	}

	total.save();
}
