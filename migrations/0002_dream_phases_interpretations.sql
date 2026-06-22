-- ============================================
-- Rêve Mieux - Migration 0002
-- Ajout des phases/étapes de rêve et interprétations
-- ============================================

-- Phases/étapes d'un rêve (scènes séquentielles)
CREATE TABLE IF NOT EXISTS dream_phases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dream_id INTEGER NOT NULL,
  order_index INTEGER DEFAULT 0,
  title TEXT, -- titre court de la phase (optionnel)
  content TEXT NOT NULL, -- description de ce qui se passe dans cette phase
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dream_id) REFERENCES dreams(id) ON DELETE CASCADE
);

-- Émotions par phase (distinctes des émotions globales du rêve)
CREATE TABLE IF NOT EXISTS phase_emotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phase_id INTEGER NOT NULL,
  emotion TEXT NOT NULL,
  intensity INTEGER DEFAULT 3,
  FOREIGN KEY (phase_id) REFERENCES dream_phases(id) ON DELETE CASCADE
);

-- Interprétations (peuvent être liées à un rêve entier ou à une phase spécifique)
CREATE TABLE IF NOT EXISTS dream_interpretations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dream_id INTEGER NOT NULL,
  phase_id INTEGER, -- NULL = interprétation globale du rêve, sinon liée à une phase
  content TEXT NOT NULL, -- le texte d'interprétation
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dream_id) REFERENCES dreams(id) ON DELETE CASCADE,
  FOREIGN KEY (phase_id) REFERENCES dream_phases(id) ON DELETE CASCADE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_dream_phases_dream ON dream_phases(dream_id);
CREATE INDEX IF NOT EXISTS idx_phase_emotions_phase ON phase_emotions(phase_id);
CREATE INDEX IF NOT EXISTS idx_interpretations_dream ON dream_interpretations(dream_id);
CREATE INDEX IF NOT EXISTS idx_interpretations_phase ON dream_interpretations(phase_id);
