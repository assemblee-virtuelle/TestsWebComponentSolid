const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');

var privateKey  = fs.readFileSync('../localhost.key', 'utf8');
var certificate = fs.readFileSync('../localhost.cert', 'utf8');
app.use(express.static(__dirname + '/views'));
app.use(express.static(__dirname + '/static'));

let router = express.Router();

let credentials = {key: privateKey, cert: certificate};

app.get('/', (req,res) => {
    res.sendFile('static/index.html', {root : __dirname});
});

app.get('/popup', (req, res) => {
    console.log('req.query.idToken :', req.query.idToken);
    res.sendFile('static/popup.html', {root : __dirname});
});

const server = https.createServer(credentials, app);

let port = 8000;

server.listen(port, ()=> console.log(`Launched on https://localhost:${port}/`));
