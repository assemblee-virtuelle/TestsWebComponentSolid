# TestsWebComponentSolid

Web Component testing of **solid** API


#Authentication

**Tutorial here :** https://hackmd.io/onfGBqczTzClCd2DUKViEg#

**Important !** The authentification will change in the future see https://github.com/solid/node-solid-server/issues/672 

###Signin : 
with **ONE** fetch request

-   Send a POST request to /api/accounts/new. (If it's not working and the server is up, it's maybe because the browser certificate for https:localhost:8443/api/accounts/new is registered as UNSAFE)
Data is send in a string like username=toto&password=1234 because sending an object/json causes errors
-   When successful: The server automatically do a GET request before the POST to ensure the user doesn't already exists. 
If it exists it throws a 400 Bad Request error.
If it doesn't already exists it returns a 302 then do the post request which creates the necessary files on the server and then returns a 302.
Finnally the server tries to do a GET request to https://toto.localhost:8443 but at the moment i get a 401 Unauthorised.

All of it in one fetch request.
The first response and second we got in Network (not catchable by fetch or I don't know how) is this:

    HTTP/1.1 302 Found
    X-Powered-By: solid-server
    Access-Control-Allow-Origin: http://127.0.0.1:5500
    Vary: Origin, Accept
    Access-Control-Allow-Credentials: true
    Access-Control-Expose-Headers: Authorization, User, Location, Link, Vary, Last-Modified, ETag, Accept-Patch, Accept-Post, Updates-Via, Allow, WAC-Allow, Content-Length, WWW-Authenticate
    Allow: OPTIONS, HEAD, GET, PATCH, POST, PUT, DELETE
    Location: https://savincen.localhost:8443
    Content-Type: text/plain; charset=utf-8
    Content-Length: 53
    set-cookie: connect.sid=s%3A93rM_4i-3yWt5_wLGpdV6SyuGlBaXIV0.GgoPmSYTI6WAMpRYIa8yUpHKxQDSDqgjGtRVKlT4BT8; Path=/; Expires=Wed, 30 May 2018 13:42:36 GMT; HttpOnly; Secure
    Date: Tue, 29 May 2018 13:42:36 GMT
    Connection: keep-alive 
    

    
###Login

To login and exchange information with credentials you need to install an Auth Client (or make one)
