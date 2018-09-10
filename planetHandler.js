const extend = require('extend');
const $rdf = require('rdflib');
const isEmpty = require('./utils');

var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var PLANET = $rdf.Namespace('http://example.org/planet#');
var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
var TURTLE = $rdf.Namespace('http://www.w3.org/ns/iana/media-types/text/turtle#');
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
                    for(let i = 0; i < list.length; i++){
                        this.planetList[list[i].uri] = list[i];
                    }
                    resolve(this.planetList);
                });
            })
            .catch(err => {
                reject(err);
                console.log('errfetch :', err);
            })
        })
    }

    /**
     * Check if the planet list is present, in planet folder. If not, creates it
     */
    hasPlanetList(){
        return new Promise((resolve, reject) => {
            console.log('this.pathToList :', this.pathToList);
            this.account.fetch(this.pathToList, {
                method:'HEAD'
            })
            .then(res => {
                console.log('res :', res);
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
                
                //console.log('Planet list created !');
                resolve();
            })
            .catch(err => {
                console.log('err creation :', err);
                reject(err);
            })
        });
    }

    //decode data from form to rdf triples
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
        return new Promise((resolve, reject) => {

            if (data['name']){
                let exists = false;

                if (this.checkNameAvailability(data['name'])){
                    reject("Name already exists");
                    exists = true;
                }
                if(!exists){
                    let decoded = this.decodeDataIntoTriples(data);
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
                            newPlanet.inputs = inputs;
                            newPlanet['uri'] = uri;
                            newPlanet['store'] = decoded['store'];
                            this.planetList[uri] = newPlanet;
                            resolve(newPlanet);
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
                console.log("edit planet");
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
            this.account.fetch(uri, {
                method: 'GET',
                headers: {'Content-type': 'text/turtle'}
            })
            .then(res => res.text())
            .then(rawPlanet => {
                if (rawPlanet && rawPlanet != ""){
                    let planet = this.parsePlanetTriples(rawPlanet, uri);
                    resolve(planet);
                } else {
                    console.log("planet empty");
                    reject("Planet is empty");
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

    //Fetches the planet list 
    fetchPlanetList(){
        return new Promise((resolve, reject) => {
            this.hasPlanetList().then(res => {
                this.account.fetch(this.pathToList, {
                    method: 'GET',
                    headers: {'Content-type':'text/turtle'}
                })
                .then(res => res.text())
                .then(rawList => {
                    let planetList = this.getTurtlesFiles(rawList);
                    resolve(planetList);
                })
                .catch(err => {
                    console.log('err fetching list :', err);
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
        this.pathToList = this.account.uri + this.planetListName + '/';
    }

    set listPath(pathToList){
        this.pathToList = pathToList;
    }

    get listPath(){
        return this.pathToList;
    }

}

module.exports = PlanetHandler;