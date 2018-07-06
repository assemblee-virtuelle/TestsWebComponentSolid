const extend = require('extend');
const OIDC = require('@trust/oidc-web');

class AccountManager{
    constructor(args = {}){
        extend(this, args);

        if (!this.uri || this.uri == ""){
            throw new Error("Account Uri not set");
        }

        var OIDCWebClient = OIDC.OIDCWebClient;
        var options = { solid: true };
        this.auth = new OIDCWebClient(options);

        this.fetch = null;
        this.webid = null;
    }

    checkConnect(){
        return new Promise((resolve, reject) => {
            this.auth.currentSession()
            .then(session => {
                console.log('session: ', session);
                if (!session.hasCredentials()){
                    this.fetch = window.fetch;
                    this.uri = solidUri;
                    this.webid = null;
                } else{
                    let regexp = /(.*)(profile.*)/g;
                    this.webid = session.idClaims.sub;
                    let match = regexp.exec(this.webid);
                    if(match[1] != null && match[1] != undefined){
                        this.fetch = session.fetch;
                        this.uri = match[1];
                        resolve(true);
                    }
                }
                resolve(false)
            });
        });
    }

    register(){
        if (!this.registerUri){
            throw new Error("Register Endpoint not set");
        }
        this.fetch(this.uri + this.registerUri, {
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

    login(){
        this.auth.currentSession()
        .then(session => {
            if (!session.hasCredentials()) {
                this.auth.login(this.uri);
            } else {
                console.log('Already connected');
            } 
        });
    }

    logout(){
        //in fixing progress
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