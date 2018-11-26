
// Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config')
const fs = require('fs')
const helpers = require('./helpers')
const handlers = require('./handlers')
const path = require('path')
const util = require('util')
const debug = util.debuglog('servers')
// Configure the server to respond to all requests with a string

const server = {}

//instantiate http server
server.httpServer = http.createServer(function (req, res) {
    unified(req, res)
})

//instantiate https server
server.httpsServerOptions = {
    key: fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
}
server.httpsServer = https.createServer(server.httpsServerOptions, function (req, res) {
    unified(req, res)
})

//unified server

const unified = function (req, res) {

    // Parse the url
    const parsedUrl = url.parse(req.url, true)

    // Get the path
    const path = parsedUrl.pathname
    const trimmedPath = path.replace(/^\/+|\/+$/g, '')

    // Get the query string as an object
    const queryStringObject = parsedUrl.query

    // Get the HTTP method
    const method = req.method.toLowerCase()

    //Get the headers as an object
    const headers = req.headers

    // Get the payload,if any
    const decoder = new StringDecoder('utf-8');
    let buffer = '';
    req.on('data', function (data) {
        buffer += decoder.write(data)
    });
    req.on('end', function () {
        buffer += decoder.end()

        // Check the router for a matching path for a handler. If one is not found, use the notFound handler instead.
        const chosenHandler = typeof (server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound

        // Construct the data object to send to the handler
        const data = {
            'trimmedPath': trimmedPath,
            'queryStringObject': queryStringObject,
            'method': method,
            'headers': headers,
            'payload': helpers.parseJsonToObject(buffer)
        }

        // Route the request to the handler specified in the router
        chosenHandler(data, function (statusCode, payload, contentType) {

            contentType = typeof (contentType) == 'string' ? contentType : 'json'
            // Use the status code returned from the handler, or set the default status code to 200
            statusCode = typeof (statusCode) == 'number' ? statusCode : 200;

            if (contentType == 'json') {
                payload = typeof (payload) == 'object' ? payload : {};
                const payloadString = JSON.stringify(payload);
                res.setHeader('Content-Type', 'application/json');
            }
            if (contentType == 'html') {
                payload = typeof (payload) == 'string' ? payload : '';
                res.setHeader('Content-Type', 'text/html');
            }

            res.writeHead(statusCode);
            res.end(payloadString);

            //if the response is 200 print green
            if (statusCode == 200) {
                debug('\x1b[32m%s\x1b[0m', method.toUpperCase() + '/' + trimmedPath + ' ' + statusCode);
                // debug("Returning this response: ", statusCode, payloadString);
            } else {
                debug('\x1b[31m%s\x1b[0m', method.toUpperCase() + '/' + trimmedPath + ' ' + statusCode);
            }

        })

    })
}
// Define the request router
server.router = {
    '': handlers.index,
    'account/create': handlers.accountCreate,
    'account/edit': handlers.accountEdit,
    'account/deleted': handlers.accountDeleted,
    'session/create': handlers.sessionCreate,
    'session/deleted': handlers.sessionDeleted,
    'checks/all': handlers.checkList,
    'checks/create': handlers.checksCreate,
    'checks/edit': handlers.checksEdit,
    'ping': handlers.ping,
    'api/users': handlers.users,
    'api/tokens': handlers.tokens,
    'api/checks': handlers.checks
};

server.init = () => {
    // Start the http server
    server.httpServer.listen(config.httpPort, function () {
        console.log('\x1b[34m%s\x1b[0m', `The server is up and running now on ${config.httpPort}, in ${config.envName} mode`);
    })

    // Start the https server
    server.httpsServer.listen(config.httpsPort, function () {
        console.log('\x1b[35m%s\x1b[0m', `The server is up and running now on ${config.httpsPort}, in ${config.envName} mode`);
    })
}
module.exports = server
