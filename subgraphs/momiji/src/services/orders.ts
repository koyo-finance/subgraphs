import { log } from '@graphprotocol/graph-ts';
import { Order } from '../../generated/schema';
import { addOrderCount } from './totals';

export function invalidateOrder(orderId: string, timestamp: i32): Order {
	let order = Order.load(orderId);

	if (!order) {
		order = new Order(orderId);
		log.info('Order {} was not found. It was created for being invalidated', [orderId]);
	}

	order.isValid = false;
	order.invalidateTimestamp = timestamp;

	return order as Order;
}

export function setPresignature(orderId: string, owner: string, timestamp: i32, signed: boolean): Order {
	// check if makes sense to count orders (in totals) that are coming from here
	const order = getOrCreateOrder(orderId, owner, timestamp);

	order.presignTimestamp = timestamp;
	order.isSigned = signed;

	return order as Order;
}

export function getOrCreateOrderForTrade(orderId: string, timestamp: i32, owner: string): Order {
	const order = getOrCreateOrder(orderId, owner, timestamp);
	order.tradesTimestamp = timestamp;

	return order as Order;
}

function getOrCreateOrder(orderId: string, owner: string, timestamp: i32): Order {
	let order = Order.load(orderId);

	if (!order) {
		order = new Order(orderId);
		order.isValid = true;
		order.isSigned = false;

		addOrderCount(timestamp);
	}

	order.owner = owner;

	return order as Order;
}
