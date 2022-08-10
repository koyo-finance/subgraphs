import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import { KoyoTokenPrice } from '../../generated/schema';
import { Swap as SwapEvent } from '../../generated/Vault/Vault';
import { MIN_POOL_LIQUIDITY, SWAP_IN, SWAP_OUT, ZERO_ADDRESS_ADDRESS, ZERO_BD } from '../constants';
import { getPreferentialPricingAsset, getTokenPriceId, isPricingAsset, swapValueInUSD, valueInUSD } from '../helpers/pricing';
import { scaleDown } from '../helpers/scaling';
import { getPool, updatePoolWeights } from '../services/pool/pools';
import { getPoolToken, updateTokenBalances } from '../services/pool/tokens';
import { updateLatestPrice, updatePoolLiquidity } from '../services/pricing';

export function handleSwapEvent(event: SwapEvent): void {
	const poolId = event.params.poolId;
	const poolIdString = event.params.poolId.toHexString();
	const pool = getPool(poolIdString);

	if (pool === null) {
		log.warning('Pool not found in handleSwapEvent: {}', [poolId.toHexString()]);
		return;
	}

	updatePoolWeights(poolIdString);

	const poolAddress = pool.address;
	const tokenInAddress: Address = event.params.tokenIn;
	const tokenOutAddress: Address = event.params.tokenOut;

	const blockTimestamp = event.block.timestamp.toI32();

	const poolTokenIn = getPoolToken(poolId.toHexString(), tokenInAddress);
	const poolTokenOut = getPoolToken(poolId.toHexString(), tokenOutAddress);
	if (poolTokenIn === null || poolTokenOut === null) {
		log.warning('PoolToken not found in handleSwapEvent: (tokenIn: {}), (tokenOut: {})', [
			tokenInAddress.toHexString(),
			tokenOutAddress.toHexString()
		]);
		return;
	}

	const tokenAmountIn: BigDecimal = scaleDown(event.params.amountIn, poolTokenIn.decimals);
	const tokenAmountOut: BigDecimal = scaleDown(event.params.amountOut, poolTokenOut.decimals);

	pool.save();

	const swapValueUSD =
		poolAddress !== tokenInAddress && poolAddress !== tokenOutAddress
			? swapValueInUSD(tokenInAddress, tokenAmountIn, tokenOutAddress, tokenAmountOut)
			: ZERO_BD;

	const newInAmount = poolTokenIn.balance.plus(tokenAmountIn);
	poolTokenIn.balance = newInAmount;
	poolTokenIn.save();

	const newOutAmount = poolTokenOut.balance.minus(tokenAmountOut);
	poolTokenOut.balance = newOutAmount;

	poolTokenOut.save();

	// update volume and balances for the tokens
	// updates token snapshots as well
	updateTokenBalances(tokenInAddress, swapValueUSD, tokenAmountIn, SWAP_IN);
	updateTokenBalances(tokenOutAddress, swapValueUSD, tokenAmountOut, SWAP_OUT);

	if (tokenAmountIn === ZERO_BD || tokenAmountOut === ZERO_BD) {
		return;
	}

	const block = event.block.number;
	const tokenInWeight = poolTokenIn.weight;
	const tokenOutWeight = poolTokenOut.weight;
	if (isPricingAsset(tokenInAddress) && pool.totalLiquidity.gt(MIN_POOL_LIQUIDITY)) {
		const tokenPriceId = getTokenPriceId(poolId.toHex(), tokenOutAddress, tokenInAddress, block);
		const tokenPrice = new KoyoTokenPrice(tokenPriceId);
		// tokenPrice.poolTokenId = getPoolTokenId(poolId, tokenOutAddress);
		tokenPrice.poolId = poolId.toHexString();
		tokenPrice.block = block;
		tokenPrice.timestamp = blockTimestamp;
		tokenPrice.asset = tokenOutAddress;
		tokenPrice.amount = tokenAmountIn;
		tokenPrice.pricingAsset = tokenInAddress;

		if (tokenInWeight && tokenOutWeight) {
			// As the swap is with a WeightedPool, we can easily calculate the spot price between the two tokens
			// based on the pool's weights and updated balances after the swap.
			tokenPrice.price = newInAmount.div(tokenInWeight).div(newOutAmount.div(tokenOutWeight));
		} else {
			// Otherwise we can get a simple measure of the price from the ratio of amount in vs amount out
			tokenPrice.price = tokenAmountIn.div(tokenAmountOut);
		}
		tokenPrice.priceUSD = valueInUSD(tokenPrice.price, tokenInAddress);

		tokenPrice.save();

		updateLatestPrice(tokenPrice);
	}
	if (isPricingAsset(tokenOutAddress) && pool.totalLiquidity.gt(MIN_POOL_LIQUIDITY)) {
		const tokenPriceId = getTokenPriceId(poolId.toHex(), tokenInAddress, tokenOutAddress, block);
		const tokenPrice = new KoyoTokenPrice(tokenPriceId);
		// tokenPrice.poolTokenId = getPoolTokenId(poolId, tokenInAddress);
		tokenPrice.poolId = poolId.toHexString();
		tokenPrice.block = block;
		tokenPrice.timestamp = blockTimestamp;
		tokenPrice.asset = tokenInAddress;
		tokenPrice.amount = tokenAmountOut;
		tokenPrice.pricingAsset = tokenOutAddress;

		if (tokenInWeight && tokenOutWeight) {
			// As the swap is with a WeightedPool, we can easily calculate the spot price between the two tokens
			// based on the pool's weights and updated balances after the swap.
			tokenPrice.price = newOutAmount.div(tokenOutWeight).div(newInAmount.div(tokenInWeight));
		} else {
			// Otherwise we can get a simple measure of the price from the ratio of amount out vs amount in
			tokenPrice.price = tokenAmountOut.div(tokenAmountIn);
		}
		tokenPrice.priceUSD = valueInUSD(tokenPrice.price, tokenOutAddress);

		tokenPrice.save();

		updateLatestPrice(tokenPrice);
	}

	const preferentialToken = getPreferentialPricingAsset([tokenInAddress, tokenOutAddress]);
	if (preferentialToken !== ZERO_ADDRESS_ADDRESS) {
		updatePoolLiquidity(poolId.toHex(), preferentialToken);
	}
}
