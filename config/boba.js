module.exports = {
	network: 'boba',
	assets: {
		list: [
			{ symbol: 'USD', address: '0x66a2A913e447d6b4BF33EFbec43aAeF87890FBbc' }, // USDC
			{ symbol: 'WETH', address: '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000' },
			{ symbol: 'KYO', address: '0x618CC6549ddf12de637d46CDDadaFC0C2951131C' },
			{ symbol: 'BOBA', address: '0xa18bF3994C0Cc6E3b63ac420308E5383f53120D7' },
			{ symbol: 'FRAX', address: '0x7562F525106F5d54E891e005867Bf489B5988CD9' },
			{ symbol: 'DAI', address: '0xf74195Bb8a5cf652411867c5C2C5b8C2a402be35' },
			{ symbol: 'USDC', address: '0x66a2A913e447d6b4BF33EFbec43aAeF87890FBbc' },
			{ symbol: 'USDT', address: '0x5DE1677344D3Cb0D7D465c10b72A8f60699C062d' }
		],
		pricing: ['WETH', 'USDC', 'DAI', 'BOBA', 'FRAX', 'USDT', 'KYO'],
		stable: ['USDC', 'DAI', 'FRAX', 'USDT']
	},
	koyo: {
		vault: {
			address: '0x2A4409Cc7d2AE7ca1E3D915337D1B6Ba2350D6a3',
			startBlock: 668337
		}
	},
	momiji: {
		settlement: {
			address: '0xc3E6AEC4300c78b2D12966457f113f8C2B30949b',
			startBlock: 745834
		}
	}
};