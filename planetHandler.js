const extend = require('extend');
const $rdf = require('rdflib');
const utils = require('./utils');

var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var PLANET = $rdf.Namespace('http://example.org/planet#');
var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
var TURTLE = $rdf.Namespace('http://www.w3.org/ns/iana/media-types/text/turtle#');
var ACL = $rdf.Namespace('http://www.w3.org/ns/auth/acl#');
class PlanetHandler{
    constructor(args = {}){
        extend(this, args);

        if (!this.postal){
            throw new Error("Postal not set");
        }
        if (!this.account){
            throw new Error("Fetch not set");
        }
        if (!this.planetListName || !this.planetFileName){
            throw new Error("Missing planet list info");
        }

        this.pathToList = this.account.uri + this.planetListName + '/';
        this.store = $rdf.graph();
        this.planetCount = 0;
        this.planetList = {};
        this.planetFolderAcl = {};
    }

    //Load the planet List from distant turtle file and parses it into an array
    loadPlanetList(){
        return new Promise((resolve, reject) => {
            this.fetchPlanetList()
            .then(list => {
                this.planetList = {};
                let promisesArray = [];
                for(let i = 0; i < this.planetCount; i++){
                    promisesArray.push(this.fetchPlanet(list[i]));
                }
                Promise.all(promisesArray)
                .then(list => {
                    if (list){
                        for(let i = 0; i < list.length; i++){
                            if (list[i] && list[i] != undefined)
                                this.planetList[list[i].uri] = list[i];
                        }
                    }
                    this.planetFolderAcl = {};
                    resolve({list:this.planetList, listUri:this.pathToList, uri:this.account.uri});
                });
            })
            .catch(err => {
                reject(err);
            })
        })
    }

    /**
     * Check if the planet list is present, in planet folder. If not, creates it
     */
    hasPlanetList(){
        return new Promise((resolve, reject) => {
            this.account.fetch(this.pathToList, {
                method:'HEAD'
            })
            .then(res => {
                return res.status;
            })
            .then(status => {
                if (status == 200)
                    resolve("Exists");
                else{
                    reject();
                }
            })
            .catch(err => {
                reject(err);
            })
        })
    }

    createPlanetListAcl(){
        let triples = `INSERT {
        ${$rdf.sym(this.pathToList + "#Owner")} ${RDF('type')} ${ACL('Authorization')};
        ${ACL('agent')} ${$rdf.sym(this.account.webid)};
        ${ACL('accessTo')} ${$rdf.sym(this.pathToList)};
        ${ACL('default')} ${$rdf.sym(this.pathToList)};
        ${ACL('mode')} ${ACL('Read')}, ${ACL('Write')}, ${ACL('Control')}.}
        `;
        return new Promise((resolve, reject) => {
            this.account.fetch(this.pathToList + ".acl", {
                method: 'PATCH',
                headers:{'Content-type':'application/sparql-update'},
                body: triples
            }).then(resp => {
                if(resp.status === 200) {
                    resolve();
                }
            })
        })
    }

    //Creates the planet List
    createPlanetList(){
        return new Promise((resolve, reject) => {
            this.account.fetch(this.account.uri, {
                method: 'POST',
                headers: {
                    'Content-Type':'text/turtle',
                    'Slug':this.planetListName,
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"'
                }
            })
            .then(res => {
                return this.createPlanetListAcl()
            })
            .then(res => resolve())
            .catch(err => {
                console.log('err creation :', err);
                reject(err);
            })
        });
    }

    //decode data form to rdf triples in order to do a PUT
    decodeDataIntoTriples(data){
        let ret = {};
        let triples = null;
        let store = $rdf.graph();

        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                store.add(PLANET('GeneralInfo'), PLANET(key), data[key])
            }
        }
        triples = $rdf.serialize(null, store, this.pathToList, 'text/turtle');
        ret['triples'] = triples;
        ret['store'] = store;
        return ret;
    }

    //Add a new planet to the list
    addNewPlanet(data){
        let planetInfo = data.planetInfo;
        let permissions = data.permissions;
        return new Promise((resolve, reject) => {
            if (planetInfo['name']){
                let exists = false;
                if (this.checkNameAvailability(planetInfo['name'])){
                    reject("Name already exists");
                    exists = true;
                }
                if(!exists){
                    let decoded = this.decodeDataIntoTriples(planetInfo);
                    if(decoded['triples'] && decoded['triples'] != ""){
                        this.account.fetch(this.pathToList, {
                            method: 'POST',
                            headers: {
                                'Content-type': 'text/turtle',
                                'Link': '<http://www.w3.org/ns/ldp#Resource>; rel="type"',
                                'Slug': this.planetFileName
                            },
                            body: decoded['triples']
                        })
                        .then(res => res.headers)
                        .then(h => {
                            let relativeUri = h.get('Location');
                            let uri = this.account.uri + relativeUri;
                            let newPlanet = {};
                            let inputs = {};
                            for (const key in data) {
                                if (data.hasOwnProperty(key)) {
                                    inputs[PLANET(key)] = data[key];
                                }
                            }
                            newPlanet.infos = inputs; //TODO: remove ?
                            newPlanet['uri'] = uri;
                            newPlanet['store'] = decoded['store'];
                            this.planetList[uri] = newPlanet;
                            return {permissions:permissions, uri:uri};
                        })
                        .then(data => {
                            if (!utils.isEmpty(data.permissions)){
                                return this.addNewPerm(data);
                            } else {
                                resolve();
                            }
                        })
                        .catch(err => reject(err));
                    }
                }
            } else {
                reject("No name given");
            }
        });
    }

    //edit a planet
    editPlanet(data, uri){
        return new Promise((resolve, reject) => {
            let planet = this.uriExists(uri);
            if (planet){
                let decoded = this.decodeDataIntoTriples(data)
                this.account.fetch(uri, {
                    method:'PUT',
                    body: decoded['triples']
                })
                .then(res => resolve())
                .catch(err => reject(err))
            } else {
                reject("Planet does not exists");
            }
        })
    }

    //Check if the planet name is taken or not
    checkNameAvailability(name){
        for (const key in this.planetList) {
            if (this.planetList.hasOwnProperty(key) && this.planetList[key]['inputs'][PLANET('name').value] == name) {
                return true;
            }
        }
        return false;
    }

    //Deletes a planet from the list
    deletePlanet(uri){
        return new Promise((resolve, reject) => {
            let planet = this.uriExists(uri);
            if (planet){
                this.account.fetch(uri, {
                    method:'DELETE'
                })
                .then(res => resolve())
                .catch(err => reject(err));
                this.account.fetch(uri + ".acl", {
                    method:'DELETE'
                })
                .then(res => resolve())
                .catch(err => reject(err));
            } else {
                reject("Planet does not exists");
            }
        })
    }

    //Check if the uri is taken or not
    uriExists(uri){
        for (const key in this.planetList) {
            if (this.planetList.hasOwnProperty(key) && uri == key) {
                return this.planetList[key];
            }
        }
        return null;
    }

    /**
     * @description "Get the uris of the turtle resources into the container"
     * @param list "List in turtle triples"
     */
    getTurtlesFiles(list){
        this.store = $rdf.graph();
        let i = 0;

        $rdf.parse(list, this.store, this.pathToList, 'text/turtle');
        let uris = this.store.statementsMatching(undefined, RDF('type'), TURTLE('Resource')); 
        let tab = [];

        while(i < uris.length){
            tab.push(uris[i].subject.value);
            i++;
        }
        this.planetCount = i;
        return tab;
    }

    //Fetches a planet from its uri
    fetchPlanet(uri){
        return new Promise((resolve, reject) => {
            let link = '';
            let status = 0;
            this.account.fetch(uri, {
                method: 'GET',
                headers: {'Content-type': 'text/turtle'}
            })
            .then(res => {
                link = utils.parseLinkHeader(res.headers.get('Link'));
                status = res.status;
                return res.text();
            })
            .then(rawPlanet => {
                if (rawPlanet && rawPlanet != "" && status == 200){
                    let planetAcl = link.acl;
                    let planet = this.parsePlanetTriples(rawPlanet, uri);
                    planet.acl = planetAcl;
                    resolve(planet);
                } else if (status == 403 || status == 401){
                    console.log("Unauthorised or access denied");
                    resolve();
                } else {
                    console.log("planet empty");
                    resolve();
                }
            })
            .catch(err => reject(err));
        })
    }

    //Parse rdf triples into an array
    parsePlanetTriples(planet, uri){
        let ret = {};
        let inputs = {};
        let store = $rdf.graph();

        $rdf.parse(planet, store, uri, 'text/turtle');
        let planetInfo = store.statementsMatching(PLANET('GeneralInfo'), undefined, undefined);
        for(let i = 0; i < planetInfo.length; i++){
            inputs[planetInfo[i].predicate.value] = planetInfo[i].object.value;
        }
        ret.inputs = inputs;
        ret.store = store;
        ret.uri = uri;
        return ret;
    }

    parsePlanetAcl(triples, uri){
        let store = $rdf.graph();
        let ret = {};
        let webIdList = [];

        $rdf.parse(triples, store, uri, 'text/turtle');
        let groupList = store.statementsMatching(undefined, RDF('type'), ACL('Authorization'));
        if (groupList != null){
            for (const group in groupList) {
                if (groupList.hasOwnProperty(group)) {
                    let groupName = groupList[group].subject.value;
                    let permissions = store.each($rdf.sym(groupName), ACL('mode'));
                    let webid = store.any($rdf.sym(groupName), ACL('agent'));
                    if (webid.value != this.account.webid){
                        ret[groupName] = {};
                        if (permissions && webid){
                            ret[groupName]['permissions'] = [];
                            for(let j = 0; j < permissions.length; j++){
                                ret[groupName]['permissions'].push(permissions[j].value);
                            }
                            webIdList.push(webid.value);
                            ret[groupName]['webid'] = webid.value;
                        }
                    }
                }
            }
        }

        let dataRet = {};
        dataRet.webIds = webIdList;
        dataRet.permissions = ret;
        dataRet.store = store;
        return dataRet;
    }

    aclExist(acl){
        return new Promise((res, rej) => {
            this.account.fetch(acl, {
                method:'HEAD'
            })
            .then(res => res.status)
            .then(status => {
                if(status != 200){
                    rej('no acl');
                } else {
                    res();
                }
            })
            .catch(err => rej(err))
        })
    }

    fetchPermissions(data, callback){
        let uri = data.uri;
        let aclUri = this.pathToList + data.acl;
        this.aclExist(aclUri)
        .then(() => {
            this.account.fetch(aclUri, {
                method:'GET',
                headers:{'Content-Type':'text/turtle'}
            })
            .then(res => res.text())
            .then(triples => {
                let parsed = this.parsePlanetAcl(triples, aclUri);
                if (uri != this.planetList){
                    this.planetList[uri].hasAcl = true;
                    this.planetList[uri].aclStore = parsed.store;
                    this.planetList[uri].webids = parsed.webIds;
                } else {
                    this.planetFolderAcl.webids = parsed.webIds;
                }
                callback(parsed.permissions);
            })
        })
        .catch(err => {
            if (err == 'no acl'){
                console.log("No specific acl");
            }
            this.planetList[uri].hasAcl = false;
            callback();
        })
    }

    addNewPerm(data){
        let parsed = this.parseDataToSparql(data);
        return new Promise((resolve, reject) => {
            this.account.fetch(data.uri + ".acl", {
                method:'PATCH',
                headers: {'Content-Type':'application/sparql-update'},
                body:parsed
            }).then(res => {
                if(res.status == 200){
                    if (data.uri != this.pathToList){
                        this.planetList[data.uri].hasAcl = true;
                    } 
                    resolve();
                } else {
                    reject(res.status);
                }
            })
            .catch(err => reject(err))
        })
    }

    parseDataToSparql(data){
        let permissions = data.permissions;
        let resource = data.uri;
        let query = `INSERT {`;

        console.log('resource :', resource);
        if(!this.planetList[resource] || !this.planetList[resource].hasAcl){
            query += `${$rdf.sym(resource + "#Owner")} ${RDF('type')} ${ACL('Authorization')};
            ${ACL('agent')} ${$rdf.sym(this.account.webid)};
            ${ACL('accessTo')} ${$rdf.sym(resource)};
            ${ACL('mode')} ${ACL('Read')}, ${ACL('Write')}, ${ACL('Control')}.\n`;
        }
        let i = 0;
        for (const webid in permissions) {
            if (permissions.hasOwnProperty(webid) && (this.planetList[resource]
                && !this.planetList[resource]['webids'].includes(webid)) || (!this.planetFolderAcl['webids'].includes(webid))) {
                const permArr = permissions[webid];
                query += `${$rdf.sym(resource + "#id" + (new Date()).getTime() + i)} ${RDF('type')} ${ACL('Authorization')};\n`;
                query += `${ACL('agent')} ${$rdf.sym(webid)};\n`;
                permArr.forEach(val => {
                    query+= `${ACL('mode')} ${ACL(val)};\n`;
                });
                query += `${ACL('accessTo')} ${$rdf.sym(resource)}.\n`;
            }
            i++;
        }
        query += '}';
        return query;
    }

    deletePerm(data, callback){

        let parsed = this.parseDeleteToSparql(data);
        this.account.fetch(this.pathToList + data.acl, {
            method:'PUT',
            headers: {'Content-Type':'text/turtle'},
            body:parsed
        }).then(res => {
            if(res.status == 201 || res.status == 200){
                this.fetchPermissions(data, parsed => {
                    callback(parsed);
                })
            }
        })
    }

    parseDeleteToSparql(data){
        let aclStore = this.planetList[data.uri].aclStore;
        let subjList = aclStore.statementsMatching(undefined, ACL('agent'), $rdf.sym(data.webid));
        for(let i = 0; i < subjList.length; i++){
            let deletions = aclStore.connectedStatements($rdf.sym(subjList[i].subject.value));
            aclStore.remove(deletions);
        }
        let query = $rdf.serialize(null, aclStore, this.planetList + data.acl, 'text/turtle');
        return query;
    }


    //Fetches the planet list 
    fetchPlanetList(){
        return new Promise((resolve, reject) => {
            this.hasPlanetList().then(res => {
                this.account.fetch('https://savincen.localhost:8443/PlanetList', {
                    method: 'GET',
                    headers: {'Content-type':'text/turtle'}
                })
                .then(res => res.text())
                .then(rawList => {
                    let planetList = this.getTurtlesFiles(rawList);
                    resolve(planetList);
                })
                .catch(err => {
                    reject(err);
                })
            })
            .catch(err => {
                this.createPlanetList().then(res => resolve("New"))
                .catch(err => reject(err));
            });
        });
    }

    //Change uri from https://localhost:port to https://user.localhost:port and conversely
    reloadListPath(){ //TODO: Faire une method qui se trigger lors de la co/deco dans accountmanager
        this.pathToList =  this.account.uri + this.planetListName + '/';
    }

    listPath(accountUri){
        this.pathToList = accountUri + this.planetListName + '/';
    }

}

module.exports = PlanetHandler;