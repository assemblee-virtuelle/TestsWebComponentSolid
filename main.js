const postal = require('postal');
const PlanetHandler = require('./planetHandler');
const AccountManager = require('./accountManager');


/*
** Initialise postal dans les classes des webcomponent
*/
window.postal = postal;

const solidPort = 8443;
const solidUri = `https://localhost:${solidPort}/`;
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
        planetListName: 'PlanetList',
        planetFileName: 'Planet'
    }
    var PH = new PlanetHandler(options);

    accountManager.checkConnect().then(res => {
        webid = accountManager.authWebid;
        if (webid && webid != ""){
            PH.reloadListPath();
            loadList();
            publishLoggedStatus(true);
        }
    })
    .catch(err => {
        webid = null;
        PH.reloadListPath();
        publishLoggedStatus(false);
    })

    connectInterface = document.querySelector('connect-interface');
    planetInterface = document.querySelector('planet-interface');

    //#region Postal Channels Configuration
    connectInterface.setPostal(postal);
    planetInterface.setPostal(postal);

    let register = postal.subscribe({
        channel:'auth',
        topic:'register',
        callback: accountManager.register.bind(accountManager)
    });
    let login = postal.subscribe({
        channel: 'auth',
        topic: 'login',
        callback: (data) => {
            if (data == 1){
                accountManager.providerUri = "https://localhost:8443/";
            } else {
                accountManager.providerUri = "https://localhost:8444/";
            }
            accountManager.login();
        }
    });
    let logout = postal.subscribe({
        channel:'auth',
        topic:'logout',
        callback: () => {
            accountManager.logout();
            connectInterface.triggerConnect();
        }
    });
    postal.subscribe({
        channel:'planet',
        topic:'addNew',
        callback: (data, enveloppe) => {
            postal.publish({
                channel:'planetInterface',
                topic:'switchToForm',
                data: null
            });
        }
    });
    let editPlanet = postal.subscribe({
        channel:'planet',
        topic:'editConfirm',
        callback: (data, enveloppe) => {
            PH.editPlanet(data['form'], data['uri'])
            .then(res => {
                loadList();
                switchToList();
            })
            .catch(err => console.log('err editing :', err))
        }
    });
    let deletePlanet = postal.subscribe({
        channel:'planet',
        topic:'delete',
        callback: (data, enveloppe) => {
            PH.deletePlanet(data).then(res => {
                loadList();
                switchToList();
            })
        }
    });
    let addNewPlanet = postal.subscribe({
        channel:'planet',
        topic:'addNewConfirm',
        callback: (data, enveloppe) => {
            PH.addNewPlanet(data)
            .then(res => {
                loadList();
                switchToList();
            })
            .catch(err => console.log('err adding new planet:', err))
        }
    });

    function switchToList(){
        postal.publish({
            channel:'planetInterface',
            topic:'switchToList',
            data: null
        });
    }

    let cancelForm = postal.subscribe({
        channel:'planet',
        topic:'formCancel',
        callback: (data, enveloppe) => {
            switchToList();
        }
    })

    let loadListChannel = postal.subscribe({
        channel:'planet',
        topic: 'loadList',
        callback: (data, enveloppe) => {
            loadList();
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

    function loadList(){
        PH.loadPlanetList().then(list => {
            planetInterface.generateList(list);
        })
        
    }

});

