const extend = require('extend');
const $rdf = require('rdflib');
const utils = require('./utils');

const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const PLANET = $rdf.Namespace('http://example.org/planet#');
const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
const TURTLE = $rdf.Namespace('http://www.w3.org/ns/iana/media-types/text/turtle#');
const ACL = $rdf.Namespace('http://www.w3.org/ns/auth/acl#');

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

        //this.pathToList = this.account.accountUri + this.planetListName + '/';
        this.planetList = {};
        this.planetFolderPerms = [];
        this.planetFolderAclStore = null;
        //TODO: Get acl suffix from server
        this.aclSuffix = ".acl";
    }

    //Load the planet List from distant turtle file and parses it into an array
    loadPlanetList(){
        return new Promise((resolve, reject) => {
            this.fetchPlanetList()
            .then(list => {
                if (list != "New"){
                    this.planetList = {};
                    let promisesArray = [];
                    for(let i = 0; i < list.length; i++){
                        promisesArray.push(this.fetchPlanet(list[i]));
                    }
                    Promise.all(promisesArray)
                    .then(list => {
                        if (list){
                            for(let i = 0; i < list.length; i++){
                                if (list[i] && list[i] != undefined){
                                    this.planetList[list[i].uri] = {};
                                    this.planetList[list[i].uri].planet = list[i];
                                }
                            }
                        }
                        resolve({list:this.planetList, listUri:this.pathToList, uri:this.account.accountUri});
                    });
                }
            })
            .catch(err => {
                reject(err);
            })
        })
    }

    /**
     * @description Fetch the planet list, if it doesn't exist, create it
     */
    fetchPlanetList(){
        return new Promise((resolve, reject) => {
            console.log('this.pathToList :', this.pathToList);
            this.ressourceExist(this.pathToList).then(res => {
                this.account.fetch(this.pathToList, {
                    method: 'GET',
                    headers: {'Content-type':'text/turtle'}
                })
                .then(res => res.text())
                .then(rawList => {
                    let planetListUris = this.getTurtlesFiles(rawList);
                    resolve(planetListUris);
                })
                .catch(err => {
                    reject(err);
                })
            })
            .catch(err => {
                if (err == 404){
                    this.createPlanetList().then(res => resolve("New"))
                    .catch(err => reject(err));
                }
            });
        });
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

    /**
     * @description Check if ressource exists
     * @param {String} uri 
     */
    ressourceExist(uri){
        return new Promise((resolve, reject) => {
            this.account.fetch(uri, {
                method:'HEAD'
            })
            .then(res => {
                if (res.status === 200){
                    resolve(res.status);
                } else {
                    reject(res.status)
                }
            })
            .catch(err => reject(err))
        })
    }

    /**
     * @description Creates the planet list at the root folder (this.account.accountUri)
     * and its default ACL
     */
    createPlanetList(){
        return new Promise((resolve, reject) => {
            this.account.fetch(this.account.accountUri, {
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
                console.log('Erreur lors de la création de la liste :', err);
                reject(err);
            })
        });
    }


    /**
     * @description Create the planet List ACL
     */
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
            .catch(err => reject(err))
        })
    }

    //Add a new planet to the list
    addNewPlanet(planetInfo){
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
                            let uri = this.account.accountUri + relativeUri;
                            let newPlanet = {};
                            let inputs = {};
                            for (const key in planetInfo) {
                                if (planetInfo.hasOwnProperty(key)) {
                                    inputs[PLANET(key)] = planetInfo[key];
                                }
                            }
                            newPlanet['inputs'] = inputs;
                            newPlanet['uri'] = uri;
                            newPlanet['store'] = decoded['store'];
                            this.planetList[uri] = {};
                            this.planetList[uri].planet = newPlanet;
                            resolve();
                        })
                        .catch(err => reject(err));
                    }
                }
            } else {
                reject("No name given");
            }
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
            if (this.planetList.hasOwnProperty(key)) {
                let planetName = this.planetList[key].planet.inputs[PLANET('name').value];
                if (planetName == name){
                    return true;
                }
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
        let store = $rdf.graph();
        let i = 0;

        $rdf.parse(list, store, this.pathToList, 'text/turtle');
        let uris = store.statementsMatching(undefined, RDF('type'), TURTLE('Resource')); 
        let tab = [];

        while(i < uris.length){
            tab.push(uris[i].subject.value);
            i++;
        }
        return tab;
    }

    parseAcl(triples, acl){
        let store = $rdf.graph();
        let aclInfo = {};
        let webIdList = [];
        let resource = null;

        $rdf.parse(triples, store, acl, 'text/turtle');
        let groupList = store.statementsMatching(undefined, RDF('type'), ACL('Authorization'));
        if (groupList != null){
            for (const group in groupList) {
                if (groupList.hasOwnProperty(group)) {
                    let groupName = groupList[group].subject.value;
                    let permissions = store.each($rdf.sym(groupName), ACL('mode'));
                    resource = store.any($rdf.sym(groupName), ACL('accessTo'));
                    let webid = store.any($rdf.sym(groupName), ACL('agent'));
                    aclInfo[groupName] = {};
                    if (permissions && webid){
                        aclInfo[groupName]['permissions'] = [];
                        for(let j = 0; j < permissions.length; j++){
                            aclInfo[groupName]['permissions'].push(permissions[j].value);
                        }
                        webIdList.push(webid.value);
                        aclInfo[groupName]['webid'] = webid.value;
                    }
                }
            }
        }
        if (resource && resource.value != this.pathToList){
            this.planetList[resource.value].permissions = {};
            this.planetList[resource.value].permissions.store = store;
            this.planetList[resource.value].hasAcl = true;
            this.planetList[resource.value].permissions.webid = webIdList;
        } else {
            this.planetFolderPerms = webIdList;
            this.planetFolderAclStore = store;
        }
        return aclInfo;
    }

    fetchPermissions(uri){
        return new Promise((resolve, reject) => {
            let aclFile = null;
            if (uri != this.pathToList){
                if (!this.planetList[uri]){
                    return reject("Invalid Uri or planet not found");
                }
                if (this.planetList[uri] && !this.planetList[uri].planet.acl){
                    return reject("Invalid data acl");
                }
                aclFile = this.pathToList + this.planetList[uri].planet.acl;
            } else {
                aclFile = this.pathToList + this.aclSuffix;
            }
            this.ressourceExist(aclFile)
            .then(() => {
                this.account.fetch(aclFile, {
                    method:'GET',
                    headers:{'Content-Type': 'text/turtle'}
                }).then(res=>res.text())
                .then(rawTriples => {
                    resolve(this.parseAcl(rawTriples, aclFile))
                })
            })
            .catch(err => {
                if (err === 404){
                    this.planetList[uri].hasAcl = false;
                    resolve();
                } else {
                    reject(err);
                }
            })
        })
    }

    addNewPerm(permissions, uri){
        let parsed = this.parseNewPermsToSparql(permissions, uri);
        let aclUri = this.getAclUri(uri);
        return new Promise((resolve, reject) => {
            if(!this.webidCheck(permissions.webid, uri)){
                this.account.fetch(aclUri, {
                    method:'PATCH',
                    headers: {'Content-Type':'application/sparql-update'},
                    body:parsed
                }).then(res => {
                    if(res.status == 200){
                        resolve();
                    } else {
                        reject(res.status);
                    }
                })
                .catch(err => reject(err))
            } else {
                reject("WebID already exists");
            }
        })
    }

    parseNewPermsToSparql(permissions, resource){
        let query = `INSERT {`;
        let webid = permissions.webid;
        let modes = permissions.modes;

        if(!this.planetList[resource] || !this.planetList[resource].hasAcl){
            query += `${$rdf.sym(resource + "#Owner")} ${RDF('type')} ${ACL('Authorization')};
            ${ACL('agent')} ${$rdf.sym(this.account.webid)};
            ${ACL('accessTo')} ${$rdf.sym(resource)};
            ${ACL('mode')} ${ACL('Read')}, ${ACL('Write')}, ${ACL('Control')}.\n`;
        }
        query += `${$rdf.sym(resource + "#id" + (new Date()).getTime())} ${RDF('type')} ${ACL('Authorization')};\n`;
        query += `${ACL('agent')} ${$rdf.sym(webid)};\n`;
        if (resource == this.pathToList){
            query += `${ACL('default')} ${$rdf.sym(this.pathToList)};\n`
        }
        modes.forEach(val => {
            query+= `${ACL('mode')} ${ACL(val)};\n`;
        });
        query += `${ACL('accessTo')} ${$rdf.sym(resource)}.\n`;
        query += '}';
        return query;
    }

    webidCheck(webid, uri){
        if (uri === this.pathToList && this.planetFolderPerms.includes(webid)){
            return true;
        } else if (uri !== this.pathToList && this.planetList[uri].hasAcl
            && this.planetList[uri].permissions.webid.includes(webid)){
            return true;
        }
        return false;
    }

    editPerm(permissions, uri){
        return new Promise((resolve, reject) => {
            this.deletePerm(permissions.webid, uri)
            .then(() => {

                this.addNewPerm(permissions, uri)
            })
            .then(() => {
                resolve();
            })
            .catch(err => reject(err));
        })
    }

    deletePerm(webid, uri){
        let aclUri = this.getAclUri(uri);
        return new Promise((resolve, reject) => {
            let parsed = this.parseDeleteToSparql(webid, uri);
            this.account.fetch(aclUri, {
                method:'PUT',
                headers: {'Content-Type':'text/turtle'},
                body:parsed
            }).then(res => {
                if(res.status == 201 || res.status == 200){
                    if (uri === this.pathToList && this.planetFolderPerms.includes(webid)){
                        this.planetFolderPerms = this.planetFolderPerms.filter(item => item !== webid)
                    } else if (uri !== this.pathToList && this.planetList[uri].hasAcl
                        && this.planetList[uri].permissions.webid.includes(webid)){
                        this.planetList[uri].permissions.webid = this.planetList[uri].permissions.webid.filter(item => item !== webid)
                    }
                    resolve(res.status);
                } else {
                    reject(res.status);
                }
            })
        })
    }

    parseDeleteToSparql(webid, uri){
        let aclStore = null;
        let aclUri = this.getAclUri(uri);
        if (uri !== this.pathToList){
            aclStore = this.planetList[uri].permissions.store;
        } else {
            aclStore = this.planetFolderAclStore;
        }
        let subjList = aclStore.statementsMatching(undefined, ACL('agent'), $rdf.sym(webid));
        for(let i = 0; i < subjList.length; i++){
            let deletions = aclStore.connectedStatements($rdf.sym(subjList[i].subject.value));
            aclStore.remove(deletions);
        }
        let query = $rdf.serialize(null, aclStore, aclUri, 'text/turtle');
        return query;
    }

    getAclUri(uri){
        let aclUri = null;
        if (uri === this.pathToList){
            aclUri = this.pathToList + this.aclSuffix;
        } else {
            aclUri = this.pathToList + this.planetList[uri].planet.acl;
        }
        return aclUri;
    }

    listPath(listUri){
        this.pathToList = listUri + this.planetListName + '/';
    }

}

module.exports = PlanetHandler;