# 🚨 Guide de Débogage - Erreurs 500 RestoManager

## Résumé du Problème

Votre application RestoManager déployée sur Render rencontre des erreurs 500 sur plusieurs endpoints :
- `GET /api/orders/13` 
- `POST /api/tables`
- `POST /api/sales` 
- `POST /api/expenses`

## 🔍 Diagnostic Immédiat

### 1. Tester l'Endpoint de Diagnostic

Votre application maintenant inclut un endpoint de diagnostic. Testez-le :

```bash
curl https://systeme-management2-0.onrender.com/api/diagnostic
```

Cet endpoint vous donnera :
- État de la connexion à la base de données
- Nombre d'enregistrements dans chaque table
- Statut des variables d'environnement critiques

### 2. Tester l'Endpoint de Santé

```bash
curl https://systeme-management2-0.onrender.com/api/health
```

## 🛠️ Actions Correctives Possibles

### A. Problème de Variables d'Environnement

**Vérifiez dans le Dashboard Render :**
1. Allez dans votre service sur render.com
2. Onglet "Environment"
3. Assurez-vous que ces variables sont définies :

```env
DATABASE_URL=postgresql://...  # Auto-configuré par Render
JWT_SECRET=une-clé-secrete-forte
SESSION_SECRET=une-autre-clé-secrete
NODE_ENV=production
```

**Solution :**
- Générez de nouvelles clés secrètes :
```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# SESSION_SECRET  
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### B. Problème de Base de Données

**Symptômes :**
- L'endpoint `/api/diagnostic` montre `database.connected: false`
- Erreurs de connexion dans les logs

**Solutions :**
1. **Redémarrer la base de données** dans le Dashboard Render
2. **Vérifier la string de connexion** DATABASE_URL
3. **Migrations manquantes** - L'app exécute automatiquement les migrations au démarrage

### C. Problème d'Authentification

Les endpoints qui échouent nécessitent une authentification JWT.

**Test d'authentification :**
```bash
# 1. Login d'abord
curl -X POST https://systeme-management2-0.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# 2. Utiliser le token retourné
curl -X GET https://systeme-management2-0.onrender.com/api/tables \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

### D. Redéployer avec les Corrections

**Étapes :**
1. Commitez les changements localement
2. Poussez vers votre repository Git
3. Render redéploiera automatiquement

## 📋 Checklist de Vérification

- [ ] Endpoint `/api/health` fonctionne
- [ ] Endpoint `/api/diagnostic` montre `database.connected: true`
- [ ] Variables d'environnement définies
- [ ] Login avec admin/admin123 fonctionne
- [ ] Logs Render ne montrent pas d'erreurs critiques

## 📞 Support Render

Si le problème persiste, vérifiez :

1. **Logs en temps réel :** Dashboard Render → Votre service → Onglet "Logs"
2. **Métriques :** CPU, Mémoire, Requests
3. **Status de la DB :** Votre base de données PostgreSQL

## 🚀 Étapes Suivantes

1. **Testez l'endpoint diagnostic**
2. **Corrigez les variables d'environnement si nécessaire**
3. **Redéployez**
4. **Testez les endpoints défaillants**

---

**Note :** Les nouvelles routes de diagnostic ont été ajoutées à votre code. Après le redéploiement, elles seront disponibles pour vous aider à diagnostiquer les problèmes en production.
