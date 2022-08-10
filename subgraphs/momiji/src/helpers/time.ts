export function getDayTotalTimestamp(timestamp: i32): i32 {
	const day = timestamp / 86400;
	return day * 86400;
}

export function getHourTotalTimestamp(timestamp: i32): i32 {
	const hour = timestamp / 3600;
	return hour * 3600;
}
