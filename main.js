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
                PH.loadPlanetList();
                publishLoggedStatus(true);
            }
        } else {
            webid = null;
            PH.reloadListPath();
            publishLoggedStatus(false);
        }
    });
    
    connect = document.querySelector('connect-interface');
    planetList = document.querySelector('planet-list');

    //#region Postal Channels Configuration
    connect.setPostal(postal);
    planetList.setPostal(postal);

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
    let logout = postal.subscribe({
        channel:'auth',
        topic:'logout',
        callback: accountManager.logout.bind(accountManager)
    });
    let loadForm = postal.subscribe({
        channel:'planet',
        topic:'addNew',
        callback: (data, enveloppe) => {
            PH.switchView('form')
        }
    });
    let editPlanet = postal.subscribe({
        channel:'planet',
        topic:'edit',
        callback: (data, enveloppe) => {
            PH.editPlanet(data)
        }
    });
    let deletePlanet = postal.subscribe({
        channel:'planet',
        topic:'delete',
        callback: (data, enveloppe) => {
            PH.deletePlanet(data).then(res => {
                PH.loadPlanetList();
            })
        }
    });
    let formConfirm = postal.subscribe({
        channel:'planet',
        topic:'formConfirm',
        callback: (data, enveloppe) => {
            PH.loadPlanetList(data)
        }
    });
    let loadList = postal.subscribe({
        channel:'planet',
        topic:'formCancel',
        callback: (data, enveloppe) => {
            PH.switchView('list')
        }
    })


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

