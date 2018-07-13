const extend = require('extend');
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

    loadPlanetList(data){
        console.log("load list");

        if (!isEmpty(data)) {
            this.addNewPlanet(data)
            .then(res => {
                console.log('Planet created, populating...');
                this.postal.publish({
                    channel:'planet',
                    topic:'addSuccess',
                    data: res
                });
                this.switchView('list');
            })
            .catch(err => {
                console.log('errcreating planet :', err);
                this.postal.publish({
                    channel:'planet',
                    topic:'addErr',
                    data: err
                })
            })
        } else {
            this.fetchPlanetList()
            .then(res => {
                console.log("fetchin list");
                this.postal.publish({
                    channel: 'planet',
                    topic:'addSuccess',
                    data: {
                        'old': res,
                    }
                });
                this.switchView('list');
            })
            .catch(err => {
                console.log('errfetch :', err);
                this.postal.publish({
                    channel:'planet',
                    topic:'addErr',
                    data: err
                })
            })
        }
    }

    switchView(number, data = null){
        let planetForm = document.querySelector('planet-form');
        let planetList = document.querySelector('planet-list');

        if (number == 1 || number == 'list'){
            if (planetForm && planetForm != undefined && planetForm.style.display != "none"){
                planetForm.style.display = "none";
            }
            
            if (!planetList || planetList == undefined || planetList == ""){
                planetList = document.createElement('planet-list');
                planetList.setPostal(this.postal);
                document.body.appendChild(planetList);
            } else if (planetList.style.display == "none"){
                planetList.style.display = "inline";
            }

        } else if (number == 2 || number == "form") {
            if (planetList && planetList != undefined && planetList.style.display != "none"){
                planetList.style.display = "none";
            }

            if (!planetForm || planetForm == undefined || planetForm == ""){
                planetForm = document.createElement('planet-form');
                planetForm.setPostal(this.postal);
                let inputs = planetForm.shadowRoot.querySelectorAll('input');
                document.body.appendChild(planetForm);
                if (data){
                    for (let i = 0; i < inputs.length; i++){
                        if (data[i] && data[i] != "")
                            inputs[i].value = data[i];
                    }
                }
            } else {
                if (planetForm.style.display == "none"){
                    let inputs = planetForm.shadowRoot.querySelectorAll('input');
                    planetForm.style.display = "inline";
                    if (data){
                        for (let i = 0; i < inputs.length; i++){
                            if (data[i] && data[i] != "")
                                inputs[i].value = data[i];
                        }
                    } else {
                        for (let i = 0; i < inputs.length; i++){
                            inputs[i].value = "";
                        }
                    }
                }
            }
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
            for (let planet in list){
                if (list[planet][FOAF('name').value] == form.name){

                    return null;
                }
            }
            var className = $rdf.sym(this.pathToList + '#' + encodeURI(form.name));
            this.store.add(className, RDF('Type'), PLANET('CelestialBody'));
            this.store.add(className, FOAF('name'), form.name);
        }
        if (form.radius){
            this.store.add(className, PLANET('radius'), form.radius);
        }
        if (form.temperature){
            this.store.add(className, PLANET('temperature'), form.temperature);
        }
        res = $rdf.serialize(null, this.store, this.pathToList, 'text/turtle');
        return res;
    }

    addNewPlanet(data){
        return new Promise((resolve, reject) => {
            this.fetchPlanetList()
            .then(list => {
                let triples = this.parseFormIntoTriples(list, data);
                if (triples != null && triples != ""){
                    this.account.fetch(this.pathToList, {
                        method: 'PUT',
                        headers: {
                            'Content-Type':'text/turtle',
                        },
                        body: triples
                    })
                    .then(res => {
                        let ret = {
                            'old':list,
                            'new':data
                        };
                        resolve(ret);
                    })
                    .catch(err => {
                        reject(err);
                    });
                } else{
                    reject("Planet is already registered to the Interuniverse Planet Database, please retry with another name");
                }
            })
        });
    }

    fetchPlanetList(){
        return new Promise((resolve, reject) => {
            this.hasPlanetList().then(res => {
                if (res == "New"){
                    resolve(null);
                } else {
                    this.account.fetch(this.pathToList, {
                        method: 'GET',
                        headers: {'Content-type':'text/turtle'}
                    })
                    .then(res => res.text())
                    .then(rawList => {
                        console.log('rawList :', rawList);
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
            console.log('namesList :', namesList);
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
            return ret;
        } catch (error) {
            console.log('error :', error);
            return null;
        }
    }

    deletePlanet(data){
        return new Promise((resolve, reject) => {
            this.store.removeMatches($rdf.sym(this.pathToList + '#' + encodeURI(data.name)), FOAF('name'), data.name);
            this.store.removeMatches($rdf.sym(this.pathToList + '#' + encodeURI(data.name)), RDF('Type'), PLANET('CelestialBody'));
            let req = 
            `DELETE DATA{ ${$rdf.sym(this.pathToList + '#' + encodeURI(data.name))} ${FOAF('name')} "${data.name}";
            ${RDF('Type')} ${PLANET('CelestialBody')};`;

            if (data.radius && data.radius != ""){
                req += `${PLANET('radius')} "${data.radius}";`
                this.store.removeMatches($rdf.sym(this.pathToList + '#' + encodeURI(data.name)), PLANET('radius'), data.radius);
            }
            if (data.temperature && data.temperature != ""){
                req += `${PLANET('temperature')} "${data.temperature}";`
                this.store.removeMatches($rdf.sym(this.pathToList + '#' + encodeURI(data.name)), PLANET('temperature'), data.temperature);
            }
            req += '}'

            console.log('req :', req);
            this.account.fetch(this.listPath, {
                method:'PATCH',
                headers: {'Content-type':'application/sparql-update'},
                body: req
            })
            .then(res => {
                console.log('res.statusText :', res.statusText); 
                resolve();
            })
            .catch(err => console.log('err Deleting :', err))
        })
    }

    editPlanet(data){
        console.log('data :', data);
        
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