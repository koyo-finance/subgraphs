import { KoyoSnapshot } from '../../../generated/schema';
import { findOrRegisterKoyo } from '../koyo';

export function getOrRegisterKoyoSnapshot(vaultId: string, timestamp: i32): KoyoSnapshot {
	const dayID = timestamp / 86400;
	const id = `${vaultId}-${dayID.toString()}`;
	let snapshot = KoyoSnapshot.load(id);

	if (snapshot === null) {
		const dayStartTimestamp = dayID * 86400;
		const vault = findOrRegisterKoyo();
		snapshot = new KoyoSnapshot(id);

		snapshot.gaugeCount = vault.gaugeCount;
		snapshot.gaugeTypeCount = vault.gaugeTypeCount;

		snapshot.koyo = vaultId;
		snapshot.timestamp = dayStartTimestamp;

		snapshot.save();
	}

	return snapshot;
}
