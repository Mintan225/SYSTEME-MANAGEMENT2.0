# Guide de Dépannage RestoManager

Ce guide vous aidera à résoudre les problèmes courants rencontrés dans l'application RestoManager.

## Problèmes Corrigés

Les corrections suivantes ont été apportées à votre application :

1. ✅ **Ajout de l'endpoint `/api/menu/:tableNumber`** - Permet l'accès au menu via QR code
2. ✅ **Vérification des tables** - S'assure que les QR codes pointent vers des tables existantes
3. ✅ **Correction des erreurs DOM React** - Résolution des erreurs `removeChild`
4. ✅ **Amélioration de la validation des données** - Prévient les erreurs 400 Bad Request

## Problème 1: Erreurs 400 Bad Request pour `/api/expenses` et `/api/tables`

### Symptômes
- Erreur 400 (Bad Request) lors de la création de dépenses
- Erreur 400 (Bad Request) lors de la création de tables
- Message d'erreur comme "Données de table invalides" ou "Validation failed"

### Solution
1. Assurez-vous que les champs numériques sont des nombres valides
2. Pour les tables, utilisez des entiers pour `number` et `capacity`
3. Pour les dépenses, assurez-vous que `amount` est un nombre valide
4. Utilisez notre script de test pour créer des tables : `node seed-tables.cjs`

## Problème 2: "Cette table n'existe pas" lors du scan de QR code

### Symptômes
- Le scan d'un QR code affiche "Cette table n'existe pas ou n'est pas disponible"
- Impossible d'accéder au menu client via QR code

### Solution
1. Vérifiez que la table existe dans la base de données
2. Vérifiez que le QR code pointe vers l'URL correcte avec le bon numéro de table
3. Utilisez notre script pour créer des tables de test avec des QR codes valides

```bash
node seed-tables.cjs
```

4. Testez un QR code en accédant directement à l'URL : `https://systeme-management2-0.onrender.com/menu/1`

## Problème 3: Erreurs DOM React "Failed to execute 'removeChild'"

### Symptômes
- Erreurs dans la console du navigateur concernant "Failed to execute 'removeChild' on 'Node'"
- Éléments d'interface utilisateur disparaissant ou se comportant de manière étrange

### Solution
1. Nous avons fourni un module `fix-react-dom.ts` contenant des hooks React sécurisés
2. Ces hooks gèrent correctement le démontage des composants et les mises à jour d'état
3. Pour éviter ces erreurs à l'avenir, utilisez:
   - `useSafeState` au lieu de `useState`
   - `useAbortController` pour les requêtes fetch
   - `SafeRender` pour les composants avec rendu conditionnel complexe

## Comment utiliser les scripts de correction

### Script de réparation principal
```bash
node fix-issues.cjs
```

### Script de création de tables de test
```bash
node seed-tables.cjs
```

### Redémarrer l'application
```bash
npm run dev
```

## Conseils pour le développement futur

1. **Validation des données**: Utilisez toujours Zod pour valider les données avant de les envoyer à l'API
2. **Gestion d'état React**: Évitez de mettre à jour l'état de composants démontés
3. **Requêtes API**: Utilisez des AbortController pour annuler les requêtes fetch lors du démontage
4. **Tests**: Testez les fonctionnalités principales après chaque modification

## Contenu supplémentaire

### Routes API essentielles

- `/api/menu/:tableNumber` - Obtenir le menu pour une table spécifique
- `/api/tables` - Gérer les tables du restaurant
- `/api/products` - Gérer les produits du menu
- `/api/categories` - Gérer les catégories de produits
- `/api/orders` - Gérer les commandes
- `/api/expenses` - Gérer les dépenses

### Modèles de données (Schémas)

- **Table**: `{ number: number, capacity: number, qrCode: string, status: string }`
- **Expense**: `{ description: string, amount: number, category: string }`
- **Product**: `{ name: string, description: string, price: number, categoryId: number }`

## Besoin d'aide supplémentaire?

Si vous rencontrez d'autres problèmes, consultez:
- La documentation dans le dossier `docs/`
- Le fichier `DEBUG_GUIDE.md` pour plus d'instructions de débogage
- Les fichiers de correction dans le répertoire principal
