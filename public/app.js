// Frontend logic

const app = {}

app.config = {
    'sessionToken': false
}

//ajax client
app.client = {}

app.client.request = (headers, path, method, queryStringObject, payload, callback) => {
    //Set defaults
    headers = typeof (headers) == 'object' && headers !== null ? headers : {}
    path = typeof (path) == 'string' ? path : '/'
    method = typeof (method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(method) > -1 ? method.toUpperCase() : 'GET'
    queryStringObject = typeof (queryStringObject) == 'object' && queryStringObject !== null ? queryStringObject : {}
    payload = typeof (payload) == 'object' && payload !== null ? payload : {}
    callback = typeof (callback) == 'function' ? callback : false

    //for each query string parameter sent, add it to the path
    let requestUrl = path + '?'
    let counter = 0
    for (let queryKey in queryStringObject) {
        if (queryStringObject.hasOwnProperty(queryKey)) {
            counter++
            if (counter > 1) {
                requestUrl += '&'
            }
            requestUrl += queryKey + '=' + queryStringObject[queryKey]
        }
    }

    const xhr = new XMLHttpRequest()
    xhr.open(method, requestUrl, true)
    xhr.setRequestHeader('Content-Type', 'applicatoin/json')

    //add headers
    for (let headerKey in headers) {
        if (headers.hasOwnProperty(headerKey)) {
            xhr.setRequestHeader(headerKey, headers[headerKey])
        }
    }

    //if there is a session add it

    if (app.config.sessionToken) {
        xhr.setRequestHeader('token', app.config.sessionToken)
    }

    //when request come back

    xhr.onreadystatechange = () => {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            let statusCode = xhr.status
            let responseReturned = xhr.responseText

            //callback if requested
            if (callback) {
                try {
                    let parsedResponse = JSON.parse(responseReturned)
                    callback(statusCode, parsedResponse)
                } catch (e) {
                    callback(statusCode, false)                    
                }
            }
        }
    }

    //send the payload as JSON

    const payloadString = JSON.stringify(payload)
    xhr.send(payloadString)
}

