import { BigDecimal } from '@graphprotocol/graph-ts';
import { Trade } from '../../generated/GPV2Settlement/GPV2Settlement';
import { Token, Trade as TradeEntity } from '../../generated/schema';
import { ZERO, ZERO_ADDRESS_ADDRESS, ZERO_BD } from '../constants';
import { tokenToDecimal } from '../helpers/token';
import { pairs, settlements, tokens, totals, users } from './';

export namespace trades {
	export function getOrCreateTrade(event: Trade, buyToken: Token, sellToken: Token): void {
		const orderId = event.params.orderUid.toHexString();
		const eventIndex = event.transaction.index.toString();
		const txHash = event.transaction.hash;
		const txHashString = txHash.toHexString();
		const tradeId = `${orderId}|${txHashString}|${eventIndex}`;
		const timestamp = event.block.timestamp.toI32();
		const sellAmount = event.params.sellAmount;
		const buyAmount = event.params.buyAmount;
		const txGasPrice = event.transaction.gasPrice;
		const feeAmount = event.params.feeAmount;
		const solver = event.transaction.from;
		const ownerAddress = event.params.owner;
		const owner = ownerAddress.toHexString();

		const buyAmountDecimals = tokenToDecimal(buyAmount, buyToken.decimals);

		const _buyTokenPriceUsd = buyToken.priceUsd;
		const buyAmountUsd = _buyTokenPriceUsd ? _buyTokenPriceUsd.times(buyAmountDecimals) : BigDecimal.zero();

		const _buyTokenPriceEth = buyToken.priceEth;
		const buyAmountEth = _buyTokenPriceEth ? _buyTokenPriceEth.times(buyAmountDecimals) : BigDecimal.zero();
		const sellAmountDecimals = tokenToDecimal(sellAmount, sellToken.decimals);

		const feeAmountDecimals = tokenToDecimal(feeAmount, sellToken.decimals);

		const _sellTokenPriceUsd = sellToken.priceUsd;

		const sellAmountUsd = _sellTokenPriceUsd ? _sellTokenPriceUsd.times(sellAmountDecimals) : BigDecimal.zero();
		const feeAmountUsd = _sellTokenPriceUsd ? _sellTokenPriceUsd.times(feeAmountDecimals) : BigDecimal.zero();

		const _sellTokenPriceEth = sellToken.priceEth;
		const sellAmountEth = _sellTokenPriceEth ? _sellTokenPriceEth.times(sellAmountDecimals) : BigDecimal.zero();
		const feeAmountEth = _sellTokenPriceEth ? _sellTokenPriceEth.times(feeAmountDecimals) : BigDecimal.zero();

		// This statement need to be after tokens prices calculation.
		settlements.getOrCreateSettlement(txHash, timestamp, solver, txGasPrice, feeAmountUsd);

		let trade = TradeEntity.load(tradeId);

		if (!trade) {
			trade = new TradeEntity(tradeId);
		}
		const buyTokenId = buyToken.id;
		const sellTokenId = sellToken.id;

		const buyTokenPriceUsd = buyToken.priceUsd as BigDecimal;
		const sellTokenPriceUsd = sellToken.priceUsd as BigDecimal;

		tokens.createTokenTradingEvent(timestamp, buyTokenId, tradeId, buyAmount, buyAmountEth, buyAmountUsd, buyTokenPriceUsd);
		tokens.createTokenTradingEvent(timestamp, sellTokenId, tradeId, sellAmount, sellAmountEth, sellAmountUsd, sellTokenPriceUsd);

		trade.timestamp = timestamp ? timestamp : 0;
		trade.txHash = txHash ? txHash : ZERO_ADDRESS_ADDRESS;
		trade.settlement = txHashString ? txHashString : '';
		trade.buyToken = buyTokenId ? buyTokenId : '';
		trade.buyAmount = buyAmount ? buyAmount : ZERO;
		trade.sellToken = sellTokenId ? sellTokenId : '';
		trade.sellAmount = sellAmount ? sellAmount : ZERO;
		trade.order = orderId ? orderId : '';
		trade.gasPrice = txGasPrice ? txGasPrice : ZERO;
		trade.feeAmount = feeAmount ? feeAmount : ZERO;
		trade.feeAmountUsd = feeAmountUsd;
		trade.feeAmountEth = feeAmountEth;
		trade.buyAmountEth = buyAmountEth;
		trade.sellAmountEth = sellAmountEth;
		trade.buyAmountUsd = buyAmountUsd;
		trade.sellAmountUsd = sellAmountUsd;
		trade.save();

		// determine the amount to calculate volumes.
		// try first with sellAmountUsd
		// if it can't be calculated will use buyAmounts
		let usdAmountForVolumes = sellAmountUsd;
		let ethAmountForVolumes = sellAmountEth;
		if (sellAmountUsd && sellAmountUsd.le(ZERO_BD)) {
			usdAmountForVolumes = buyAmountUsd;
			ethAmountForVolumes = buyAmountEth;
		}

		users.getOrCreateTrader(owner, timestamp, ownerAddress, ethAmountForVolumes, usdAmountForVolumes);
		users.getOrCreateSolver(solver, ethAmountForVolumes, usdAmountForVolumes);

		totals.addVolumesAndFees(ethAmountForVolumes, usdAmountForVolumes, feeAmountEth, feeAmountUsd, timestamp);

		pairs.createOrUpdatePair(
			timestamp,
			buyTokenId,
			sellTokenId,
			buyAmount,
			sellAmount,
			sellAmountEth,
			sellAmountUsd,
			buyTokenPriceUsd,
			sellTokenPriceUsd,
			buyAmountDecimals,
			sellAmountDecimals
		);
	}
}
