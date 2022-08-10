import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { Pair, PairDaily, PairHourly } from '../../generated/schema';
import { ZERO, ZERO_BD } from '../constants';
import { getDayTotalTimestamp, getHourTotalTimestamp } from '../helpers/time';

export namespace pairs {
	export class TokenProps {
		public token: string;
		public volume: BigInt;
		public price: BigDecimal | null;
		public relativePrice: BigDecimal;
		public constructor(_token: string, _volume: BigInt, _price: BigDecimal | null, _relativePrice: BigDecimal) {
			this.token = _token;
			this.volume = _volume;
			this.price = _price;
			this.relativePrice = _relativePrice;
		}
	}

	export function createOrUpdatePair(
		timestamp: i32,
		buyTokenId: string,
		sellTokenId: string,
		buyAmount: BigInt,
		sellAmount: BigInt,
		sellAmountEth: BigDecimal | null,
		sellAmountUsd: BigDecimal | null,
		buyTokenPriceUsd: BigDecimal | null,
		sellTokenPriceUsd: BigDecimal | null,
		buyAmountDecimals: BigDecimal,
		sellAmountDecimals: BigDecimal
	): void {
		const canonicalMarket = getCanonicalMarket(
			buyTokenId,
			sellTokenId,
			buyAmount,
			sellAmount,
			buyTokenPriceUsd,
			sellTokenPriceUsd,
			buyAmountDecimals,
			sellAmountDecimals
		);

		const token0Props = canonicalMarket.get('token0');
		const token0 = token0Props.token;
		const volumeToken0 = token0Props.volume;
		const priceToken0 = token0Props.price;
		const token0RelativePrice = token0Props.relativePrice;

		const token1Props = canonicalMarket.get('token1');
		const token1 = token1Props.token;
		const volumeToken1 = token1Props.volume;
		const priceToken1 = token1Props.price;
		const token1RelativePrice = token1Props.relativePrice;

		const pairTotal = getOrCreatePair(token0, token1);
		const pairDailyTotal = getOrCreatePairDaily(token0, token1, timestamp);
		const pairHourlyTotal = getOrCreatePairHourly(token0, token1, timestamp);

		totalsUpdate(
			timestamp,
			pairTotal,
			pairDailyTotal,
			pairHourlyTotal,
			volumeToken0,
			volumeToken1,
			priceToken0,
			priceToken1,
			token0RelativePrice,
			token1RelativePrice,
			sellAmountEth,
			sellAmountUsd
		);
	}

	function getCanonicalMarket(
		buyTokenId: string,
		sellTokenId: string,
		buyAmount: BigInt,
		sellAmount: BigInt,
		buyTokenPriceUsd: BigDecimal | null,
		sellTokenPriceUsd: BigDecimal | null,
		buyAmountDecimals: BigDecimal,
		sellAmountDecimals: BigDecimal
	): Map<string, TokenProps> {
		const buyTokenAddress = Address.fromString(buyTokenId);
		const sellTokenAddress = Address.fromString(sellTokenId);
		const buyTokenNumber = BigInt.fromUnsignedBytes(buyTokenAddress);
		const sellTokenNumber = BigInt.fromUnsignedBytes(sellTokenAddress);
		const value = new Map<string, TokenProps>();

		let buyTokenExpressedOnSellToken = ZERO_BD;
		let sellTokenExpressedOnBuyToken = ZERO_BD;

		// to prevent div 0 exception
		if (sellAmountDecimals.notEqual(ZERO_BD)) {
			buyTokenExpressedOnSellToken = buyAmountDecimals.div(sellAmountDecimals);
		}
		if (buyAmountDecimals.notEqual(ZERO_BD)) {
			sellTokenExpressedOnBuyToken = sellAmountDecimals.div(buyAmountDecimals);
		}

		const buyTokenProps = new TokenProps(buyTokenId, buyAmount, buyTokenPriceUsd, buyTokenExpressedOnSellToken);
		const sellTokenProps = new TokenProps(sellTokenId, sellAmount, sellTokenPriceUsd, sellTokenExpressedOnBuyToken);

		if (buyTokenNumber.lt(sellTokenNumber)) {
			value.set('token0', buyTokenProps);
			value.set('token1', sellTokenProps);
		} else {
			value.set('token0', sellTokenProps);
			value.set('token1', buyTokenProps);
		}

		return value;
	}

	function totalsUpdate(
		timestamp: i32,
		pair: Pair,
		pairDaily: PairDaily,
		pairHourly: PairHourly,
		volumeToken0: BigInt,
		volumeToken1: BigInt,
		priceToken0: BigDecimal | null,
		priceToken1: BigDecimal | null,
		token0RelativePrice: BigDecimal,
		token1RelativePrice: BigDecimal,
		sellAmountEth: BigDecimal | null,
		sellAmountUsd: BigDecimal | null
	): void {
		const prevPairTotalVolume0 = pair.volumeToken0;
		const prevPairTotalVolume1 = pair.volumeToken1;
		const prevPairTotalEth = pair.volumeTradedEth;
		const prevPairTotalUsd = pair.volumeTradedUsd;

		const prevPairDailyVolume0 = pairDaily.volumeToken0;
		const prevPairDailyVolume1 = pairDaily.volumeToken1;
		const prevPairDailyEth = pairDaily.volumeTradedEth;
		const prevPairDailyUsd = pairDaily.volumeTradedUsd;

		const prevPairHourlyVolume0 = pairHourly.volumeToken0;
		const prevPairHourlyVolume1 = pairHourly.volumeToken1;
		const prevPairHourlyEth = pairHourly.volumeTradedEth;
		const prevPairHourlyUsd = pairHourly.volumeTradedUsd;

		// Updates volumes for a pair
		pair.volumeToken0 = prevPairTotalVolume0.plus(volumeToken0);
		pair.volumeToken1 = prevPairTotalVolume1.plus(volumeToken1);
		if (prevPairTotalEth !== null && sellAmountEth) {
			pair.volumeTradedEth = prevPairTotalEth.plus(sellAmountEth);
		}
		if (prevPairTotalUsd !== null && sellAmountUsd) {
			pair.volumeTradedUsd = prevPairTotalUsd.plus(sellAmountUsd);
		}
		pair.token0Usd = priceToken0;
		pair.token1Usd = priceToken1;
		pair.token0PriceInToken1 = token0RelativePrice;
		pair.token1PriceInToken0 = token1RelativePrice;
		pair.lastTradeTimestamp = timestamp;
		pair.save();

		// update volumes for a pair daily totals
		pairDaily.volumeToken0 = prevPairDailyVolume0.plus(volumeToken0);
		pairDaily.volumeToken1 = prevPairDailyVolume1.plus(volumeToken1);
		pairDaily.volumeTradedEth = sellAmountEth && prevPairDailyEth ? prevPairDailyEth.plus(sellAmountEth) : prevPairDailyEth;
		pairDaily.volumeTradedUsd = sellAmountUsd && prevPairDailyUsd ? prevPairDailyUsd.plus(sellAmountUsd) : prevPairDailyUsd;
		pairDaily.token0Usd = priceToken0;
		pairDaily.token1Usd = priceToken1;
		pairDaily.token0PriceInToken1 = token0RelativePrice;
		pairDaily.token1PriceInToken0 = token1RelativePrice;
		pairDaily.save();

		// update volumes for a pair hourly totals
		pairHourly.volumeToken0 = prevPairHourlyVolume0.plus(volumeToken0);
		pairHourly.volumeToken1 = prevPairHourlyVolume1.plus(volumeToken1);
		pairHourly.volumeTradedEth = sellAmountEth && prevPairHourlyEth ? prevPairHourlyEth.plus(sellAmountEth) : prevPairHourlyEth;
		pairHourly.volumeTradedUsd = sellAmountUsd && prevPairHourlyUsd ? prevPairHourlyUsd.plus(sellAmountUsd) : prevPairHourlyUsd;
		pairHourly.token0Usd = priceToken0;
		pairHourly.token1Usd = priceToken1;
		pairHourly.token0PriceInToken1 = token0RelativePrice;
		pairHourly.token1PriceInToken0 = token1RelativePrice;
		pairHourly.save();
	}

	function getOrCreatePair(token0: string, token1: string): Pair {
		const id = `${token0}-${token1}`;
		let pairTotal = Pair.load(id);

		if (!pairTotal) {
			pairTotal = new Pair(id);
			pairTotal.token0 = token0;
			pairTotal.token1 = token1;
			pairTotal.volumeToken0 = ZERO;
			pairTotal.volumeToken1 = ZERO;
			pairTotal.volumeTradedEth = ZERO_BD;
			pairTotal.volumeTradedUsd = ZERO_BD;
		}

		return pairTotal as Pair;
	}

	function getOrCreatePairDaily(token0: string, token1: string, timestamp: i32): PairDaily {
		const dailyTimestamp = getDayTotalTimestamp(timestamp);
		const id = `${token0}-${token1}-${dailyTimestamp.toString()}`;
		let pairDailyTotal = PairDaily.load(id);

		if (!pairDailyTotal) {
			pairDailyTotal = new PairDaily(id);
			pairDailyTotal.token0 = token0;
			pairDailyTotal.token1 = token1;
			pairDailyTotal.timestamp = timestamp;
			pairDailyTotal.volumeToken0 = ZERO;
			pairDailyTotal.volumeToken1 = ZERO;
			pairDailyTotal.volumeTradedEth = ZERO_BD;
			pairDailyTotal.volumeTradedUsd = ZERO_BD;
		}

		return pairDailyTotal as PairDaily;
	}

	function getOrCreatePairHourly(token0: string, token1: string, timestamp: i32): PairHourly {
		const hourlyTimestamp = getHourTotalTimestamp(timestamp);
		const id = `${token0}-${token1}-${hourlyTimestamp.toString()}`;
		let pairHourlyTotal = PairHourly.load(id);

		if (!pairHourlyTotal) {
			pairHourlyTotal = new PairHourly(id);
			pairHourlyTotal.token0 = token0;
			pairHourlyTotal.token1 = token1;
			pairHourlyTotal.timestamp = timestamp;
			pairHourlyTotal.volumeToken0 = ZERO;
			pairHourlyTotal.volumeToken1 = ZERO;
			pairHourlyTotal.volumeTradedEth = ZERO_BD;
			pairHourlyTotal.volumeTradedUsd = ZERO_BD;
		}

		return pairHourlyTotal as PairHourly;
	}
}
