import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { integer } from '@protofire/subgraph-toolkit';
import { OracleWeightedPool as OracleWeightedPoolContract } from '../../../generated/OracleWeightedPoolFactory/OracleWeightedPool';
import { PoolCreated } from '../../../generated/OracleWeightedPoolFactory/OracleWeightedPoolFactory';
import { Pool } from '../../../generated/schema';
import { WeightedPool as WeightedPoolContract } from '../../../generated/templates/OracleWeightedPool/WeightedPool';
import { StablePool as StablePoolContract } from '../../../generated/templates/StablePool/StablePool';
import { ERC20 } from '../../../generated/Vault/ERC20';
import { BPT_DECIMALS, ZERO, ZERO_ADDRESS_ADDRESS, ZERO_BD } from '../../constants';
import { scaleDown } from '../../helpers/scaling';
import { tokenToDecimal } from '../../helpers/token';
import { findOrRegisterVault } from '../vault';
import { getOrRegisterPoolShare } from './shares';
import { getOrRegisterPoolToken } from './tokens';

export function getPool(poolId: string): Pool | null {
	return Pool.load(poolId);
}

export function getOrRegisterPool(poolId: string): Pool {
	let pool = Pool.load(poolId);

	if (pool === null) {
		pool = new Pool(poolId);
		const vault = findOrRegisterVault();

		pool.vault = vault.id;
		pool.strategyType = i32(parseInt(poolId.slice(42, 46), 10));
		pool.tokensList = [];
		pool.totalWeight = ZERO_BD;
		pool.totalSwapVolume = ZERO_BD;
		pool.totalSwapFee = ZERO_BD;
		pool.totalLiquidity = ZERO_BD;
		pool.totalShares = ZERO_BD;
		pool.totalSharesRaw = integer.ZERO;
		pool.swapsCount = BigInt.fromI32(0);
		pool.holdersCount = BigInt.fromI32(0);
	}

	return pool;
}

export function handleNewPool(event: PoolCreated, poolId: Bytes, swapFee: BigInt): Pool {
	const poolAddress: Address = event.params.pool;
	let pool = Pool.load(poolId.toHexString());

	if (pool === null) {
		pool = getOrRegisterPool(poolId.toHexString());

		pool.swapFee = scaleDown(swapFee, 18);
		pool.createTime = event.block.timestamp.toI32();
		pool.address = poolAddress;
		pool.tx = event.transaction.hash;
		pool.swapEnabled = true;

		const bpt = ERC20.bind(poolAddress);

		const nameTried = bpt.try_name();
		const symbolTried = bpt.try_symbol();

		pool.name = nameTried.reverted ? null : nameTried.value;
		pool.symbol = symbolTried.reverted ? null : symbolTried.value;

		pool.save();

		const vault = findOrRegisterVault();
		vault.poolCount += 1;
		vault.save();
	}

	return pool;
}

export function updatePoolWeights(poolId: string): void {
	const pool = Pool.load(poolId);
	if (pool === null) return;

	const poolContract = OracleWeightedPoolContract.bind(changetype<Address>(pool.address));

	const tokensList = pool.tokensList;
	const weightsTried = poolContract.try_getNormalizedWeights();
	if (!weightsTried.reverted) {
		const weights = weightsTried.value;

		if (weights.length === tokensList.length) {
			let totalWeight = ZERO_BD;

			for (let i = 0; i < tokensList.length; i++) {
				const tokenAddress = changetype<Address>(tokensList[i]);
				const weight = weights[i];

				const poolToken = getOrRegisterPoolToken(poolId, tokenAddress);
				if (poolToken !== null) {
					poolToken.weight = scaleDown(weight, 18);
					poolToken.save();
				}

				totalWeight = totalWeight.plus(scaleDown(weight, 18));
			}

			pool.totalWeight = totalWeight;
		}
	}

	pool.save();
}

export function generalisedHandleBPTTransfer(poolAddress: Address, from: Address, to: Address, value: BigInt): void {
	const poolContract = WeightedPoolContract.bind(poolAddress);

	const poolIdTried = poolContract.try_getPoolId();
	const poolId = poolIdTried.value;

	const isMint = from.equals(ZERO_ADDRESS_ADDRESS);
	const isBurn = to.equals(ZERO_ADDRESS_ADDRESS);

	const poolShareFrom = getOrRegisterPoolShare(poolId.toHexString(), from);
	const poolShareFromBalance = poolShareFrom === null ? ZERO_BD : poolShareFrom.balance;

	const poolShareTo = getOrRegisterPoolShare(poolId.toHexString(), to);
	const poolShareToBalance = poolShareTo === null ? ZERO_BD : poolShareTo.balance;

	const pool = Pool.load(poolId.toHexString()) as Pool;

	if (isMint) {
		poolShareTo.balance = poolShareTo.balance.plus(tokenToDecimal(value, BPT_DECIMALS));
		poolShareTo.save();
		pool.totalShares = pool.totalShares.plus(tokenToDecimal(value, BPT_DECIMALS));
	} else if (isBurn) {
		poolShareFrom.balance = poolShareFrom.balance.minus(tokenToDecimal(value, BPT_DECIMALS));
		poolShareFrom.save();
		pool.totalShares = pool.totalShares.minus(tokenToDecimal(value, BPT_DECIMALS));
	} else {
		poolShareTo.balance = poolShareTo.balance.plus(tokenToDecimal(value, BPT_DECIMALS));
		poolShareTo.save();

		poolShareFrom.balance = poolShareFrom.balance.minus(tokenToDecimal(value, BPT_DECIMALS));
		poolShareFrom.save();
	}

	if (poolShareTo !== null && poolShareTo.balance.notEqual(ZERO_BD) && poolShareToBalance.equals(ZERO_BD)) {
		pool.holdersCount = pool.holdersCount.plus(BigInt.fromI32(1));
	}

	if (poolShareFrom !== null && poolShareFrom.balance.equals(ZERO_BD) && poolShareFromBalance.notEqual(ZERO_BD)) {
		pool.holdersCount = pool.holdersCount.minus(BigInt.fromI32(1));
	}

	pool.save();
}

export function getAmp(poolContract: StablePoolContract): BigInt {
	const ampTried = poolContract.try_getAmplificationParameter();
	let amp = ZERO;

	if (!ampTried.reverted) {
		const value = ampTried.value.value0;
		const precision = ampTried.value.value2;
		amp = value.div(precision);
	}

	return amp;
}

export function updateAmpFactor(pool: Pool): void {
	const poolContract = StablePoolContract.bind(changetype<Address>(pool.address));

	pool.amp = getAmp(poolContract);

	pool.save();
}
