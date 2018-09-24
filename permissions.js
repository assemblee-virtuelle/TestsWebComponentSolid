class Permissions {
    constructor(args = {}){
        extend(this, args);

        if (!this.account){
            throw new Error("Auth manager missing");
        }
    }

    

    getAclFromFile(uri){

    }
}

module.exports = Permissions;