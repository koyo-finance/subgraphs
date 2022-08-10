import { Address, BigDecimal, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Settlement } from '../../generated/schema';
import { WETH, ZERO_BD } from '../constants';
import { tokenToDecimal } from '../helpers/token';
import { getTokenPriceInUsd } from './pricing';
import { addSettlementCount } from './totals';

export function getOrCreateSettlement(txHash: Bytes, tradeTimestamp: i32, solver: Address, txGasPrice: BigInt, feeAmountUsd: BigDecimal): void {
	const settlementId = txHash.toHexString();

	let settlement = Settlement.load(settlementId);

	const txCostNative = tokenToDecimal(txGasPrice, 18);
	// txgasPrice in Eth networks is expressed in eth so we need to do a conversion
	const ethPrice = getTokenPriceInUsd(WETH);
	const txCostUsd = ethPrice ? txCostNative.times(ethPrice) : ZERO_BD;

	if (!settlement) {
		settlement = new Settlement(settlementId);
		settlement.txHash = txHash;
		settlement.firstTradeTimestamp = tradeTimestamp;
		settlement.solver = solver.toHexString();
		settlement.txCostUsd = txCostUsd;
		settlement.txCostNative = txCostNative;
		settlement.aggregatedFeeAmountUsd = ZERO_BD;
		settlement.profitability = ZERO_BD;

		addSettlementCount(tradeTimestamp);
	}
	const prevFeeAmountUsd = settlement.aggregatedFeeAmountUsd;
	settlement.aggregatedFeeAmountUsd = prevFeeAmountUsd.plus(feeAmountUsd);
	settlement.profitability = settlement.aggregatedFeeAmountUsd.minus(settlement.txCostUsd);
	settlement.save();
}
