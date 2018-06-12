const extend = require('extend');
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal } = DataFactory;
const $rdf = require('rdflib');

var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/")

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
        this.me = $rdf.sym(this.webid);
    }

    channelCardCreate(){
        let postCard = this.postal.subscribe({
            channel:'solid',
            topic:'post-card',
            callback: (data, enveloppe) => {
                let resource = this.proceedDataToJsonLdCard(data);
                if (resource != null){
                    this.fetch(this.uri, {
                        method: 'POST',
                        headers:{
                            'Content-type':'text/turtle',
                            'Link':'<http://www.w3.org/ns/ldp#Resource>; rel="type"',
                            'Slug': 'card'
                        },
                        body: resource
                    }).then(res => {
                        return res.headers.get('Location');
                    })
                    .then(path => {
                        if (path){
                            this.postal.publish({
                                channel:'solid',
                                topic:'done-card',
                                data:path
                            });
                            postCard.unsubscribe();
                        }
                    })
                    .catch(err => {
                        console.log('err :', err);
                    })
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
            console.log('resource :', resource);
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
                let dataAcl = data['permissions']
                this.parseResource(name, dataResource).then(content => {
                    console.log('content :', content);
                    let request = "";
                    if (dataResource){
                        request = this.updateByFormSparql(dataResource, content);
                    }
                    let resource = this.resourceExists(name);
                    if (resource){
                        this.fetchSparql(request, name);
                        
                        //dataAcl est un obj comprenant en key le webid et en value un array de droits
                        //sous forme webid:['read', 'write', 'control']
                        if (dataAcl){
                            this.parseAcl(name, dataAcl).then(content =>{
                                let request = "";
                                request = this.changePermissionsSparql(dataAcl, content);
                                console.log('contentOfAclParse :', content);
                            });
                        }
                    } else {
                        console.log("not exist");
                    }
                })
            }
        });
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
        data = {
            'webid1':['read', 'write', 'control']
        }
        return new Promise((resolve, reject) => {
            let store = $rdf.graph();
            this.getResource(name).then(resource => {
                try {
                    $rdf.parse(resource, store, this.uri + name + this.aclSuffix);
                    let ret = [];
                    for (let webid in data){
                        if (data.hasOwnProperty(webid) && data[webid] != ""){
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
                console.log('acl : ', link);
                let match = reg.exec(link);
                if (match[2] != null && match[2] != undefined){
                    infos['acl'] = match[2];
                    console.log(match[2]);
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