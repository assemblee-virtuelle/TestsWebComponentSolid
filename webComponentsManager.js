const extend = require('extend');

class WebComponentsManager {
    constructor(args = {}){
        extend(this, args);


    }

    load(name){
        let webc = document.querySelector(name);
        if (!webc || webc == undefined || webc == ""){
            let newWebc = document.createElement(name)
        }
    }

    unload(name){

    }

}
module.exports = WebComponentsManager;