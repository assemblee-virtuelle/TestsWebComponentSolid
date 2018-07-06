const extend = require('extend');
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal } = DataFactory;
const $rdf = require('rdflib');
const path = require('path');
const isEmpty = require('./utils');

var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/")

var hasOwnProperty = Object.prototype.hasOwnProperty;

class CardHandler{
    constructor(argv = {}){
        extend(this, argv);

        if (!this.aclSuffix){
            this.aclSuffix = ".acl"; //TODO mettre le suffix present dans la config du serveur solid
        }
        if (!this.postal){
            throw new Error("Postal not set");
        }
        if (!this.fetch){
            throw new Error("Fetch not set");
        }
    }

    setCredentialsInfos(uri, fetch, webid){
        this.uri = uri;
        this.fetch = fetch;
        this.webid = webid;
        if (webid != null){
            this.me = $rdf.sym(this.webid);
        } else {
            this.me = $rdf.sym(uri);
        }
    }

    createResource(name, data){
        return new Promise((resolve, reject) => {
            this.fetch(this.uri, {
                method: 'POST',
                headers:{
                    'Content-type':'text/turtle',
                    'Link':'<http://www.w3.org/ns/ldp#Resource>; rel="type"',
                    'Slug': name
                },
                body: data
            }).then(res => {
                return res.headers.get('Location');
            })
            .then(path => {
                resolve(path);
            })
            .catch(err => {
                reject(err);
            })
        })
    }

    createResourceACL(name, data){
        return new Promise((resolve, reject) => {
            this.fetch(this.uri + name, {
                method: 'PUT',
                headers:{
                    'Content-type':'text/turtle'
                },
                body: data
            }).then(res => {
                return res.headers.get('Location');
            })
            .then(path => {
                resolve(path);
            })
            .catch(err => {
                reject(err);
            })
        })
    }

    channelCardCreate(){
        let postCard = this.postal.subscribe({
            channel:'solid',
            topic:'post-card',
            callback: (data, enveloppe) => {
                let resource = this.proceedDataToJsonLdCard(data);
                if (resource != null){
                    this.createResource('card', resource).then(loc => {
                        if (loc && loc != ""){
                            this.postal.publish({
                                channel:'solid',
                                topic:'done-card',
                                data:loc
                            });
                            postCard.unsubscribe();
                        }
                    })
                    .catch(err => console.log('err ', err));
                }
            }
        });
    }

    proceedDataToJsonLdCard(data){
        let keys = Object.keys(data);
        let resource = null;
        let writer = N3.Writer({ prefixes: { 
            foaf: 'http://xmlns.com/foaf/0.1/',
            rdf:'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
        }});
        writer.addQuad(
            namedNode(''),
            namedNode('rdf:Type'),
            namedNode('foaf:PersonalProfileDocument')
        );
        writer.addQuad(
            namedNode(''),
            namedNode('foaf:primaryTopic'),
            namedNode(this.webid)
        );
        writer.addQuad(
            namedNode(''),
            namedNode('foaf:maker'),
            namedNode(this.webid)
        );
        writer.addQuad(
            namedNode(this.webid),
            namedNode('rdf:Type'),
            namedNode('foaf:Person')
        );
    
        if (keys.length !== 0){
            let count = 0;
            for (let key in data){
                if (data.hasOwnProperty(key) && data[key] != "") {
                    writer.addQuad(
                        namedNode(this.webid),
                        namedNode('foaf:'+key),
                        literal(data[key])
                    );
                    count++;
                }
            }
            if (count != 0){
                writer.end((error, result) => {
                    if (error == null)
                        resource = result;
                    else 
                        console.log("writer err, ", error);
                });
                return resource;
            }
        }
        return null;
    }

    channelCardEdit(){
        let editCard = this.postal.subscribe({
            channel:'solid',
            topic:'edit-card',
            callback: (data, enveloppe) => {
                let name = data['name'];
                let dataResource = data['request'];
                let dataAcl = data['permissions'];
                this.parseResource(name, dataResource).then(content => {
                    let request = "";
                    if (dataResource && !isEmpty(dataResource)){
                        request = this.updateByFormSparql(dataResource, content);
                    }
                    let resource = this.resourceExists(name);
                    if (resource){
                        this.fetchSparql(request, name);

                        if (dataAcl && !isEmpty(dataAcl)){
                            let aclRequest = this.createAcl(name, dataAcl)
                            console.log('aclRequest :', aclRequest);
                            this.createResourceACL(name + this.aclSuffix, aclRequest);/*
                            if (resource.acl == name + this.aclSuffix){
                                this.parseAcl(name, dataAcl).then(aclContent =>{
  
                                })
                                .catch(err => console.log('err :', err));
                            } else {
                                let aclRequest = this.createAcl(name, dataAcl)
                                this.createResource(name, aclRequest);
                            }*/
                        }
                    } else {
                        console.log("not exist");
                    }
                });
            }
        });
        return editCard;
    }
    
    createAcl(name, aclList){
        let aclName = name + this.aclSuffix;
        let res = null;
        let resourcePath = `./${name}`; //TODO get relative path
        let writer = N3.Writer({ prefixes: { 
            acl: 'http://www.w3.org/ns/auth/acl#',
            foaf: 'http://xmlns.com/foaf/0.1/',
            rdf:'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
        }});

        writer.addQuad(
            namedNode('#owner'),
            namedNode('rdf:Type'),
            namedNode('acl:Authorization')
        );
        writer.addQuad(
            namedNode('#owner'),
            namedNode('acl:agent'),
            namedNode(this.webid)
        );
        writer.addQuad(
            namedNode('#owner'),
            namedNode('acl:accessTo'),
            namedNode(resourcePath)
        );
        writer.addQuad(
            namedNode('#owner'),
            namedNode('acl:mode'),
            namedNode('acl:Read')
        );
        writer.addQuad(
            namedNode('#owner'),
            namedNode('acl:mode'),
            namedNode('acl:Write')
        );
        writer.addQuad(
            namedNode('#owner'),
            namedNode('acl:mode'),
            namedNode('acl:Control')
        );
        let count = 0;
        for(let webid in aclList){
            if (aclList.hasOwnProperty(webid) && aclList[webid] != ""){
                writer.addQuad(
                    namedNode('#group' + count),
                    namedNode('rdf:Type'),
                    namedNode('acl:Authorization')
                );
                writer.addQuad(
                    namedNode('#group' + count),
                    namedNode('acl:agent'),
                    namedNode(webid)
                );
                writer.addQuad(
                    namedNode('#group' + count),
                    namedNode('acl:accessTo'),
                    namedNode(resourcePath)
                );
                let right = aclList[webid];
                for (let i = 0; i < right.length; i++){
                    let mode = "";
                    if (right[i] == "read"){
                        mode = "Read";
                    } else if (right[i] == "write"){
                        mode = "Write";
                    } else if (right[i] == "control"){
                        mode = "Control";
                    }
                    writer.addQuad(
                        namedNode('#group' + count),
                        namedNode('acl:mode'),
                        namedNode('acl:' + mode)
                    );
                }
                count++;
            }
        }
        writer.end((error, result) => {
            if (error == null){
                res = result;
            }
            else 
                console.log("writer err, ", error);
        });
        return res;
    }


    /**
     * @description Do a SPARQL request by PATCH on a targeted resource
     * @param {string} request Sparql request
     * @param {string} name Targeted resource
     */
    fetchSparql(request, name){
        this.fetch(this.uri + name, {
            method:'PATCH',
            headers:{'Content-type':'application/sparql-update'},
            body:request
        })
        .then(res => {
            if(res.status >= 400 && res.status < 600){
                res.text().then(body => {
                    this.postal.publish({
                        channel:'solid',
                        topic:'err-edit',
                        data:body
                    });
                });
            } else {
                this.getResource(name).then(resource => {
                    this.postal.publish({
                        channel:'solid',
                        topic:'done-edit',
                        data:resource
                    });
                }).catch(err => {
                    this.postal.publish({
                        channel:'solid',
                        topic:'err-edit',
                        data:err
                    });
                });
            }
        })
        .catch(err => {
            this.postal.publish({
                channel:'solid',
                topic:'err-edit',
                data:err
            });
        });
    }

    /** 
     * @description Get a resource and parse it
     * @param {string} name
     * @returns {type} 
     * 
    */
    parseResource(name, data){
        return new Promise((resolve, reject) => {
            let store = $rdf.graph();
            this.getResource(name).then(resource => {
                try {
                    $rdf.parse(resource, store, this.uri + name, 'text/turtle');
                    let ret = {};
                    for (let key in data){
                        if (data.hasOwnProperty(key) && data[key] != ""){
                            let triple = store.each(this.me, FOAF(key), undefined);
                            let len = triple.length;
                            ret[key] = [];
                            for(let i = 0; i < len; i++){
                                ret[key].push(triple[i].value);
                            }
                        }
                    }
                    resolve(ret);
                } catch (error) {
                    reject(error);
                }
            }).catch(err => reject(err))
        });
    }

    parseAcl(name, data){
        return new Promise((resolve, reject) => {
            let store = $rdf.graph();

            this.getResource(name).then(resource => {
                try {
                    $rdf.parse(resource, store, this.uri + name + this.aclSuffix, 'text/turtle');
                    let ret = {};
                    for (let webid in data){
                        if (data.hasOwnProperty(webid) && data[webid] != ""){
                            console.log('name :', this.uri + name + this.aclSuffix);
                            console.log('webid :', webid);
                            let group = store.each(undefined, FOAF('agent'), webid);
                            let len = group.length;
                            for(let i = 0; i < len; i++){
                                //ret[webid] = group[i].value
                            }
                            console.log('group :', group);
                        }
                    }
                    resolve(ret);
                } catch (error) {
                    reject(error);
                }
            })

        })
    }

    /**
     * @description Creates the Sparql query for the resource update
     * @param {obj} data Data of form
     * @param {obj} content Data from parsed resource
     */
    updateByFormSparql(data, content){
        let req = "";
        
        let deleteData = 'DELETE { \n ';
        let insertData = 'INSERT { \n ';
        let whereData = 'WHERE { \n ';
        let count = 0;
    
        for(let key in data){
            if(data.hasOwnProperty(key) && data[key] != ""){
                if (content[key] && content[key][0] != undefined){
                    deleteData += `${this.me} ${FOAF(key)} "${content[key][0]}" .\n`;
                    whereData += `${this.me} ${FOAF(key)}  "${content[key][0]}".\n`;
                }
                insertData += `${this.me} ${FOAF(key)} "${data[key]}" .\n`;
                count++;
            }
        }
        if (count == 0){
            return null;
        }
        deleteData += '}'
        insertData += '}';
        whereData += '}';
        req += deleteData + '\n';
        req += insertData + '\n';
        req += whereData;
        return req;
    }

    /** 
     * @description Get a resource from solid server and returns the content
     * @param {string} name Name of the resource
     */
    getResource(name){
        return new Promise((resolve, reject) => {
            let ret = null;
            this.fetch(this.uri + name, {
                method: 'GET',
                headers: {'content-type': 'text/turtle'},
            }).then(res => {
                if(res.status == 401){
                    reject("Unauthorized access")
                }
                else if (res.status < 400){
                    res.text().then(body => {
                        resolve(body);
                    });
                } else 
                    reject("Error");
            })
            .catch(err => {
                reject(err);
            });
        });
    }

    /**
     * @description Check if a resource exists
     * @param {string} name
     */
    resourceExists(name){
        let infos = {};

        this.fetch(this.uri + encodeURI(name), {
            method:'HEAD',
        })
        .then(res => {
            if(res.status == 200){
                let ret = {};
                ret['link'] = res.headers.get('Link');
                return ret;
            } else {
                return null;
            }
        })
        .then(data => {
            let link = data['link']
            if(link && link != undefined){
                let reg = /(.*<)(.*\.acl)(.*)/g;
                //(.*?)\.acl
                let match = reg.exec(link);
                if (match[2] != null && match[2] != undefined){
                    infos['acl'] = match[2];
                }
            }
        })
        .catch(err =>{
            console.log('err :', err);
            return null;
        })
        return infos;
    }
}

module.exports = CardHandler;