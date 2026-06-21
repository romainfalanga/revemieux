-- Seed data pour Rêve Mieux
-- Mot de passe pour tous les comptes test: "dream123" (hashé avec SHA-256 + sel simple)
-- En production, utiliser bcrypt ou argon2

-- Utilisateur de démo
INSERT OR IGNORE INTO users (id, email, username, password_hash, display_name) VALUES 
  (1, 'demo@revemieux.app', 'dreamer', 'demo_hash_placeholder', 'Explorateur de Rêves');
