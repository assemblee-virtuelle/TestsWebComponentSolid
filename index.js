const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');

var privateKey  = fs.readFileSync('../localhost.key', 'utf8');
var certificate = fs.readFileSync('../localhost.cert', 'utf8');
app.use(express.static(__dirname + '/views'));
app.use(express.static(__dirname + '/dist'));

let credentials = {key: privateKey, cert: certificate};

const server = https.createServer(credentials, app);

app.get('/', (req,res) => {
    res.sendFile('index.html');
});

server.listen(8000, ()=> console.log("launched"));