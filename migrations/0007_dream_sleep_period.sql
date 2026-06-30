-- Ajoute la distinction Nuit / Sieste pour chaque rêve
-- 'night' = nuit (deux dates : soir + matin, comportement historique par défaut)
-- 'nap'   = sieste (une seule date : le jour de la sieste)
ALTER TABLE dreams ADD COLUMN sleep_period TEXT DEFAULT 'night';
