import { log } from '@graphprotocol/graph-ts';
import { integer } from '@protofire/subgraph-toolkit';
import { GaugeType } from '../../generated/schema';

export function getGaugeType(id: string): GaugeType | null {
	return GaugeType.load(id)!;
}

export function registerGaugeType(id: string, name: string): GaugeType {
	const gaugeType = new GaugeType(id);
	gaugeType.name = name;
	gaugeType.gaugeCount = integer.ZERO;

	gaugeType.save();

	log.info('Created new Gauge type: {} "{}"', [id, name]);

	return gaugeType;
}
