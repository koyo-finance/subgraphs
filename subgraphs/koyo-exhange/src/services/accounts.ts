import { Address, Bytes } from '@graphprotocol/graph-ts';
import { integer } from '@protofire/subgraph-toolkit';
import { Account, AccountInternalBalance } from '../../generated/schema';
import { ZERO_BD } from '../constants';

export function getOrRegisterAccount(address: Bytes): Account {
	let account = Account.load(address.toHexString());

	if (account === null) {
		account = new Account(address.toHexString());
		account.address = address;

		account.save();
	}

	return account;
}

export function getOrRegisterAccountInternalBalance(account: string, token: Address): AccountInternalBalance {
	const balanceId = account.concat(token.toHexString());
	let accountInternalBalance = AccountInternalBalance.load(balanceId);

	if (accountInternalBalance === null) {
		accountInternalBalance = new AccountInternalBalance(balanceId);

		accountInternalBalance.account = account;
		accountInternalBalance.token = token;

		accountInternalBalance.balance = ZERO_BD;
		accountInternalBalance.balanceRaw = integer.ZERO;

		accountInternalBalance.save();
	}

	return accountInternalBalance;
}
