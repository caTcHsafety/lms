import { get, set, clear } from 'idb-keyval';

const OFFLINE_VAULT_KEY_PREFIX = 'offline_vault_';

export interface OfflineMetadata {
  id: string;
  title: string;
  type: string;
  savedAt: number;
}

export interface VaultEntry {
  blob: Blob;
  metadata: OfflineMetadata;
}

export async function saveToOfflineVault(id: string, blob: Blob, metadata: Omit<OfflineMetadata, 'savedAt' | 'id'>) {
  const entry: VaultEntry = {
    blob,
    metadata: {
      ...metadata,
      id,
      savedAt: Date.now(),
    },
  };
  await set(`${OFFLINE_VAULT_KEY_PREFIX}${id}`, entry);
}

export async function getOfflineVaultContents(): Promise<VaultEntry[]> {
  // idb-keyval doesn't have an easy way to get all values by prefix without looping through all keys
  // Let's use the underlying indexedDB connection or just store an index
  // For simplicity here, we'll store an index array under a known key
  const index = (await get<string[]>('offline_vault_index')) || [];
  const entries: VaultEntry[] = [];
  
  for (const id of index) {
    const entry = await get<VaultEntry>(`${OFFLINE_VAULT_KEY_PREFIX}${id}`);
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
}

export async function addToOfflineVaultIndex(id: string) {
  const index = (await get<string[]>('offline_vault_index')) || [];
  if (!index.includes(id)) {
    index.push(id);
    await set('offline_vault_index', index);
  }
}

// Kill switch
export async function clearOfflineVault() {
  await clear();
  console.log('Offline vault completely wiped due to session signout or expiration.');
}
