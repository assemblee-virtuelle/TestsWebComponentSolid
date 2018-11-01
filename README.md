PlanetList
===

# Launch notes

To compile assets : `npm install` then use the `webpack` command, or `nodes_modules/webpack/bin/webpack.js`

To use directly the `webpack` command you must have installed it beforehand with `sudo npm install -g webpack`

* Launch your solid server, and add his URI in the PlanetLists you want to have access on this server by modifing the server_list.json file located in : https://github.com/assemblee-virtuelle/assemblee-virtuelle.github.io/blob/master/TestsWebComponentSolid/server_list.json
* Then launch the second server with the command `npm start` 

Better use it on chrome, it doesn't work properly on firefox
