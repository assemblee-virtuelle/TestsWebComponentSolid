const postal = require('postal');
const PlanetHandler = require('./planetHandler');
const AccountManager = require('./accountManager');

/*
** Initialise postal dans les classes des webcomponent
*/
window.postal = postal;

const solidPort = 8443;
const defaultUri = 'https://localhost:8000';
const solidUri = `https://localhost:${solidPort}/`;
let webid = "";
let registerEndpoint = "api/accounts/new";
const configUri = "https://assemblee-virtuelle.github.io/TestsWebComponentSolid/config.json";

document.addEventListener('DOMContentLoaded', () => {

    let accOptions = {};
    //Create an instance of the AccountManager with given options
    const accountManager = new AccountManager(accOptions);
    let options = {
        account: accountManager,
        postal:postal,
        planetListName: 'PlanetList',
        planetFileName: 'Planet'
    }
    //Creates the planet handler
    const PH = new PlanetHandler(options);

    fetch(configUri, {method:'GET'})
    .then(res => res.json())
    .then(data => {
        console.log('data :', data);
        initAccount(data);
    })

    function initAccount(data){
        serverChoice = document.querySelector('server-choice');
        serverChoice.initServerChoice(data);

        //Check if the user is connected or not
        accountManager.checkConnect(accountUri => {
            if (accountUri && accountUri != ""){
                //If the user is connected and has an account uri, reload the path and load the planet list
                PH.listPath(accountUri);
                webid = accountManager.webid;
                loadList();
                publishLoggedStatus(true);
            } else {
                PH.listPath(defaultUri);
                publishLoggedStatus(false);
            }
        });
    }

    //Get the webcomponents in order to call setPostal() method
    connectInterface = document.querySelector('connect-interface');
    planetInterface = document.querySelector('planet-interface');

    //#region Postal Channels Configuration
        connectInterface.setPostal(postal);
        planetInterface.setPostal(postal);

        //Login to server
        postal.subscribe({
            channel: 'auth',
            topic: 'login',
            callback: (data) => {
                if (data == "solidOne"){
                    accountManager.providerUri = "https://localhost:8443/";
                } else {
                    accountManager.providerUri = "https://localhost:8444/";
                }
                accountManager.login();
            }
        });

        //Logout from server
        postal.subscribe({
            channel:'auth',
            topic:'logout',
            callback: () => {
                accountManager.logout();
                connectInterface.triggerConnect();
            }
        });

        //Load permission webcomponent by changing uri
        postal.subscribe({
            channel:'permissions',
            topic:'urichange',
            callback: (uri => {
                PH.fetchPermissions(uri)
                .then(parsed => {
                    if (parsed){
                        postal.publish({
                            channel:'permissions',
                            topic:'sendPermissionList',
                            data:parsed
                        });
                    } else {
                        console.log("No specific acl file for this resource");
                    }
                })
                .catch(err => console.error("Error fetching permissions :", err));
            })
        })

        //Delete Permission
        postal.subscribe({
            channel:'permissions',
            topic:'deletePerm',
            callback: ((data, enveloppe) => {
                let webid = data.webid;
                let uri = data.uri;
                PH.deletePerm(webid, uri)
                .then(() => PH.fetchPermissions(uri))
                .then(parsed => {
                    if(parsed){
                        postal.publish({
                            channel:'permissions',
                            topic:'sendPermissionList',
                            data:parsed
                        });
                    }
                })
                .catch(err => console.error('Error deleting permission :', err))
            })
        });

        //Add a new permission
        postal.subscribe({
            channel:'permissions',
            topic:'addNewPerm',
            callback:(data => {//TODO: make on success call to clear form
                let permissions = data.permissions;
                console.log('permissions :', permissions);
                let uri = data.uri;
                PH.addNewPerm(permissions, uri)
                .catch(err => {
                    console.log(err)
                })
                .then(() => PH.fetchPermissions(uri))
                .then(parsed => {
                    if (parsed){
                        postal.publish({
                            channel:'permissions',
                            topic:'sendPermissionList',
                            data:parsed
                        });
                    }
                })
                .catch(err => console.error(err))
            })
        })

        postal.subscribe({
            channel:'permissions',
            topic:'editPerm',
            callback:(data => {
                let permissions = data.permissions;
                let uri = data.uri;
                console.log('permissions :', permissions);
                console.log('uri :', uri);
                PH.editPerm(permissions, uri)
                .catch(err => {
                    console.log('err :', err);
                })
                .then(() => PH.fetchPermissions(uri))
                .then(parsed => {
                    if (parsed){
                        postal.publish({
                            channel:'permissions',
                            topic:'sendPermissionList',
                            data:parsed
                        });
                    }
                })
            })
        })

        //Add switch to planet form to add a new planet
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

        //Confirm planet edition
        postal.subscribe({
            channel:'planet',
            topic:'editConfirm',
            callback: (data, enveloppe) => {
                PH.editPlanet(data['form'], data['uri'])
                .then(res => {
                    loadList();
                    switchToList();
                })
                .catch(err => console.error('Error editing :', err))
            }
        });

        //Delete a planet
        postal.subscribe({
            channel:'planet',
            topic:'delete',
            callback: (data, enveloppe) => {
                PH.deletePlanet(data).then(res => {
                    loadList();
                    switchToList();
                })
                .catch(err => console.error("Error deleting planet :", err));
            }
        });

        //Add a new planet
        postal.subscribe({
            channel:'planet',
            topic:'addNewConfirm',
            callback: (planetInfo, enveloppe) => {
                PH.addNewPlanet(planetInfo)
                .then(res => {
                    loadList();
                    switchToList();
                })
                .catch(err => console.log('err adding new planet:', err))
            }
        });

        //Return to planet list
        postal.subscribe({
            channel:'planet',
            topic:'formCancel',
            callback: (data, enveloppe) => {
                loadList();
                switchToList();
            }
        })

        //Change list uri
        postal.subscribe({
            channel:'interface',
            topic:'changeList',
            callback: (uri => {
                PH.listPath(uri);
                loadList();
            })
        })

    //#endregion

    //Show login to solid or webid
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

    //Function switching to planet list
    function switchToList(){
        postal.publish({
            channel:'planetInterface',
            topic:'switchToList',
            data: null
        });
    }

    //Load planet list and generates it directly from webcomponent, not postal
    function loadList(){
        PH.loadPlanetList().then(list => {
            planetInterface.generateList(list);
        })
    }

});

