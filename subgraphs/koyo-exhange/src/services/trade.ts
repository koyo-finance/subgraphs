import { Address } from '@graphprotocol/graph-ts';
import { TradePair } from '../../generated/schema';
import { ZERO_BD } from '../constants';
import { getTradePairId } from '../helpers/trade';

export function getOrRegisterTradePair(token0Address: Address, token1Address: Address): TradePair {
	const sortedAddresses = new Array<string>(2);
	sortedAddresses[0] = token0Address.toHexString();
	sortedAddresses[1] = token1Address.toHexString();
	sortedAddresses.sort();

	const tradePairId = getTradePairId(sortedAddresses[0], sortedAddresses[1]);
	let tradePair = TradePair.load(tradePairId);

	if (tradePair === null) {
		tradePair = new TradePair(tradePairId);

		tradePair.token0 = sortedAddresses[0];
		tradePair.token1 = sortedAddresses[1];
		tradePair.totalSwapFee = ZERO_BD;
		tradePair.totalSwapVolume = ZERO_BD;

		tradePair.save();
	}

	return tradePair;
}
