import { Address, BigDecimal } from '@graphprotocol/graph-ts';
import { integer } from '@protofire/subgraph-toolkit';
import { KoyoPoolToken, KoyoToken } from '../../../generated/schema';
import { ERC20 } from '../../../generated/Vault/ERC20';
import { ONE_BD, SWAP_IN, SWAP_OUT, ZERO_BD } from '../../constants';
import { getPoolTokenId } from '../../helpers/token';

export function getOrRegisterToken(tokenAddress: Address): KoyoToken {
	const tokenId = tokenAddress.toHexString();
	let token = KoyoToken.load(tokenId);

	if (token === null) {
		token = new KoyoToken(tokenId);
		const erc20token = ERC20.bind(tokenAddress);

		const nameTried = erc20token.try_name();
		const symbolTried = erc20token.try_symbol();
		const decimalsTried = erc20token.try_decimals();

		token.name = nameTried.reverted ? '' : nameTried.value;
		token.symbol = symbolTried.reverted ? '' : symbolTried.value;
		token.decimals = decimalsTried.reverted ? 0 : decimalsTried.value;
		token.address = tokenAddress.toHexString();

		token.save();
	}

	return token;
}

export function updateTokenBalances(tokenAddress: Address, usdBalance: BigDecimal, notionalBalance: BigDecimal, swapDirection: i32): void {
	const token = getOrRegisterToken(tokenAddress);

	if (swapDirection === SWAP_IN) {
		token.totalBalanceNotional = token.totalBalanceNotional.plus(notionalBalance);
		token.totalBalanceUSD = token.totalBalanceUSD.plus(usdBalance);
	} else if (swapDirection === SWAP_OUT) {
		token.totalBalanceNotional = token.totalBalanceNotional.minus(notionalBalance);
		token.totalBalanceUSD = token.totalBalanceUSD.minus(usdBalance);
	}

	token.totalVolumeUSD = token.totalVolumeUSD.plus(usdBalance);
	token.save();
}

export function getPoolToken(poolId: string, tokenAddress: Address): KoyoPoolToken | null {
	return KoyoPoolToken.load(getPoolTokenId(poolId, tokenAddress));
}

export function getOrRegisterPoolToken(poolId: string, tokenAddress: Address): KoyoPoolToken {
	const poolTokenId = getPoolTokenId(poolId, tokenAddress);
	let poolToken = KoyoPoolToken.load(poolTokenId);

	if (poolToken === null) {
		poolToken = new KoyoPoolToken(poolTokenId);
		const token = ERC20.bind(tokenAddress);
		const tokenEntity = getOrRegisterToken(tokenAddress);

		const nameTried = token.try_name();
		const symbolTried = token.try_symbol();
		const decimalTried = token.try_decimals();

		poolToken.poolId = poolId;
		poolToken.address = tokenAddress.toHexString();

		poolToken.name = nameTried.reverted ? '' : nameTried.value;
		poolToken.symbol = symbolTried.reverted ? '' : symbolTried.value;
		poolToken.decimals = decimalTried.reverted ? 18 : decimalTried.value;

		poolToken.balance = ZERO_BD;
		poolToken.balanceRaw = integer.ZERO;
		poolToken.invested = ZERO_BD;
		poolToken.priceRate = ONE_BD;
		poolToken.token = tokenEntity.id;

		poolToken.save();
	}

	return poolToken;
}
