-- ============================================
-- DreamScape - Schema Initial
-- Plateforme de Journal et Cartographie des Rêves Lucides
-- ============================================

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  settings TEXT DEFAULT '{}' -- JSON: preferences utilisateur (rappels, thème, etc.)
);

-- Table principale des rêves
CREATE TABLE IF NOT EXISTS dreams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- récit complet du rêve
  dream_date DATE NOT NULL, -- date du rêve (peut différer de created_at)
  dream_type TEXT DEFAULT 'normal', -- normal, lucid, recurring, nightmare, hypnagogic, false_awakening
  lucidity_level INTEGER DEFAULT 0, -- 0-5 (0 = pas lucide, 5 = contrôle total)
  clarity INTEGER DEFAULT 3, -- 1-5 clarté du souvenir
  is_favorite INTEGER DEFAULT 0,
  sleep_quality INTEGER DEFAULT 0, -- 1-5
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Émotions associées aux rêves (avec intensité)
CREATE TABLE IF NOT EXISTS dream_emotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dream_id INTEGER NOT NULL,
  emotion TEXT NOT NULL, -- joy, fear, anxiety, wonder, sadness, anger, confusion, peace, excitement, love, nostalgia
  intensity INTEGER DEFAULT 3, -- 1-5
  FOREIGN KEY (dream_id) REFERENCES dreams(id) ON DELETE CASCADE
);

-- Tags/étiquettes personnalisés
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'custom', -- person, place, theme, symbol, custom
  color TEXT DEFAULT '#6366f1',
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name, category)
);

-- Association rêves-tags
CREATE TABLE IF NOT EXISTS dream_tags (
  dream_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (dream_id, tag_id),
  FOREIGN KEY (dream_id) REFERENCES dreams(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Connexions entre rêves (le cœur de la cartographie)
CREATE TABLE IF NOT EXISTS dream_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  dream_from_id INTEGER NOT NULL,
  dream_to_id INTEGER NOT NULL,
  connection_type TEXT DEFAULT 'related', -- sequel, related, shared_character, shared_place, shared_theme, continuation
  description TEXT, -- note optionnelle sur la connexion
  strength INTEGER DEFAULT 3, -- 1-5 force de la connexion
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (dream_from_id) REFERENCES dreams(id) ON DELETE CASCADE,
  FOREIGN KEY (dream_to_id) REFERENCES dreams(id) ON DELETE CASCADE,
  UNIQUE(dream_from_id, dream_to_id)
);

-- Séries de rêves (regroupement narratif)
CREATE TABLE IF NOT EXISTS dream_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8b5cf6',
  incubation_prompt TEXT, -- intention de rêve pour la série
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Membres d'une série (ordonnés)
CREATE TABLE IF NOT EXISTS series_dreams (
  series_id INTEGER NOT NULL,
  dream_id INTEGER NOT NULL,
  order_index INTEGER DEFAULT 0,
  PRIMARY KEY (series_id, dream_id),
  FOREIGN KEY (series_id) REFERENCES dream_series(id) ON DELETE CASCADE,
  FOREIGN KEY (dream_id) REFERENCES dreams(id) ON DELETE CASCADE
);

-- Intentions d'incubation (technique de suggestion pré-sommeil)
CREATE TABLE IF NOT EXISTS incubation_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  series_id INTEGER, -- optionnel, lié à une série
  intent_text TEXT NOT NULL, -- l'intention formulée
  target_date DATE NOT NULL, -- nuit ciblée
  result_dream_id INTEGER, -- rêve résultant (si succès)
  success_rating INTEGER DEFAULT 0, -- 0-5 succès de l'incubation
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (series_id) REFERENCES dream_series(id) ON DELETE SET NULL,
  FOREIGN KEY (result_dream_id) REFERENCES dreams(id) ON DELETE SET NULL
);

-- Contrôles de réalité (reality checks log)
CREATE TABLE IF NOT EXISTS reality_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  check_type TEXT DEFAULT 'general', -- hands, text, time, nose, gravity, light_switch
  was_dreaming INTEGER DEFAULT 0, -- 0 = reality, 1 = dans un rêve
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions utilisateur (tokens JWT)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_dreams_user_id ON dreams(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_date ON dreams(dream_date);
CREATE INDEX IF NOT EXISTS idx_dreams_type ON dreams(dream_type);
CREATE INDEX IF NOT EXISTS idx_dream_emotions_dream ON dream_emotions(dream_id);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_dream_tags_dream ON dream_tags(dream_id);
CREATE INDEX IF NOT EXISTS idx_dream_tags_tag ON dream_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_connections_user ON dream_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_from ON dream_connections(dream_from_id);
CREATE INDEX IF NOT EXISTS idx_connections_to ON dream_connections(dream_to_id);
CREATE INDEX IF NOT EXISTS idx_series_user ON dream_series(user_id);
CREATE INDEX IF NOT EXISTS idx_series_dreams_series ON series_dreams(series_id);
CREATE INDEX IF NOT EXISTS idx_incubation_user ON incubation_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_reality_checks_user ON reality_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
