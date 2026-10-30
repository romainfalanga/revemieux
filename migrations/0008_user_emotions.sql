-- Personal emotion catalogue; associations keep their readable names.
CREATE TABLE IF NOT EXISTS user_emotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 60),
  normalized_name TEXT NOT NULL,
  UNIQUE(user_id, name),
  UNIQUE(user_id, normalized_name)
);
