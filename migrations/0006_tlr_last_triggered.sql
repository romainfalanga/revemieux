-- Ajout colonne dedup pour éviter les triggers multiples dans la même journée
ALTER TABLE tlr_schedules ADD COLUMN last_triggered_at TEXT;
