import { BigDecimal, dataSource } from '@graphprotocol/graph-ts';
import { OrderInvalidated, PreSignature, Trade } from '../../generated/GPV2Settlement/GPV2Settlement';
import { tokenToDecimal } from '../helpers/token';
import { orders, tokens, trades, users } from '../modules';
import { getTokenPriceInEth, getTokenPriceInUsd } from '../services/pricing';

export function handleOrderInvalidated(event: OrderInvalidated): void {
	const orderId = event.params.orderUid.toHexString();
	const timestamp = event.block.timestamp.toI32();

	const order = orders.invalidateOrder(orderId, timestamp);

	order.save();
}

export function handlePreSignature(event: PreSignature): void {
	const orderUid = event.params.orderUid.toHexString();
	const ownerAddress = event.params.owner;
	const owner = ownerAddress.toHexString();
	const timestamp = event.block.timestamp.toI32();
	const signed = event.params.signed;

	const order = orders.setPresignature(orderUid, owner, timestamp, signed);

	order.save();

	users.getOrCreateSigner(owner, ownerAddress);
}

export function handleTrade(event: Trade): void {
	const orderId = event.params.orderUid.toHexString();
	const ownerAddress = event.params.owner;
	const owner = ownerAddress.toHexString();
	const sellTokenAddress = event.params.sellToken;
	const buyTokenAddress = event.params.buyToken;
	const sellAmount = event.params.sellAmount;
	const buyAmount = event.params.buyAmount;
	const network = dataSource.network();

	const timestamp = event.block.timestamp.toI32();

	const sellToken = tokens.getOrCreateToken(sellTokenAddress, timestamp);
	const buyToken = tokens.getOrCreateToken(buyTokenAddress, timestamp);

	const tokenCurrentSellAmount = sellToken.totalVolume;
	const tokenCurrentBuyAmount = buyToken.totalVolume;

	sellToken.totalVolume = tokenCurrentSellAmount.plus(sellAmount);
	buyToken.totalVolume = tokenCurrentBuyAmount.plus(buyAmount);

	const sellTokenPriceUsd = getTokenPriceInUsd(sellTokenAddress);
	const buyTokenPriceUsd = getTokenPriceInUsd(buyTokenAddress);

	if (sellTokenPriceUsd) sellToken.priceUsd = sellTokenPriceUsd;
	if (buyTokenPriceUsd) buyToken.priceUsd = buyTokenPriceUsd;

	const sellTokenPriceEth = getTokenPriceInEth(sellTokenAddress);
	const buyTokenPrice = getTokenPriceInEth(buyTokenAddress);

	if (sellTokenPriceEth) sellToken.priceEth = sellTokenPriceEth;
	if (buyTokenPrice) buyToken.priceEth = buyTokenPrice;

	const buyPrevNumberOfTrades = buyToken.numberOfTrades;
	buyToken.numberOfTrades = buyPrevNumberOfTrades + 1;

	const sellPrevNumberOfTrades = sellToken.numberOfTrades;
	sellToken.numberOfTrades = sellPrevNumberOfTrades + 1;

	const buyTokenPrevTotalVolumeUsd = buyToken.totalVolumeUsd;
	const buyTokenPrevTotalVolumeEth = buyToken.totalVolumeEth;
	const sellTokenPrevTotalVolumeUsd = sellToken.totalVolumeUsd;
	const sellTokenPrevTotalVolumeEth = sellToken.totalVolumeEth;

	const buyCurrentAmountDecimals = tokenToDecimal(buyAmount, buyToken.decimals);
	const sellCurrentAmountDecimals = tokenToDecimal(sellAmount, sellToken.decimals);

	if (buyToken.priceUsd) {
		const buyTokenPriceUsd = buyToken.priceUsd as BigDecimal;
		const buyCurrentTradeUsd = buyCurrentAmountDecimals.times(buyTokenPriceUsd);
		buyToken.totalVolumeUsd = buyTokenPrevTotalVolumeUsd.plus(buyCurrentTradeUsd);
	}
	if (sellToken.priceUsd) {
		const sellTokenPriceUsd = sellToken.priceUsd as BigDecimal;
		const sellCurrentTradeUsd = sellCurrentAmountDecimals.times(sellTokenPriceUsd);
		sellToken.totalVolumeUsd = sellTokenPrevTotalVolumeUsd.plus(sellCurrentTradeUsd);
	}
	if (buyToken.priceEth) {
		const buyTokenPriceEth = buyToken.priceEth as BigDecimal;
		const buyCurrentTradeEth = buyCurrentAmountDecimals.times(buyTokenPriceEth);
		buyToken.totalVolumeEth = buyTokenPrevTotalVolumeEth.plus(buyCurrentTradeEth);
	}
	if (sellToken.priceEth) {
		const sellTokenPriceEth = sellToken.priceEth as BigDecimal;
		const sellCurrentTradeEth = sellCurrentAmountDecimals.times(sellTokenPriceEth);
		sellToken.totalVolumeEth = sellTokenPrevTotalVolumeEth.plus(sellCurrentTradeEth);
	}

	// this call need to go after price update
	// it uses the prices of each token calculated above.
	trades.getOrCreateTrade(event, buyToken, sellToken);

	sellToken.save();
	buyToken.save();

	const order = orders.getOrCreateOrderForTrade(orderId, timestamp, owner);

	sellToken.save();
	buyToken.save();
	order.save();
}
