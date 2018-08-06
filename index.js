const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');
const postal = require('postal');

var privateKey  = fs.readFileSync('../localhost.key', 'utf8');
var certificate = fs.readFileSync('../localhost.cert', 'utf8');
app.use(express.static(__dirname + '/views'));
app.use(express.static(__dirname + '/static'));

let credentials = {key: privateKey, cert: certificate};

const server = https.createServer(credentials, app);

app.get('/', (req,res) => {
    res.sendFile('static/index.html');
});

let port = 8000;

server.listen(port, ()=> console.log(`Launched on https://localhost:${port}/`));
