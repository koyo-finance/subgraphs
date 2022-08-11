import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { assert, newMockEvent, test } from 'matchstick-as';
import { handleBlock } from '../src/mappings/blocks';

test('blocks', () => {
	const block = newMockEvent().block;

	const blockSize = BigInt.fromString('1337');
	block.size = blockSize;

	handleBlock(block);

	const blockId = block.hash.toHex();
	assert.fieldEquals('Block', blockId, 'id', blockId);
	assert.fieldEquals('Block', blockId, 'number', block.number.toString());
	assert.fieldEquals('Block', blockId, 'timestamp', block.timestamp.toString());
	assert.fieldEquals('Block', blockId, 'parentHash', block.parentHash.toHex());
	assert.fieldEquals('Block', blockId, 'author', block.author.toHex());
	assert.fieldEquals('Block', blockId, 'difficulty', block.difficulty.toString());
	assert.fieldEquals('Block', blockId, 'totalDifficulty', block.totalDifficulty.toString());
	assert.fieldEquals('Block', blockId, 'gasUsed', block.gasUsed.toString());
	assert.fieldEquals('Block', blockId, 'gasLimit', block.gasLimit.toString());
	assert.fieldEquals('Block', blockId, 'receiptsRoot', block.receiptsRoot.toHex());
	assert.fieldEquals('Block', blockId, 'transactionsRoot', block.transactionsRoot.toHex());
	assert.fieldEquals('Block', blockId, 'stateRoot', block.stateRoot.toHex());
	assert.fieldEquals('Block', blockId, 'size', blockSize.toString());
	assert.fieldEquals('Block', blockId, 'unclesHash', block.unclesHash.toHex());

	const block2 = newMockEvent().block;
	const address = Address.fromString('0xA16081F360e3847006dB660bae1c6d1b2e17eC2B');
	const addressBytes = address as Bytes;
	const blockId2 = addressBytes.toHex();
	block2.hash = addressBytes;

	handleBlock(block2);

	assert.entityCount('Block', 2);
	assert.fieldEquals('Block', blockId2, 'id', blockId2);
	assert.fieldEquals('Block', blockId2, 'number', block2.number.toString());
	assert.fieldEquals('Block', blockId2, 'timestamp', block2.timestamp.toString());
	assert.fieldEquals('Block', blockId2, 'parentHash', block2.parentHash.toHex());
	assert.fieldEquals('Block', blockId2, 'author', block2.author.toHex());
	assert.fieldEquals('Block', blockId2, 'difficulty', block2.difficulty.toString());
	assert.fieldEquals('Block', blockId2, 'totalDifficulty', block2.totalDifficulty.toString());
	assert.fieldEquals('Block', blockId2, 'gasUsed', block2.gasUsed.toString());
	assert.fieldEquals('Block', blockId2, 'gasLimit', block2.gasLimit.toString());
	assert.fieldEquals('Block', blockId2, 'receiptsRoot', block2.receiptsRoot.toHex());
	assert.fieldEquals('Block', blockId2, 'transactionsRoot', block2.transactionsRoot.toHex());
	assert.fieldEquals('Block', blockId2, 'stateRoot', block2.stateRoot.toHex());
	assert.fieldEquals('Block', blockId2, 'size', blockSize.toString());
	assert.fieldEquals('Block', blockId2, 'unclesHash', block2.unclesHash.toHex());
});
