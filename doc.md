Documentation Api
===

Le node-solid-server est bâti sur le micro framework javascript `Express`. 
Le serveur propose une api pour intéragir avec le LDP selon la norme LDP. *

L'api du node-solid-server commence par l'attribution de handlers à certaines routes

Par exemple :

L'objet `router` est un objet du framework `Express` paramétrant les routes
```javascript
  router.copy('/*', allow('Write'), copy)
  router.get('/*', index, allow('Read'), header.addPermissions, get)
  router.post('/*', allow('Append'), post)
  router.patch('/*', allow('Append'), patch)
  router.put('/*', allow('Write'), put)
  router.delete('/*', allow('Write'), del)
```

La fonction `allow` est une fonction du node-solid-server. 
Cette fonction retourne une fonction `allowHandler` et fait du travail préliminaire de
gestion de la ressource ciblée. Elle vérifie si la ressource existe, cherche et obtient son ACL, 
et vérifie si l'utilisateur est autorisé a accèder a la ressource. TODO: a détailler

Le dernier argument de chaque méthode est une fonction `handler`. Les fonctions handler sont spécifique a chaque requête
et se trouvent dans leurs fichiers respectifs (le handler pour la requête HTTP `get` se trouve dans le fichier `/handlers/get.js`)

Dans le cas de la requête `GET`, on peut voir qu'il y a deux handler supplémentaires : `index` et `header.addPermisisons`.

Le handler `index` vérifie si le chemin possède un fichier index.html, et le handler `header.addPermissions` est un 
header décrivant les permissions de l'utilisateur 


