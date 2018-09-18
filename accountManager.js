const extend = require('extend');
const OIDC = require('@trust/oidc-web');
const auth = require('solid-auth-client');
const { fetch } = auth;

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
                let regexp = /(.*)(profile.*)/g;
                this.fetch = auth.fetch;
                let match = regexp.exec(this.webid);
                if (match[1] != null && match[1] != undefined){
                    this.uri = match[1];
                    callback(match[1]);
                }
            }
        });
    }

    //Register function TODO: change this
    register(){
        if (!this.registerUri){
            throw new Error("Register Endpoint not set");
        }
        fetch(this.uri + this.registerUri, {
            method:'POST',
            headers:{
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body:`username=${data.username}&password=${data.password}`
        })
        .then(res => {
            return res.url
        })
        .then(resUrl => {
            console.log('resUrl :', resUrl);
        })
        .catch(err => console.log('register err :', err));
    }

    //Login function using solid-auth-client
    login(){
        async function loginToSolid(idp) {
            const session = await auth.currentSession();
            if (!session)
                await auth.popupLogin({popupUri: 'https://localhost:8000/popup'});
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