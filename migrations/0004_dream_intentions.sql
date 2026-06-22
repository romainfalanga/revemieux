-- Intentions de rêves : nouveaux rêves imaginés et suites de rêves existants
-- Type 'new_dream' = intention libre, 'dream_continuation' = suite rattachée à un rêve
CREATE TABLE IF NOT EXISTS dream_intentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'new_dream', -- 'new_dream' ou 'dream_continuation'
  source_dream_id INTEGER, -- rêve source (obligatoire pour dream_continuation, null pour new_dream)
  title TEXT NOT NULL,
  description TEXT, -- description détaillée de l'intention
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'realized', 'archived'
  realized_dream_id INTEGER, -- rêve qui a réalisé cette intention (quand status = realized)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_dream_id) REFERENCES dreams(id) ON DELETE SET NULL,
  FOREIGN KEY (realized_dream_id) REFERENCES dreams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_intentions_user ON dream_intentions(user_id);
CREATE INDEX IF NOT EXISTS idx_intentions_source ON dream_intentions(source_dream_id);
CREATE INDEX IF NOT EXISTS idx_intentions_realized ON dream_intentions(realized_dream_id);
CREATE INDEX IF NOT EXISTS idx_intentions_status ON dream_intentions(status);
