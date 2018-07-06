const solid = require('../node-solid-server');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const port = 8443;

const solidApp = solid.createServer({
    cache: 0, // Set cache time (in seconds), 0 for no cache
    serverUri:"https://localhost:"+port,
    live: true, // Enable live support through WebSockets
    root: './LDP/', // Root location on the filesystem to serve resources
    configPath:'./LDP/.config',
    dbPath:'./LDP/.db',
    secret: 'node-ldp', // Express Session secret key
    sslCert: '../localhost.cert', // Path to the ssl cert 
    sslKey: '../localhost.key', // Path to the ssl key
    mount: '/', // Where to mount Linked Data Platform
    auth:'oidc',
    multiuser:true,
    webid: true, // Enable WebID+TLS authentication
    suffixAcl: '.acl', // Suffix for acl files
    corsProxy: '/proxy', // Where to mount the CORS proxy 
    errorHandler: function(err, req, res, next){
        console.log(err)
        next();
    }, // function(err, req, res, next) to have a custom error handler
    errorPages: false // specify a path where the error pages are
})

solidApp.listen(port, () => {
    console.log("Launched solid on https://localhost:" + port)
})