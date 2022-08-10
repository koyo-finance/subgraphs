import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { KoyoLatestPrice } from '../../generated/schema';
import { ONE_BD, PRICING_ASSETS, USD_STABLE_ASSETS, WETH, ZERO_ADDRESS_ADDRESS, ZERO_BD } from '../constants';

export function valueInETH(value: BigDecimal, pricingAsset: Address): BigDecimal {
	let ethValue = ZERO_BD;

	const pricingAssetInETH = KoyoLatestPrice.load(getLatestPriceId(pricingAsset, WETH));

	if (pricingAssetInETH !== null) {
		ethValue = value.times(pricingAssetInETH.price);
	}

	return ethValue;
}

export function valueInUSD(value: BigDecimal, pricingAsset: Address): BigDecimal {
	let usdValue = ZERO_BD;

	if (isUSDStable(pricingAsset)) {
		usdValue = value;
	} else {
		// convert to USD
		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let i: i32 = 0; i < USD_STABLE_ASSETS.length; i++) {
			const pricingAssetInUSD = KoyoLatestPrice.load(getLatestPriceId(pricingAsset, USD_STABLE_ASSETS[i]));

			if (pricingAssetInUSD !== null) {
				usdValue = value.times(pricingAssetInUSD.price);
				break;
			}
		}
	}

	// if there's no price in USD
	if (usdValue.equals(ZERO_BD)) {
		// try to convert it first to ETH
		const ethValue = valueInETH(value, pricingAsset);

		if (ethValue.gt(ZERO_BD)) {
			// then convert value in ETH to USD
			usdValue = valueInUSD(ethValue, WETH);
		}
	}

	return usdValue;
}

export function swapValueInUSD(tokenInAddress: Address, tokenAmountIn: BigDecimal, tokenOutAddress: Address, tokenAmountOut: BigDecimal): BigDecimal {
	let swapValueUSD = ZERO_BD;

	if (isUSDStable(tokenOutAddress)) {
		swapValueUSD = valueInUSD(tokenAmountOut, tokenOutAddress);
	} else if (isUSDStable(tokenInAddress)) {
		swapValueUSD = valueInUSD(tokenAmountIn, tokenInAddress);
	} else {
		const tokenInSwapValueUSD = valueInUSD(tokenAmountIn, tokenInAddress);
		const tokenOutSwapValueUSD = valueInUSD(tokenAmountOut, tokenOutAddress);
		const divisor = tokenInSwapValueUSD.gt(ZERO_BD) && tokenOutSwapValueUSD.gt(ZERO_BD) ? BigDecimal.fromString('2') : ONE_BD;
		swapValueUSD = tokenInSwapValueUSD.plus(tokenOutSwapValueUSD).div(divisor);
	}

	return swapValueUSD;
}

export function isUSDStable(asset: Address): boolean {
	// eslint-disable-next-line @typescript-eslint/prefer-for-of
	for (let i: i32 = 0; i < USD_STABLE_ASSETS.length; i++) {
		if (USD_STABLE_ASSETS[i] === asset) return true;
	}
	return false;
}

export function isPricingAsset(asset: Address): boolean {
	// eslint-disable-next-line @typescript-eslint/prefer-for-of
	for (let i: i32 = 0; i < PRICING_ASSETS.length; i++) {
		if (PRICING_ASSETS[i] === asset) return true;
	}
	return false;
}

export function getLatestPriceId(tokenAddress: Address, pricingAsset: Address): string {
	return tokenAddress.toHexString().concat('-').concat(pricingAsset.toHexString());
}

export function getPoolHistoricalLiquidityId(poolId: string, tokenAddress: Address, block: BigInt): string {
	return poolId.concat('-').concat(tokenAddress.toHexString()).concat('-').concat(block.toString());
}

export function getTokenPriceId(poolId: string, tokenAddress: Address, stableTokenAddress: Address, block: BigInt): string {
	return poolId
		.concat('-')
		.concat(tokenAddress.toHexString())
		.concat('-')
		.concat(stableTokenAddress.toHexString())
		.concat('-')
		.concat(block.toString());
}

export function getPreferentialPricingAsset(assets: Address[]): Address {
	// eslint-disable-next-line @typescript-eslint/prefer-for-of
	for (let i: i32 = 0; i < PRICING_ASSETS.length; i++) {
		if (assets.includes(PRICING_ASSETS[i])) return PRICING_ASSETS[i];
	}

	return ZERO_ADDRESS_ADDRESS;
}
