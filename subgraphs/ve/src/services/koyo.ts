import { log } from '@graphprotocol/graph-ts';
import { integer } from '@protofire/subgraph-toolkit';
import { Koyo } from '../../generated/schema';

export function findOrRegisterKoyo(): Koyo {
	let koyo = Koyo.load('1');

	if (koyo === null) {
		koyo = new Koyo('1');

		koyo.gaugeCount = integer.ZERO;
		koyo.gaugeTypeCount = integer.ZERO;

		koyo.save();

		log.info('Created new Koyo global "counter"', []);
	}

	return koyo;
}
