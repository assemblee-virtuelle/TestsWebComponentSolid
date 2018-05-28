const postal = require('postal');
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;

let card = document.querySelector('card-creator');
let reader = document.querySelector('resource-reader');
let sparql = document.querySelector('sparql-request');

card.setPostal(postal);
reader.setPostal(postal);
sparql.setPostal(postal);

let uri = "https://localhost:8443/";

let postCard = postal.subscribe({
    channel:'solid',
    topic:'post-card',
    callback: (data, enveloppe) => {
        let resource = proceedDataToJsonLdCard(data);
        
        fetch(uri, {
            method: 'POST',
            headers:{
                'Content-type':'text/turtle',
                'Link':'<http://www.w3.org/ns/ldp#Resource>; rel="type"',
                'Slug': 'card'
            },
            body: resource
        }).then(res => {
            return res.statusText;
        })
        .then(msg => {
            console.log('msg :', msg);
            if (msg == "Created"){
                postal.publish({
                    channel:'solid',
                    topic:'done-card',
                    data:'ok'
                });
                postCard.unsubscribe();
            }
        })
        .catch(err => {
            console.log('err :', err);
        })
    }
});

let getResource = postal.subscribe({
    channel:'solid',
    topic:'get-resource',
    callback:(data, enveloppe) =>{
        let select = "";
        if (data.name || !data.name){
            if (data.query)
                select = "?query=" + encodeURI(data.query);
            console.log('select :', uri + data.name + select);
            fetch(uri + data.name + select, {
                method: 'GET',
                headers: {'Content-type':'text/turtle'},
            }).then(res => {
                if(res.status >= 400 && res.status < 600){
                    res.text().then(body => {
                        postal.publish({
                            channel:'solid',
                            topic:'err-resource',
                            data:body
                        });
                    })
                } else {
                    res.text().then(body => {
                        postal.publish({
                            channel:'solid',
                            topic:'done-resource',
                            data:body
                        });
                    })
                }
            })
            .catch(err => {
                postal.publish({
                    channel:'solid',
                    topic:'err-resource',
                    data:err
                });
            })
        }
    }
})

let sparqlUpdate = postal.subscribe({
    channel:'solid',
    topic:'patch-sparql',
    callback: (data, enveloppe) => {
        console.log("patch = ", data.request);
        
        fetch(uri + data.name, {
            method:'PATCH',
            headers:{'Content-type':'application/sparql-update'},
            body:data.request
        })
        .then(res => {
            if(res.status >= 400 && res.status < 600){
                res.text().then(body => {
                    postal.publish({
                        channel:'solid',
                        topic:'err-sparql',
                        data:body
                    });
                })
            } else {
                res.text().then(body => {
                    postal.publish({
                        channel:'solid',
                        topic:'done-sparql',
                        data:body
                    });
                })
            }
        })
        .catch(err => {
            postal.publish({
                channel:'solid',
                topic:'err-sparql',
                data:err
            });
        })
    }
})

function proceedDataToJsonLdCard(data){
    let keys = Object.keys(data);
    let resource = "";
    let writer = N3.Writer({ prefixes: { 
        card: uri + 'card.ttl#',
        foaf: 'http://xmlns.com/foaf/0.1/',
        rdf:'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
    }});
    writer.addQuad(
        namedNode('card:me'),
        namedNode('rdf:Type'),
        namedNode('foaf:Person')
    );

    if (keys.length !== 0){
        for (let key in data){
            if (data.hasOwnProperty(key)) {
                let rdfKey;
                switch(key){
                    case "name":
                        rdfKey = "firstName"
                        break;
                    case "lastName" :
                        rdfKey = "lastName"
                        break;
                    case "knows":
                        rdfKey = "knows"
                        break;
                    case "surname":
                        rdfKey = "surname"
                        break;
                    case "currentProject":
                        rdfKey = "currentProject"
                        break;
                    default:
                        rdfKey = key
                        break;
                }
                writer.addQuad(
                    namedNode('card:me'),
                    namedNode('foaf:'+rdfKey),
                    literal(data[key])
                );
            }
        }
        writer.end((error, result) => {
            if (error == null)
                resource = result;
            else 
                console.log("writer err, ", error);
        });
        console.log('resource :', resource);
        return resource;
    }
}