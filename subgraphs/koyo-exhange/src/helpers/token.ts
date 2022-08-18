import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { ERC20 } from '../../generated/Vault/ERC20';

export function getTokenDecimals(tokenAddress: Address): i32 {
	const token = ERC20.bind(tokenAddress);
	const decimalsTried = token.try_decimals();

	return decimalsTried.reverted ? 0 : decimalsTried.value;
}

export function tokenToDecimal(amount: BigInt, decimals: i32): BigDecimal {
	const scale = BigInt.fromI32(10)
		.pow(decimals as u8)
		.toBigDecimal();

	return amount.toBigDecimal().div(scale);
}

export function getPoolTokenId(poolId: string, tokenAddress: Address): string {
	return poolId.concat('-').concat(tokenAddress.toHexString());
}
