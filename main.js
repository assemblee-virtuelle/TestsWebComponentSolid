const postal = require('postal');
const PlanetHandler = require('./planetHandler');
const AccountManager = require('./accountManager');


/*
** Initialise postal dans les classes des webcomponent
*/

var connect;

var fetch = window.fetch;
window.postal = postal;

const solidUri = "https://localhost:8443/";
let webid = "";
let registerEndpoint = "api/accounts/new";

document.addEventListener('DOMContentLoaded', () => {

    let accOptions = {
        uri: solidUri,
        registerEndpoint: registerEndpoint
    };
    var accountManager = new AccountManager(accOptions);

    let options = {
        account: accountManager,
        postal:postal,
        planetDir: 'planets',
        planetListName: 'PlanetList.ttl'
    }
    var PH = new PlanetHandler(options);

    accountManager.checkConnect()
    .then(val => {
        if(val){
            webid = accountManager.authWebid;
            if (webid && webid != ""){
                PH.reloadListPath();
                publishLoggedStatus(true);
            }
        } else {
            webid = null;
            PH.reloadListPath();
            publishLoggedStatus(false);
        }
    });


    
    connect = document.querySelector('connect-interface');
    planet = document.querySelector('planet-list');

    //#region Postal Channels Configuration
    connect.setPostal(postal);
    planet.setPostal(postal);

    let register = postal.subscribe({
        channel:'auth',
        topic:'register',
        callback: accountManager.register.bind(accountManager)
    });
    let login = postal.subscribe({
        channel: 'auth',
        topic: 'login',
        callback: accountManager.login.bind(accountManager)
    });
    let loadForm = postal.subscribe({
        channel:'LoaderManager',
        topic:'load-form',
        callback: (data, enveloppe) => {
            PH.loadPlanetForm(data)
        }
    });
    let loadList = postal.subscribe({
        channel:'LoaderManager',
        topic:'load-list',
        callback: (data, enveloppe) => {
            PH.loadPlanetList(data)
        }
    });


    function publishLoggedStatus(islogged){
        postal.publish({
            channel:'auth',
            topic:'status',
            data:{
                connected: islogged, 
                webid:webid
            }
        });
    }
    //#endregion


});

