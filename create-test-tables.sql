
-- Script SQL pour créer des tables de test
-- Exécuter dans psql ou via l'interface d'administration de la base

INSERT INTO tables (number, capacity, qr_code, status) VALUES 
(1, 4, 'https://systeme-management2-0.onrender.com/menu/1', 'available'),
(2, 6, 'https://systeme-management2-0.onrender.com/menu/2', 'available'),
(3, 2, 'https://systeme-management2-0.onrender.com/menu/3', 'available'),
(4, 8, 'https://systeme-management2-0.onrender.com/menu/4', 'available'),
(5, 4, 'https://systeme-management2-0.onrender.com/menu/5', 'available')
ON CONFLICT (number) DO NOTHING;
