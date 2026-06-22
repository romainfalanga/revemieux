-- Ajout du champ "suite souhaitée" pour l'incubation par rêve
ALTER TABLE dreams ADD COLUMN wished_continuation TEXT DEFAULT NULL;
