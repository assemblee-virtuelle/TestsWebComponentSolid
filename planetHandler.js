const extend = require('extend');
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal } = DataFactory;
const $rdf = require('rdflib');
const isEmpty = require('./utils');

var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var PLANET = $rdf.Namespace('http://example.org/planet#');
var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');

class PlanetHandler{
    constructor(args = {}){
        extend(this, args);
        
        if (!this.postal){
            throw new Error("Postal not set");
        }
        if (!this.account){
            throw new Error("Fetch not set");
        }
        if (!this.planetDir || !this.planetListName){
            throw new Error("Missing planet list info");
        }
        this.pathToList = this.account.uri + this.planetDir + '/' + this.planetListName;
        this.store = $rdf.graph();
    }

    loadPlanetForm(data){
        console.log("load form");
        let planetForm = document.querySelector('planet-form');
        let planetList = document.querySelector('planet-list');

        if (planetList && planetList != undefined){
            if (planetList.style.display != "none"){
                planetList.style.display = "none";
            }
        }

        if (!planetForm || planetForm == undefined || planetForm == ""){
            planetForm = document.createElement('planet-form');
            planetForm.setPostal(postal);
            document.body.appendChild(planetForm);
        } else {
            if (planetForm.style.display == "none"){
                planetForm.style.display = "inline";
                //TODO Clear form
            }
        }
    }

    loadPlanetList(data){
        console.log("load list");
        let planetForm = document.querySelector('planet-form');
        let planetList = document.querySelector('planet-list');

        if (planetForm && planetForm != undefined){
            if (planetForm.style.display != "none"){
                planetForm.style.display = "none";
            }
        }

        if (!isEmpty(data)) {
            this.addNewPlanet(data)
            // .then(res => {
            //     console.log('Planet created, populating...');
            //     //this.populateList();
            // })
        } else {
            //this.populateList();
        }
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
                    this.createPlanetList().then(res => resolve("New"))
                    .catch(err => reject(err));
                }
            })
            .catch(err => {
                this.createPlanetList().then(res => resolve("New"))
                .catch(err => reject(err));
            })

        })
    }

    createPlanetList(){
        return new Promise((resolve, reject) => {
            this.account.fetch(this.pathToList, {
                method: 'PUT',
                headers: {
                    'Content-Type':'text/turtle',
                }
            })
            .then(res => {
                console.log('Planet list created !');
                resolve();
            })
            .catch(err => {
                console.log('err creation :', err);
                reject(err);
            })
        });
    }

    parseFormIntoTriples(list, form){
        let res = null;

        console.log('list :', list);
        if (form.name){
            var className = $rdf.sym(this.pathToList + '#' + form.name);
            console.log("adding name");
            this.store.add(className, RDF('Type'), PLANET('CelestialBody'));
            this.store.add(className, FOAF('name'), form.name);
        }
        if (form.radius){
            console.log("adding radius");
            this.store.add(className, PLANET('radius'), form.radius);
        }
        if (form.temperature){
            console.log("adding temperature");
            this.store.add(className, PLANET('temperature'), form.temperature);
        }
        res = $rdf.serialize(null, this.store, this.pathToList, 'text/turtle');
        console.log('res :', res);
        return res;
    }

    addNewPlanet(data){
        console.log("ajoute une nouvelle planete " + data.name);
        this.fetchPlanetList()
        .then(list => {
            return new Promise((resolve, reject) => {

                let triples = this.parseFormIntoTriples(list, data);
                this.account.fetch(this.pathToList, {
                    method: 'PUT',
                    headers: {
                        'Content-Type':'text/turtle',
                    },
                    body: triples
                })
                resolve();
            })
        });
    }

    fetchPlanetList(){
        console.log('fetching planet list...');
        return new Promise((resolve, reject) => {
            this.hasPlanetList().then(res => {
                if (res == "New"){
                    console.log('Planet list is newly created');
                    resolve(null);
                } else {
                    console.log('fetching...');
                    this.account.fetch(this.pathToList, {
                        method: 'GET',
                        headers: {'Content-type':'text/turtle'}
                    })
                    .then(res => res.text())
                    .then(rawList => {
                        console.log('parsing Planet List...');
                        let parsedList = this.parseList(rawList);
                        resolve(parsedList);
                    })
                    .catch(err => console.log('err fetching list :', err))
                }
            })
            .catch(err => {
                throw new Error(err);
            });
        });
    }

    parseList(data){
        try {
            
            $rdf.parse(data, this.store, this.pathToList, 'text/turtle');
            let ret = {};
            let namesList = this.store.each(undefined, RDF('Type'), PLANET('CelestialBody'));
            if (namesList && namesList.length != 0){
                for(let i = 0; i < namesList.length; i++){
                    let planetInfo = this.store.statementsMatching(namesList[i], undefined, undefined);
                    if (planetInfo && planetInfo.length != 0){
                        ret[namesList[i]] = {};
                        for(let j = 0; j < planetInfo.length; j++){
                            ret[namesList[i]][planetInfo[j].predicate.value] = planetInfo[j].object.value;
                        }
                    }
                }
            }
            console.log('ret :', ret);
            return ret;
        } catch (error) {
            console.log('error :', error);
            return null;
        }
    }

    populateList(planetList){
        
    }

    reloadListPath(){ //TODO Faire une method qui se trigger lors de la co/deco dans accountmanager
        this.pathToList = this.account.uri + this.planetDir + '/' + this.planetListName;
    }

    set listPath(pathToList){
        this.pathToList = pathToList;
    }

    get listPath(){
        return this.pathToList;
    }

}

module.exports = PlanetHandler;