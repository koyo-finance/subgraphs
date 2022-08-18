import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import { JoinExit, Pool, Swap, TokenPrice } from '../../../generated/schema';
import { InternalBalanceChanged, PoolBalanceChanged, Swap as SwapEvent } from '../../../generated/Vault/Vault';
import { MIN_POOL_LIQUIDITY, SWAP_IN, SWAP_OUT, ZERO, ZERO_ADDRESS_ADDRESS, ZERO_BD } from '../../constants';
import { getPreferentialPricingAsset, getTokenPriceId, isPricingAsset, swapValueInUSD, valueInUSD } from '../../helpers/pricing';
import { scaleDown } from '../../helpers/scaling';
import { getTokenDecimals, tokenToDecimal } from '../../helpers/token';
import { getOrRegisterAccount, getOrRegisterAccountInternalBalance } from '../../services/accounts';
import { getPool, updatePoolWeights } from '../../services/pool/pools';
import { getOrRegisterKoyoSnapshot, getOrRegisterTokenSnapshot } from '../../services/pool/snapshot';
import { getOrRegisterPoolToken, getOrRegisterToken, getPoolToken, updateTokenBalances } from '../../services/pool/tokens';
import { updateLatestPrice, updatePoolLiquidity } from '../../services/pricing';
import { getOrRegisterTradePair } from '../../services/trade';
import { findOrRegisterVault } from '../../services/vault';

export function handleBalanceChange(event: PoolBalanceChanged): void {
	const amounts: BigInt[] = event.params.deltas;

	if (amounts.length === 0) {
		return;
	}
	const total: BigInt = amounts.reduce<BigInt>((sum, amount) => sum.plus(amount), new BigInt(0));
	if (total.gt(ZERO)) {
		handlePoolJoined(event);
	} else {
		handlePoolExited(event);
	}
}

export function handleInternalBalanceChange(event: InternalBalanceChanged): void {
	const token = event.params.token;
	const account = getOrRegisterAccount(event.params.user);
	const accountBalance = getOrRegisterAccountInternalBalance(account.id, token);

	const transferAmount = tokenToDecimal(event.params.delta, getTokenDecimals(token));
	accountBalance.balance = accountBalance.balance.plus(transferAmount);
	accountBalance.balanceRaw = accountBalance.balanceRaw.plus(event.params.delta);

	accountBalance.save();
}

export function handleSwapEvent(event: SwapEvent): void {
	getOrRegisterAccount(event.transaction.from);

	const poolId = event.params.poolId;
	const poolIdString = event.params.poolId.toHexString();
	const account = getOrRegisterAccount(event.transaction.from);
	const pool = getPool(poolIdString);

	if (pool === null) {
		log.warning('Pool not found in handleSwapEvent: {}', [poolId.toHexString()]);
		return;
	}

	updatePoolWeights(poolIdString);

	const poolAddress = pool.address;
	const tokenInAddress: Address = event.params.tokenIn;
	const tokenOutAddress: Address = event.params.tokenOut;

	const logIndex = event.logIndex;
	const transactionHash = event.transaction.hash;
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

	let swapValueUSD = ZERO_BD;
	let swapFeesUSD = ZERO_BD;

	if (poolAddress !== tokenInAddress && poolAddress !== tokenOutAddress) {
		const swapFee = pool.swapFee;
		swapValueUSD = swapValueInUSD(tokenInAddress, tokenAmountIn, tokenOutAddress, tokenAmountOut);
		swapFeesUSD = swapValueUSD.times(swapFee);
	}

	const swapId = transactionHash.toHexString().concat(logIndex.toString());
	const swap = new Swap(swapId);
	swap.tokenIn = tokenInAddress;
	swap.tokenInSym = poolTokenIn.symbol;
	swap.tokenAmountIn = tokenAmountIn;

	swap.tokenOut = tokenOutAddress;
	swap.tokenOutSym = poolTokenOut.symbol;
	swap.tokenAmountOut = tokenAmountOut;

	swap.valueUSD = swapValueUSD;

	swap.caller = event.transaction.from;
	swap.account = account.id;
	swap.poolId = poolId.toHex();

	swap.timestamp = blockTimestamp;
	swap.tx = transactionHash;
	swap.save();

	// update pool swapsCount
	// let pool = Pool.load(poolId.toHex());
	pool.swapsCount = pool.swapsCount.plus(BigInt.fromI32(1));
	pool.totalSwapVolume = pool.totalSwapVolume.plus(swapValueUSD);
	pool.totalSwapFee = pool.totalSwapFee.plus(swapFeesUSD);

	pool.save();

	// update vault total swap volume
	const vault = findOrRegisterVault();

	vault.totalSwapVolume = vault.totalSwapVolume.plus(swapValueUSD);
	vault.totalSwapFee = vault.totalSwapFee.plus(swapFeesUSD);
	vault.totalSwapCount = vault.totalSwapCount.plus(BigInt.fromI32(1));

	vault.save();

	const vaultSnapshot = getOrRegisterKoyoSnapshot(vault.id, blockTimestamp);

	vaultSnapshot.totalSwapVolume = vault.totalSwapVolume;
	vaultSnapshot.totalSwapFee = vault.totalSwapFee;
	vaultSnapshot.totalSwapCount = vault.totalSwapCount;

	vaultSnapshot.save();

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

	const tradePair = getOrRegisterTradePair(tokenInAddress, tokenOutAddress);

	tradePair.totalSwapVolume = tradePair.totalSwapVolume.plus(swapValueUSD);
	tradePair.totalSwapFee = tradePair.totalSwapFee.plus(swapFeesUSD);

	tradePair.save();

	if (swap.tokenAmountOut === ZERO_BD || swap.tokenAmountIn === ZERO_BD) {
		return;
	}

	// Capture price
	// TODO: refactor these if statements using a helper function
	const block = event.block.number;
	const tokenInWeight = poolTokenIn.weight;
	const tokenOutWeight = poolTokenOut.weight;
	if (isPricingAsset(tokenInAddress) && pool.totalLiquidity.gt(MIN_POOL_LIQUIDITY)) {
		const tokenPriceId = getTokenPriceId(poolId.toHex(), tokenOutAddress, tokenInAddress, block);
		const tokenPrice = new TokenPrice(tokenPriceId);
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
		const tokenPrice = new TokenPrice(tokenPriceId);
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
		updatePoolLiquidity(poolId.toHex(), block, preferentialToken, blockTimestamp);
	}
}

function handlePoolJoined(event: PoolBalanceChanged): void {
	const poolId: string = event.params.poolId.toHexString();
	const amounts: BigInt[] = event.params.deltas;
	const blockTimestamp = event.block.timestamp.toI32();
	const logIndex = event.logIndex;
	const transactionHash = event.transaction.hash;
	const liquidityProvider = getOrRegisterAccount(event.params.liquidityProvider);

	const pool = Pool.load(poolId);

	if (pool === null) {
		log.warning('Pool not found in handlePoolJoined: {} {}', [poolId, transactionHash.toHexString()]);
		return;
	}

	const tokenAddresses = pool.tokensList;

	const joinId = transactionHash.toHexString().concat(logIndex.toString());
	const join = new JoinExit(joinId);
	join.sender = event.params.liquidityProvider;
	const joinAmounts = new Array<BigDecimal>();

	for (let i: i32 = 0; i < tokenAddresses.length; i++) {
		const tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
		const poolToken = getOrRegisterPoolToken(poolId, tokenAddress);
		if (poolToken === null) {
			throw new Error('poolToken not found');
		}
		const joinAmount = scaleDown(amounts[i], poolToken.decimals);
		joinAmounts.push(joinAmount);
	}

	join.type = 'Join';
	join.amounts = joinAmounts;
	join.pool = event.params.poolId.toHexString();
	join.account = liquidityProvider.id;
	join.timestamp = blockTimestamp;
	join.tx = transactionHash;
	join.valueUSD = ZERO_BD;

	for (let i: i32 = 0; i < tokenAddresses.length; i++) {
		const tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
		const poolToken = getOrRegisterPoolToken(poolId, tokenAddress);

		const tokenAmountIn = tokenToDecimal(amounts[i], poolToken.decimals);
		const newAmount = poolToken.balance.plus(tokenAmountIn);
		const tokenAmountInUSD = valueInUSD(tokenAmountIn, tokenAddress);

		join.valueUSD = join.valueUSD.plus(tokenAmountInUSD);

		const token = getOrRegisterToken(tokenAddress);

		token.totalBalanceNotional = token.totalBalanceNotional.plus(tokenAmountIn);
		token.totalBalanceUSD = token.totalBalanceUSD.plus(tokenAmountInUSD);

		token.save();

		const tokenSnapshot = getOrRegisterTokenSnapshot(tokenAddress, event);

		tokenSnapshot.totalBalanceNotional = token.totalBalanceNotional;
		tokenSnapshot.totalBalanceUSD = token.totalBalanceUSD;

		tokenSnapshot.save();

		poolToken.balance = newAmount;
		poolToken.save();
	}

	join.save();

	// eslint-disable-next-line @typescript-eslint/prefer-for-of
	for (let i: i32 = 0; i < tokenAddresses.length; i++) {
		const tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
		if (isPricingAsset(tokenAddress)) {
			const success = updatePoolLiquidity(poolId, event.block.number, tokenAddress, blockTimestamp);
			// Some pricing assets may not have a route back to USD yet
			// so we keep trying until we find one
			if (success) {
				break;
			}
		}
	}
}

function handlePoolExited(event: PoolBalanceChanged): void {
	const poolId = event.params.poolId.toHex();
	const amounts = event.params.deltas;
	const blockTimestamp = event.block.timestamp.toI32();
	const logIndex = event.logIndex;
	const transactionHash = event.transaction.hash;
	const liquidityProvider = getOrRegisterAccount(event.params.liquidityProvider);

	const pool = Pool.load(poolId);
	if (pool == null) {
		log.warning('Pool not found in handlePoolExited: {} {}', [poolId, transactionHash.toHexString()]);
		return;
	}
	const tokenAddresses = pool.tokensList;

	pool.save();

	const exitId = transactionHash.toHexString().concat(logIndex.toString());
	const exit = new JoinExit(exitId);
	exit.sender = event.params.liquidityProvider;
	const exitAmounts = new Array<BigDecimal>();

	for (let i: i32 = 0; i < tokenAddresses.length; i++) {
		const tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
		const poolToken = getOrRegisterPoolToken(poolId, tokenAddress);
		if (poolToken === null) {
			throw new Error('poolToken not found');
		}
		const exitAmount = scaleDown(amounts[i].neg(), poolToken.decimals);
		exitAmounts.push(exitAmount);
	}

	exit.type = 'Exit';
	exit.amounts = exitAmounts;
	exit.pool = event.params.poolId.toHexString();
	exit.account = liquidityProvider.id;
	exit.timestamp = blockTimestamp;
	exit.tx = transactionHash;
	exit.valueUSD = ZERO_BD;

	for (let i: i32 = 0; i < tokenAddresses.length; i++) {
		const tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
		const poolToken = getOrRegisterPoolToken(poolId, tokenAddress);

		// adding initial liquidity
		if (poolToken === null) {
			throw new Error('poolToken not found');
		}

		const tokenAmountOut = tokenToDecimal(amounts[i].neg(), poolToken.decimals);
		const newAmount = poolToken.balance.minus(tokenAmountOut);
		const tokenAmountOutUSD = valueInUSD(tokenAmountOut, tokenAddress);

		exit.valueUSD = exit.valueUSD.plus(tokenAmountOutUSD);

		poolToken.balance = newAmount;
		poolToken.save();

		const token = getOrRegisterToken(tokenAddress);

		token.totalBalanceNotional = token.totalBalanceNotional.minus(tokenAmountOut);
		token.totalBalanceUSD = token.totalBalanceUSD.minus(tokenAmountOutUSD);

		token.save();

		const tokenSnapshot = getOrRegisterTokenSnapshot(tokenAddress, event);

		tokenSnapshot.totalBalanceNotional = token.totalBalanceNotional;
		tokenSnapshot.totalBalanceUSD = token.totalBalanceUSD;

		tokenSnapshot.save();
	}

	exit.save();

	// eslint-disable-next-line @typescript-eslint/prefer-for-of
	for (let i: i32 = 0; i < tokenAddresses.length; i++) {
		const tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
		if (isPricingAsset(tokenAddress)) {
			const success = updatePoolLiquidity(poolId, event.block.number, tokenAddress, blockTimestamp);
			// Some pricing assets may not have a route back to USD yet
			// so we keep trying until we find one
			if (success) {
				break;
			}
		}
	}
}
