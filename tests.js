var uri = "https://localhost:8443/" //Adresse par defaut, 
//necessite de lancer le solid-test et non solid serveur pour pouvoir 
//utiliser le ldp avec des certificats self-signed, sinon ca met des erreurs.
//solid-test unsets the NODE_TLS_REJECT_UNAUTHORIZED flag and sets the rejectUnauthorized option. (CC https://github.com/solid/node-solid-server)

document.getElementById("container").addEventListener('submit', insertContainer);
document.getElementById("insert").addEventListener('submit', insertData);
document.getElementById("delete").addEventListener('submit', deleteData);
document.getElementById("sparql").addEventListener('submit', querySpData);
document.getElementById("get_test").addEventListener('click', test);


function test(){
    var tmp = "https://localhost:8443/";
    let responseBloc = document.getElementById('response');
    
    fetch(tmp, {
        method:'GET',
        headers:{'Content-type':'application/json'},
    })
    .then((res) => res.text())
    .then((data) => {
        responseBloc.innerHTML = data;//Affichage dans un gros bloc en format RDF
    })

}

//CREE UN CONTAINER A LA RACINE AVEC LE NOM QUE TU VEUX
function insertContainer(e){
    e.preventDefault();
    let resource = document.querySelector('input[name="container_insert"]');
    let name = resource.value;
    console.log("container = " + name);

    fetch(uri, {
        method:'POST', //POST CREE UNE RESSOURCE
        headers:{
            'Content-type':'text/turtle', 
            'Link':'<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',//#BasicContainer pour un container, #Resource pour une ressource
            'Slug':name //Nom de la ressource
        },
        body:'<> <http://purl.org/dc/terms/title> "Basic container"' //CECI SERA ECRIT DANS UN FICHIER .meta A L'INTERIEUR DU DOSSIER (container)
    }).then((res) => res)
    .then((data) => console.log(data))
    .catch((err) => console.log("error " + err))

    loadLdp(uri); //Fait une requete GET et affiche le resultat

}

//CREE UNE RESSOURCE ET DEFINIT SON CONTENU
function insertData(e){
    e.preventDefault();
    let name = document.querySelector('input[name="ressource_insert"]').value;
    let resource = document.querySelector('input[name="ressource_text"]').value
    console.log("insert = " + name);

    fetch(uri, {
        method:'POST',
        headers:{
            'Content-type':'text/turtle',
            'Link':'<http://www.w3.org/ns/ldp#Resource>; rel="type"',
            'Slug':name
        },
        body:resource,
    }).then((res) => res)
    .then((data) => console.log("Resource created"))
    .catch((err) => console.log("error " + err))

    loadLdp(uri + name);
}


//REQUETE DELETE POUR ENLEVER UN CONTAINER OU RESSOURCE
function deleteData(e){
    e.preventDefault();
    let resource = document.querySelector('input[name="ressource_delete"]').value;
    console.log("delete = " + uri + resource);

    //FAIRE UNE REQUETE HEAD AVANT POUR SAVOIR SI LA RESSOURCE EXISTE OU NON
    //Si la ressource existe head renverra un status 200
    //if (exists(uri + resource) === true){
        fetch(uri + resource, {
            method:'DELETE'
        })
        .then((res) => res)
        .then((data) => console.log("Deleted"))
        .catch((err) => console.log("error " + err))
    //}
}

//REQUETE PATCH AVEC SPARQL QUERY
function querySpData(e){
    e.preventDefault();
    let query = document.querySelector('input[name="sparql_query"]').value;
    let resource = document.querySelector('input[name="sparql_name"]').value;
    console.log("ressource = " + resource + "query = " + query);

    fetch(uri + resource, {
        method:'PATCH', //methode PATCH pour envoyer une requete SPARQL
        headers:{
            'Content-type':'application/sparql-update',
        },
        body:query, //Requete a envoyer ici
    }).then((res) => res)
    .then((data) => console.log("Requete reussie"))
    .catch((err) => console.log("error " + err))
}

function exists(ressourceUri){
    fetch(ressourceUri, {
        method:'HEAD'
    }).then((res) => res.status)
    .then((data) => {
        if (data == 200){
            console.log("Ouioui ")
            return true;
        } else {
            console.log("Ressource doesn't exists");
            return false;
        }
    })
    .catch((err) => {
        console.log(err)
        return false;
    })
}

//REQUETE GET AU SERVEUR SOLID
function loadLdp(customUri = uri){
    let responseBloc = document.getElementById('response');

    fetch(customUri, {
        method:'GET',
        headers:{'Content-type':'application/ld+json'},
    })
    .then((res) => res.text())
    .then((data) => {
        responseBloc.innerHTML = data;//Affichage dans un gros bloc en format RDF
    })

}

//TEST WEBSOCKET
var socket = new WebSocket("wss://localhost:8443/");
socket.onopen = function() {
	this.send('sub https://localhost:8443/');
};
socket.onmessage = function(msg) {
	if (msg.data && msg.data.slice(0, 3) === 'pub') {
        console.log(msg)
	}
};