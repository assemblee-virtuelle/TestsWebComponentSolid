const postal = require('postal');
const PlanetHandler = require('./planetHandler');
const AccountManager = require('./accountManager');

/*
** Initialise postal dans les classes des webcomponent
*/
window.postal = postal;

const defaultUri = 'https://localhost:8000';
let webid = "";
const configUri = "https://assemblee-virtuelle.github.io/TestsWebComponentSolid/server_list.json";

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

    //Fetch the json from distant
    fetch(configUri, {method:'GET'})
    .then(res => res.json())
    .then(data => {
        console.log('data :', data);
        initAccount(data);
    })

    //Get the webcomponents in order to call setPostal() method
    connectInterface = document.querySelector('connect-interface');
    planetInterface = document.querySelector('planet-interface');

    //initialise the server choice
    function initAccount(data){
        serverChoice = document.querySelector('server-choice');
        serverChoice.setPostal(postal);
        serverChoice.initServerChoice(data);
        //Check if the user is connected or not
        accountManager.checkConnect(accountUri => {
            if (accountUri && accountUri != ""){
                let listOfList = null;
                //If the user is connected and has an account uri, reload the path and load the planet list
                for(let i = 0; i < data.length; i++){
                    if (data[i].uri == accountManager.providerUri || data[i].uri + '/' == accountManager.providerUri){
                        listOfList = data[i].planetList;
                    }
                }
                postal.publish({
                    channel:'interface',
                    topic:'sendListofList',
                    data:{list:listOfList, default:accountUri}
                });
                PH.listPath(accountUri);
                webid = accountManager.webid;
                loadList();
                publishLoggedStatus(true);
            } else {
                PH.listPath(defaultUri);
                publishLoggedStatus(false);
            }
        });

        postal.subscribe({
            channel:'server',
            topic:'choice',
            callback:(server)=>{
                accountManager.providerUri = server;
                accountManager.logout();
                accountManager.login();
            }
        })
    }


    //Show login to solid or webid
    function publishLoggedStatus(islogged){

        if (islogged){
            connectInterface.style.display = 'block';
            planetInterface.style.display = 'block';
            serverChoice.style.display = 'none';
        } else {
            connectInterface.style.display = 'none';
            planetInterface.style.display = 'none';
            serverChoice.style.display = 'block';
        }
        postal.publish({
            channel:'auth',
            topic:'status',
            data:{
                connected: islogged, 
                webid:webid
            }
        });
    }

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

