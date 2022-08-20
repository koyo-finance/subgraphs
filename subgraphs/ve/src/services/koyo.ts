import { integer } from '@protofire/subgraph-toolkit';
import { Koyo } from '../../generated/schema';

export function findOrRegisterKoyo(): Koyo {
	let vault = Koyo.load('1');

	if (vault === null) {
		vault = new Koyo('1');

		vault.gaugeCount = integer.ZERO;
		vault.gaugeTypeCount = integer.ZERO;
	}

	return vault;
}
