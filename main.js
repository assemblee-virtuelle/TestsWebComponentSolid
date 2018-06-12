const postal = require('postal');
const CardHandler = require('./cardHandler');


/*
** Initialise postal dans les classes des webcomponent
*/

var card;
var select;
var sparql;
var connect;
var aclEditor;

var fetch = window.fetch;

var OIDCWebClient = OIDC.OIDCWebClient;
var options = { solid: true };
var auth = new OIDCWebClient(options);

const solidUri = "https://localhost:8444/"
let uri = solidUri;
let webid = "";

document.addEventListener('DOMContentLoaded', () => {

    let options = {
        fetch:fetch,
        postal:postal,
        uri:uri
    }

    var CH = new CardHandler(options);

    auth.currentSession()
    .then(session => {
        console.log('session: ', session);
        if (!session.hasCredentials()){
            fetch = window.fetch;
            uri = solidUri;
            CH.setCredentialsInfos(uri, fetch, null);
            publishLoggedStatus(false, null);
        } else{
            let regexp = /(.*)(profile.*)/g;
            webid = session.idClaims.sub;
            let match = regexp.exec(webid);
            console.log('webid :', webid);
            if(match[1] != null && match[1] != undefined){
                fetch = session.fetch;
                uri = match[1];
                CH.setCredentialsInfos(uri, fetch, webid);
                let hello = setHelloChannel(webid);
            }
        }
    });

    card = document.querySelector('card-creator');
    select = document.querySelector('select-request');
    sparql = document.querySelector('edit-card');
    connect = document.querySelector('connect-interface');
    aclEditor = document.querySelector('acl-editor');
    card.setPostal(postal);
    sparql.setPostal(postal);
    select.setPostal(postal);
    connect.setPostal(postal);
    aclEditor.setPostal(postal);

    CH.channelCardCreate();
    CH.channelCardEdit();


});

function setHelloChannel(webid){
    let ret;

    ret = postal.subscribe({
        channel:'auth',
        topic:'logout',
        callback:logout
    })
    publishLoggedStatus(true, webid);
    return ret;
}

function publishLoggedStatus(islogged, webid){
   postal.publish({
       channel:'auth',
       topic:'status',
       data:{
            connected: islogged, 
            webid:webid
        }
   }) 
}

function logout(){
    auth.logout();

    fetch(uri + 'logout', {method:'head'})
    .then(res => res.status)
    .then(res => console.log('res :', res))
    .catch(err => console.log('err :', err));
    fetch = window.fetch;
    uri = solidUri;
    publishLoggedStatus(false, null);
}

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

/*
** Fonctions de manipulation d'ACL
*/

