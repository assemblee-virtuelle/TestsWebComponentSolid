const postal = require('postal');
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;
const $rdf = require('rdflib');

var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")
var RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#")
var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/")

/*
** Initialise postal dans les classes des webcomponent
*/
let card = document.querySelector('card-creator');
let reader = document.querySelector('resource-reader');
let sparql = document.querySelector('sparql-request');
let connect = document.querySelector('connect-interface');
let aclEditor = document.querySelector('acl-editor');
card.setPostal(postal);
reader.setPostal(postal);
sparql.setPostal(postal);
connect.setPostal(postal);
aclEditor.setPostal(postal);

/*
** L'uri du serveur solid sans authentification.
** Avec authentification elle se presente sous la forme https://username.localhost:8443/
*/
const solidUri = "https://localhost:8443/"
let uri = solidUri;
let webid = "";

/*
** Fonctions pour poster une ressource, lire une ressource (par requete normale ou SPARQL)
** et editer une ressource par requete SPARQL.
** Utilise fetch()
*/
let postCard = postal.subscribe({
    channel:'solid',
    topic:'post-card',
    callback: (data, enveloppe) => {
        let resource = proceedDataToJsonLdCard(data);
        if (resource != null){
            fetch(uri, {
                method: 'POST',
                headers:{
                    'Content-type':'text/turtle',
                    'Link':'<http://www.w3.org/ns/ldp#Resource>; rel="type"',
                    'Slug': 'card'
                },
                body: resource
            }).then(res => {
                return res.headers.get('Location');
            })
            .then(path => {
                if (path){
                    postal.publish({
                        channel:'solid',
                        topic:'done-card',
                        data:path
                    });
                    postCard.unsubscribe();
                }
            })
            .catch(err => {
                console.log('err :', err);
            })
        }
    }
});

function proceedDataToJsonLdCard(data){
    let keys = Object.keys(data);
    let resource = null;
    let writer = N3.Writer({ prefixes: { 
        foaf: 'http://xmlns.com/foaf/0.1/',
        rdf:'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
    }});
    writer.addQuad(
        namedNode(webid),
        namedNode('rdf:Type'),
        namedNode('foaf:PersonalProfileDocument')
    );
    writer.addQuad(
        namedNode(webid),
        namedNode('foaf:primaryTopic'),
        namedNode('#me')
    );
    writer.addQuad(
        namedNode('#me'),
        namedNode('rdf:Type'),
        namedNode('foaf:Person')
    );

    if (keys.length !== 0){
        let count = 0;
        for (let key in data){
            if (data.hasOwnProperty(key) && data[key] != "") {
                writer.addQuad(
                    namedNode('#me'),
                    namedNode('foaf:'+key),
                    literal(data[key])
                );
                count++;
            }
        }
        if (count != 0){
            writer.end((error, result) => {
                if (error == null)
                    resource = result;
                else 
                    console.log("writer err, ", error);
            });
            return resource;
        }
        console.log('resource :', resource);
    }
    return null;
}

let getResource = postal.subscribe({
    channel:'solid',
    topic:'get-resource',
    callback:(data, enveloppe) =>{
        let select = "";
        if (data.name || !data.name){
            if (data.query)
                select = "?query=" + encodeURI(data.query);
            console.log('select :', uri + data.name + select);
            fetch(uri + data.name + select, {
                method: 'GET',
                headers: {'Content-type':'text/turtle'},
            }).then(res => {
                if(res.status >= 400 && res.status < 600){
                    res.text().then(body => {
                        postal.publish({
                            channel:'solid',
                            topic:'err-resource',
                            data:body
                        });
                    })
                } else {
                    res.text().then(body => {
                        postal.publish({
                            channel:'solid',
                            topic:'done-resource',
                            data:body
                        });
                    })
                }
            })
            .catch(err => {
                postal.publish({
                    channel:'solid',
                    topic:'err-resource',
                    data:err
                });
            })
        }
    }
});

function UpdateByFormSparql(data){
    let req = "";
    let me = $rdf.sym(webid);
    let store = $rdf.graph();
    let deleteData = 'DELETE { \n ';
    let insertData = 'INSERT { \n ';
    let whereData = 'WHERE { \n ';
    let count = 0;
    
    for(let key in data){
        if(data.hasOwnProperty(key) && data[key] != ""){
            deleteData += `?s ${FOAF(key)} ?o${count} .\n`;
            insertData += `?s ${FOAF(key)} "${data[key]}" .\n`;
            whereData += `?s ${FOAF(key)} ?o${count} .\n`;
            count++;
        }
    }
    if (count == 0)
        return null;
    deleteData += '}'
    insertData += '}';
    whereData += '}';
    req += deleteData + '\n';
    req += insertData + '\n';
    req += whereData;
    return req;
}

let sparqlUpdate = postal.subscribe({
    channel:'solid',
    topic:'patch-sparql',
    callback: (data, enveloppe) => {
        let request = UpdateByFormSparql(data);
        console.log(request);
        
        
        if (request != null){
            fetch(uri + 'card.ttl', {
                method:'PATCH',
                headers:{'Content-type':'application/sparql-update'},
                body:request
            })
            .then(res => {
                if(res.status >= 400 && res.status < 600){
                    res.text().then(body => {
                        postal.publish({
                            channel:'solid',
                            topic:'err-sparql',
                            data:body
                        });
                    })
                } else {
                    res.text().then(body => {
                        postal.publish({
                            channel:'solid',
                            topic:'done-sparql',
                            data:body
                        });
                    })
                }
            })
            .catch(err => {
                postal.publish({
                    channel:'solid',
                    topic:'err-sparql',
                    data:err
                });
            })
        }
    }
});

/*
** Initialise l'OIDCWebClient et verifie a chaque chargement du dom si une session existe ou non
** si une session existe, remplace fetch par session.fetch, et l'uri par https://username.localhost:8443/
** sinon, remet l'uri normale et l'api fetch native
*/
var OIDCWebClient = OIDC.OIDCWebClient;
var options = { solid: true };
var auth = new OIDCWebClient(options);


var fetch;
var channel;
var logoutBlock = connect.shadowRoot.getElementById("logout");

document.addEventListener('DOMContentLoaded', () => {

    auth.currentSession()
    .then(session => {
        console.log('session: ', session);
        if (!session.hasCredentials()){
            fetch = window.fetch;
            uri = solidUri;
            if (channel != undefined){
                channel.unsubscribe();
            }
            logoutBlock.style.display = "none";
        } else{
            let regexp = /(https:\/\/)(.*)(\.localhost.*)/g;
            webid = session.idClaims.sub;
            let match = regexp.exec(webid);
            if(match[2] != null && match[2] != undefined){
                fetch = session.fetch;
                uri = `https://${match[2]}.localhost:8443/`;
                channel = setLogoutChannel();
                logoutBlock.style.display = "block";            
            }
        }
    })
});

/*
** Fonctions de register et login, utilise l'endpoint solidserver/api/accounts/new pour creer un compte
** et OIDCWebClient.login() pour le login
*/
let tmpUrl = uri;
let registerEndpoint = 'api/accounts/new';
let register = postal.subscribe({
    channel:'auth',
    topic:'register',
    callback: (data, enveloppe) => {

        fetch(solidUri + registerEndpoint, {
            method:'POST',
            headers:{
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body:`username=${data.username}&password=${data.password}&name=${data.name}&email=${data.email}`
        })
        .then(res => {
            return res.url
        })
        .then(resUrl => {
            tmpUrl = resUrl;
            console.log('resUrl :', resUrl);
        })
        .catch(err => console.log('err :', err));
    }
});

let login = postal.subscribe({
    channel: 'auth',
    topic: 'login',
    callback:(data, enveloppe) => {
        auth.currentSession()
        .then(session => {
          console.log('auth.currentSession():', session);
          if (!session.hasCredentials()) {
            console.log('Empty session, redirecting to login');
            auth.login(solidUri);
          } else {
            console.log('Already connected');
          } 
        });
    }
});

function logout(){
    auth.logout();

    auth.currentSession()
    .then(session => {
        if (channel != undefined){
            channel.unsubscribe();
        }
        fetch = window.fetch;
        uri = solidUri; 
        logoutBlock.style.display = "none";
        console.log('sessionclosed: ', session);
    })
}

function setLogoutChannel(){
    let ret;

    ret = postal.subscribe({
        channel:'auth',
        topic:'logout',
        callback:logout
    })
    return ret;
}


/*
** Fonctions de manipulation d'ACL
*/

let exists = postal.subscribe({
    channel:'wac',
    topic:'modif-acl',
    callback: (data, enveloppe) => {
        let ret = [];
        ret["status"] == "error";
        fetch(uri + data.name, {
            method:'HEAD',
        })
        .then(res => {
            if(res.status == 200){
                return res.headers.get('Link');
            }
        })
        .then(link => {
            if(link != undefined){
                let reg = /(.*<)(.*\.acl)(.*)/g;
                console.log('acl : ', link);
                let match = reg.exec(link);
                if (match[2] != null && match[2] != undefined){
                    console.log(match[2]);
                }
            }
        })
        .catch(err =>{
            console.log('err :', err);
        })
    }
})