export function getTradePairId(token0Address: string, token1Address: string): string {
	return `${token0Address}-${token1Address}`;
}
