# Configuration des Variables d'Environnement sur Render

## Variables d'environnement manquantes détectées

D'après le diagnostic, les variables suivantes manquent dans votre déploiement Render :
- `JWT_SECRET` (actuellement `false`)
- `SESSION_SECRET` (actuellement `false`)

## Comment configurer sur Render

### 1. Accédez à votre dashboard Render
- Allez sur [render.com](https://render.com)
- Connectez-vous à votre compte
- Sélectionnez votre service `systeme-management2-0`

### 2. Configurez les variables d'environnement
Dans la section "Environment", ajoutez les variables suivantes :

```
JWT_SECRET=votre-secret-jwt-super-securise-ici-au-moins-32-caracteres
SESSION_SECRET=votre-secret-session-super-securise-ici-au-moins-32-caracteres
```

### 3. Générer des secrets sécurisés

Vous pouvez générer des secrets sécurisés avec cette commande :

**Option 1: Utiliser Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2: Utiliser OpenSSL (si disponible)**
```bash
openssl rand -hex 32
```

**Option 3: Secrets suggérés temporaires (CHANGEZ-LES EN PRODUCTION !)**
```
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
SESSION_SECRET=z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1
```

### 4. Redéployer l'application
Après avoir ajouté les variables d'environnement :
1. Cliquez sur "Deploy latest commit" ou attendez le redéploiement automatique
2. Surveillez les logs pour vérifier que l'application démarre correctement

### 5. Vérifier la configuration
Après le redéploiement, testez l'endpoint diagnostic :
```bash
curl https://systeme-management2-0.onrender.com/api/diagnostic
```

Les variables `JWT_SECRET` et `SESSION_SECRET` devraient maintenant afficher `true`.

## Variables d'environnement complètes recommandées

Voici toutes les variables d'environnement que votre application peut utiliser :

```
# Base de données (déjà configurée automatiquement par Render)
DATABASE_URL=postgresql://user:password@host:port/database

# Sécurité (OBLIGATOIRE - ajoutez ces variables)
JWT_SECRET=votre-secret-jwt-super-securise
SESSION_SECRET=votre-secret-session-super-securise

# Environnement
NODE_ENV=production

# Super Admin (optionnel, utilise JWT_SECRET par défaut)
SUPER_ADMIN_JWT_SECRET=votre-secret-super-admin
```

## Résolution des erreurs 400 Bad Request

Une fois les variables d'environnement configurées, les erreurs 400 suivantes devraient être résolues :
- `/api/expenses` - Problèmes d'authentification JWT
- `/api/orders/13` - Problèmes d'authentification JWT  
- `/api/tables` - Problèmes d'authentification JWT

## Test de l'authentification

Vous pouvez tester l'authentification en :
1. Vous connectant à l'application via l'interface web
2. Utilisant l'endpoint diagnostic d'authentification avec des identifiants valides

## Support

Si vous continuez à avoir des problèmes après avoir configuré les variables d'environnement :
1. Vérifiez les logs de Render pour les erreurs spécifiques
2. Testez l'endpoint diagnostic pour confirmer la configuration
3. Vérifiez que l'application peut se connecter à la base de données
