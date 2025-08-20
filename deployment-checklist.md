# Checklist de déploiement - Corrections form.watch

## Tests à effectuer AVANT déploiement sur Render :

### ✅ Formulaires de vente
- [ ] Ouverture du formulaire de vente
- [ ] Sélection d'une méthode de paiement
- [ ] Soumission réussie d'une vente
- [ ] Affichage correct dans la liste

### ✅ Formulaires de dépense  
- [ ] Ouverture du formulaire de dépense
- [ ] Sélection d'une catégorie de dépense
- [ ] Modification d'une dépense existante
- [ ] Soumission réussie

### ✅ Gestion des utilisateurs
- [ ] Création d'un nouvel utilisateur
- [ ] Sélection du rôle utilisateur
- [ ] Modification des permissions
- [ ] Switch permissions personnalisées

### ✅ Gestion des produits
- [ ] Création d'un nouveau produit
- [ ] Sélection de catégorie produit
- [ ] Toggle switch "Disponible"
- [ ] Upload d'image (si applicable)

### ✅ Tests généraux
- [ ] Aucune erreur dans la console navigateur
- [ ] Navigation fluide entre les pages
- [ ] Pas d'écrans blancs lors des interactions
- [ ] Performance acceptable

### ✅ Build de production
- [ ] `npm run build` sans erreurs
- [ ] Taille du bundle raisonnable
- [ ] Preview fonctionne correctement

## Si tous les tests passent ✅
➡️ **Procédez au déploiement sur Render**

## Si des tests échouent ❌
➡️ **Corrigez avant de déployer**
