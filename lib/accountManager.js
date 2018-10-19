const extend = require('extend');
const $rdf = require('rdflib');
const OIDC = require('@trust/oidc-web');
const auth = require('solid-auth-client');
const { fetch } = auth;

var SOLID = $rdf.Namespace('http://www.w3.org/ns/solid/terms#');
var PIM = $rdf.Namespace('http://www.w3.org/ns/pim/space#');
class AccountManager{
    constructor(args = {}){
        extend(this, args);

        if (!this.uri || this.uri == ""){
            throw new Error("Account Uri not set");
        }
        this.defaultUri = this.uri;
        this.webid = null;
    }

    //Check if the user is connected to the solid server
    checkConnect(callback){
        auth.trackSession(session => {
            if (!session){
                console.log("Not logged in");
                callback(null);
            } else {
                this.webid = session.webId;
                this.fetch = auth.fetch;
                this.getAccountAndStorage(this.webid, data => {
                    callback(data.account);
                });
            }
        });
    }

    getAccountAndStorage(webid, callback){
        this.fetch(webid, {
            method:'GET',
            headers: {'Content-type': 'text/turtle'}
        })
        .then(res => {
            if (res.headers.get('Content-Type') != 'text/turtle')
                return null;
            return res.text()
        })
        .then(card => {
            if (card == null){
                throw new Error("Card is unreachable");
            }
            let store = $rdf.graph();

            $rdf.parse(card, store, webid, 'text/turtle');
            let accountStatements = store.statementsMatching($rdf.sym(webid), SOLID('account'), undefined); //TODO: replacer par each()
            let storageStatements = store.statementsMatching($rdf.sym(webid), PIM('storage'), undefined);

            let ret = {};
            ret.account = accountStatements[0].object.value;
            this.uri = ret.account;
            ret.storage = storageStatements[0].object.value;
            callback(ret);
        })
    }

    //Login function using solid-auth-client
    login(){
        async function loginToSolid(idp) {
            const session = await auth.currentSession();
            if (!session)
                await auth.login(idp, {callbackUri:'https://localhost:8000'});
            else
                console.log('Logged in as ', session.webId);
        }
        loginToSolid(this.uri);
    }

    logout(){
        auth.logout();
        console.log("Logout");
    }

    //#region Getters and Setters
    set registerEndpoint(uri){
        this.registerUri = uri;
    }

    get registerEndpoint(){
        return this.registerUri;
    }

    set providerUri(uri){
        this.uri = uri;
    }

    get providerUri(){
        return this.uri;
    }

    get authWebid(){
        return this.webid;
    }

    set authWebid(webid){
        this.webid = webid;
    }
    //#endregion
}

module.exports = AccountManager;