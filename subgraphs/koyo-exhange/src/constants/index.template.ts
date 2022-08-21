import {
    Address,
    BigDecimal,
    BigInt,
} from '@graphprotocol/graph-ts';
import { ZERO_ADDRESS } from '@protofire/subgraph-toolkit';

{{#assets.list}}{{#.}}
export const {{symbol}}: Address = Address.fromString('{{address}}');
{{/.}}{{/assets.list}}

export const USD: Address = {{assets.usdEquivalent}};

export const PRICING_ASSETS: Address[] = [{{#assets.pricing}}{{.}},{{/assets.pricing}}];
export const USD_STABLE_ASSETS: Address[] = [{{#assets.stable}}{{.}},{{/assets.stable}}];

export const VAULT_ADDRESS: Address = Address.fromString('{{ koyo.vault.address }}');

export const DEFAULT_DECIMALS = 18;
export const DAY = 24 * 60 * 60;
export const BPT_DECIMALS = 18;

export const MIN_POOL_LIQUIDITY = BigDecimal.fromString('10');

export const ZERO = BigInt.fromI32(0);
export const ZERO_BD = BigDecimal.fromString('0');
export const ONE_BD = BigDecimal.fromString('1');

export const SWAP_IN = 0;
export const SWAP_OUT = 1;

export const ZERO_ADDRESS_ADDRESS: Address = changetype<Address>(Address.fromHexString(ZERO_ADDRESS));
