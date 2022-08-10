import { Address, BigDecimal } from '@graphprotocol/graph-ts';
import { User } from '../../generated/schema';
import { ZERO_BD } from '../constants';
import { totals } from './totals';

export namespace users {
	function getOrCreateUserEntity(id: string, address: Address): User {
		let user = User.load(id);
		if (!user) {
			user = new User(id);
			user.address = address;
			user.isSolver = false;
			user.numberOfTrades = 0;
			user.solvedAmountEth = ZERO_BD;
			user.solvedAmountUsd = ZERO_BD;
			user.tradedAmountEth = ZERO_BD;
			user.tradedAmountUsd = ZERO_BD;
			user.firstTradeTimestamp = 0;
		}

		return user as User;
	}

	export function getOrCreateTrader(
		orderOwner: string,
		timestamp: i32,
		owner: Address,
		tradedAmountEth: BigDecimal | null,
		tradedAmountUsd: BigDecimal | null
	): void {
		const user = getOrCreateUserEntity(orderOwner, owner);
		const prevTradedAmountUsd = user.tradedAmountUsd;
		const prevTradedAmountEth = user.tradedAmountEth;

		if (!user.firstTradeTimestamp) {
			user.firstTradeTimestamp = timestamp;
			totals.addTraderCount();
		}

		if (tradedAmountUsd) {
			if (prevTradedAmountUsd) {
				user.tradedAmountUsd = prevTradedAmountUsd.plus(tradedAmountUsd);
			} else {
				user.tradedAmountUsd = tradedAmountUsd;
			}
		}
		if (tradedAmountEth) {
			if (prevTradedAmountEth) {
				user.tradedAmountEth = prevTradedAmountEth.plus(tradedAmountEth);
			} else {
				user.tradedAmountEth = tradedAmountEth;
			}
		}

		user.save();
	}

	export function getOrCreateSigner(orderOwner: string, owner: Address): void {
		const user = getOrCreateUserEntity(orderOwner, owner);
		user.save();
	}

	export function getOrCreateSolver(solver: Address, solvedAmountEth: BigDecimal | null, solvedAmountUsd: BigDecimal | null): void {
		const user = getOrCreateUserEntity(solver.toHexString(), solver);
		const prevNumOfTrades = user.numberOfTrades;
		const prevSolvedAmountUsd = user.solvedAmountUsd;
		const prevSolvedAmountEth = user.solvedAmountEth;

		user.isSolver = true;
		user.numberOfTrades = prevNumOfTrades + 1;
		if (solvedAmountUsd) {
			if (prevSolvedAmountUsd) {
				user.solvedAmountUsd = prevSolvedAmountUsd.plus(solvedAmountUsd);
			} else {
				user.solvedAmountUsd = solvedAmountUsd;
			}
		}
		if (solvedAmountEth) {
			if (prevSolvedAmountEth) {
				user.solvedAmountEth = prevSolvedAmountEth.plus(solvedAmountEth);
			} else {
				user.solvedAmountEth = solvedAmountEth;
			}
		}

		user.save();
	}
}
