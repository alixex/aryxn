export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    owner_address TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES folders(id)
  )`,
  `CREATE TABLE IF NOT EXISTS file_indexes (
    id TEXT PRIMARY KEY,
    tx_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    folder_id TEXT,
    description TEXT,
    owner_address TEXT NOT NULL,
    storage_type TEXT NOT NULL,
    encryption_algo TEXT NOT NULL,
    encryption_params TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    previous_tx_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (folder_id) REFERENCES folders(id)
  )`,
  `CREATE TABLE IF NOT EXISTS file_tags (
    file_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (file_id, tag),
    FOREIGN KEY (file_id) REFERENCES file_indexes(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS index_manifests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_id TEXT UNIQUE NOT NULL,
    owner_address TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    alias TEXT NOT NULL,
    chain TEXT NOT NULL,
    vault_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(address, vault_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vault_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
]

export const INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_address)",
  "CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id)",
  "CREATE INDEX IF NOT EXISTS idx_file_owner ON file_indexes(owner_address)",
  "CREATE INDEX IF NOT EXISTS idx_file_folder ON file_indexes(folder_id)",
  "CREATE INDEX IF NOT EXISTS idx_file_hash ON file_indexes(file_hash)",
  "CREATE INDEX IF NOT EXISTS idx_file_created ON file_indexes(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_file_name ON file_indexes(file_name)",
  "CREATE INDEX IF NOT EXISTS idx_tags_file ON file_tags(file_id)",
  "CREATE INDEX IF NOT EXISTS idx_tags_tag ON file_tags(tag)",
  "CREATE INDEX IF NOT EXISTS idx_manifest_owner ON index_manifests(owner_address)",
  "CREATE INDEX IF NOT EXISTS idx_manifest_created ON index_manifests(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_wallets_vault ON wallets(vault_id)",
  "CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address)",
  "CREATE INDEX IF NOT EXISTS idx_wallets_chain ON wallets(chain)",
]

export const FTS_SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS file_indexes_fts USING fts5(
    id UNINDEXED,
    file_name,
    description,
    content='file_indexes',
    content_rowid='rowid'
  )
`
