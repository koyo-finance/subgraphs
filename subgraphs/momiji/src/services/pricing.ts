import { Address, BigDecimal, Bytes } from '@graphprotocol/graph-ts';
import { KoyoLatestPrice, KoyoPool, KoyoTokenPrice } from '../../generated/schema';
import { ONE_BD, WETH, ZERO_BD } from '../constants';
import { getLatestPriceId, valueInETH, valueInUSD } from '../helpers/pricing';
import { getOrRegisterToken, getPoolToken } from './pool/tokens';

export function updatePoolLiquidity(poolId: string, pricingAsset: Address): boolean {
	const pool = KoyoPool.load(poolId);
	if (pool === null) return false;

	const tokensList: Bytes[] = pool.tokensList;
	if (tokensList.length < 2) return false;

	let poolValue: BigDecimal = ZERO_BD;

	// eslint-disable-next-line @typescript-eslint/prefer-for-of
	for (let j: i32 = 0; j < tokensList.length; j++) {
		const tokenAddress: Address = Address.fromString(tokensList[j].toHexString());

		const poolToken = getPoolToken(poolId, tokenAddress);
		if (poolToken === null) continue;

		if (tokenAddress === pricingAsset) {
			poolValue = poolValue.plus(poolToken.balance);
			continue;
		}
		const poolTokenQuantity: BigDecimal = poolToken.balance;

		let price: BigDecimal = ZERO_BD;
		const latestPriceId = getLatestPriceId(tokenAddress, pricingAsset);
		const latestPrice = KoyoLatestPrice.load(latestPriceId);

		// note that we can only meaningfully report liquidity once assets are traded with
		// the pricing asset
		if (latestPrice) {
			// value in terms of priceableAsset
			price = latestPrice.price;
		}

		if (price.gt(ZERO_BD)) {
			const poolTokenValue = price.times(poolTokenQuantity);
			poolValue = poolValue.plus(poolTokenValue);
		}
	}

	const newPoolLiquidity: BigDecimal = valueInUSD(poolValue, pricingAsset) || ZERO_BD;
	// If the pool isn't empty but we have a zero USD value then it's likely that we have a bad pricing asset
	// Don't commit any changes and just report the failure.
	if (poolValue.gt(ZERO_BD) !== newPoolLiquidity.gt(ZERO_BD)) {
		return false;
	}

	// Update pool stats
	pool.totalLiquidity = newPoolLiquidity;

	pool.save();

	return true;
}

export function updateLatestPrice(tokenPrice: KoyoTokenPrice): void {
	const tokenAddress = Address.fromString(tokenPrice.asset.toHexString());
	const pricingAsset = Address.fromString(tokenPrice.pricingAsset.toHexString());

	const latestPriceId = getLatestPriceId(tokenAddress, pricingAsset);
	let latestPrice = KoyoLatestPrice.load(latestPriceId);

	if (latestPrice === null) {
		latestPrice = new KoyoLatestPrice(latestPriceId);
		latestPrice.asset = tokenPrice.asset;
		latestPrice.pricingAsset = tokenPrice.pricingAsset;
	}

	latestPrice.block = tokenPrice.block;
	latestPrice.poolId = tokenPrice.poolId;
	latestPrice.price = tokenPrice.price;
	latestPrice.priceUSD = tokenPrice.priceUSD;
	latestPrice.save();

	const token = getOrRegisterToken(tokenAddress);

	token.latestPrice = latestPrice.id;

	token.save();
}

export function getTokenPriceInUsd(address: Address): BigDecimal | null {
	return valueInUSD(ONE_BD, address);
}

export function getTokenPriceInEth(address: Address): BigDecimal | null {
	return valueInETH(ONE_BD, address);
}
