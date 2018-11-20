const path = require('path')
const fs = require('fs')
const _data = require('./data')
const http = require('http')
const https = require('https')
const helpers = require('./helpers')
const url = require('url')
const _logs = require('./logs')
const util = require('util')
const debug = util.debuglog('workers')
const workers = {}


workers.gatherAllChecks = () => {
    //get all checks 
    _data.list('checks', (err, checks) => {
        if (!err && checks && checks.length > 0) {
            checks.forEach(check => {
                //Read in the check data
                _data.read('checks', check, (err, originalCheckData) => {
                    if (!err && originalCheckData) {
                        //pass it to the check validator, and let the function continue
                        workers.validateCheckData(originalCheckData)
                    } else {
                        debug('Error: reading one of the check data')
                    }
                })
            });
        } else {
            debug('Error: could not find any process')
        }
    })
}

//Sanity-check
workers.validateCheckData = (originalCheckData) => {
    originalCheckData = typeof (originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {}
    originalCheckData.id = typeof (originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false
    originalCheckData.userPhone = typeof (originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false
    originalCheckData.protocol = typeof (originalCheckData.protocol) == 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol.trim() : false
    originalCheckData.url = typeof (originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false
    originalCheckData.method = typeof (originalCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method.trim() : false
    originalCheckData.successCodes = typeof (originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false
    originalCheckData.timeoutSeconds = typeof (originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false

    //set the new keys may not be set(if worker have never seen the check)
    originalCheckData.state = typeof (originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state.trim() : 'down'
    originalCheckData.lastChecked = typeof (originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false

    //if all checks pass
    if (originalCheckData.id &&
        originalCheckData.userPhone &&
        originalCheckData.protocol &&
        originalCheckData.url &&
        originalCheckData.method &&
        originalCheckData.successCodes &&
        originalCheckData.timeoutSeconds) {
        workers.performCheck(originalCheckData)
    } else {
        debug('Error: one of the check is not properly formatted')
    }
}

//perform check
workers.performCheck = (originalCheckData) => {
    //prepare the initial check outcome
    const checkOutcome = {
        'error': false,
        'responseCode': false
    }
    //Mark the outcome has not been set yet
    let outcomeSent = false
    //parse hostname and path
    const parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true)
    const hostname = parsedUrl.hostname
    const path = parsedUrl.path//because we want the string query also

    const requestDetails = {
        'protocol': originalCheckData.protocol + ':',
        'hostname': hostname,
        'method': originalCheckData.method.toUpperCase(),
        'path': path,
        'timeout': originalCheckData.timeoutSeconds * 1000
    }

    //instantiate the req
    const _moduleToUse = originalCheckData.protocol == 'http' ? http : https
    const req = _moduleToUse.request(requestDetails, (res) => {
        const status = res.statusCode
        //update the checkOutcome and pass data along
        checkOutcome.responseCode = status
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome)
            outcomeSent = true
        }
    })

    //bind to err
    req.on('error', (e) => {
        //update the checkOutcome and pass data along
        checkOutcome.error = {
            'error': true,
            'value': e
        }
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome)
            outcomeSent = true
        }
    })
    //bind to timeout
    req.on('timeout', (e) => {
        //update the checkOutcome and pass data along
        checkOutcome.error = {
            'error': true,
            'value': 'timeout'
        }
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome)
            outcomeSent = true
        }
    })

    //end req
    req.end()
}

//process checkOutcome and update check data and trigger alert
workers.processCheckOutcome = (originalCheckData, checkOutcome) => {
    //decide if the check is up or down
    const state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down'

    //decide if an alert is warranted
    const alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false

    //log the outcome
    const timeOfCheck = Date.now()
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck)
    //update the check data
    const newCheckData = originalCheckData
    newCheckData.state = state
    originalCheckData.lastChecked = timeOfCheck

    _data.update('checks', newCheckData.id, newCheckData, (err) => {
        if (!err) {
            //send the new check data to the new phase if needed
            if (alertWarranted) {
                workers.alertUserToStatusChanged(newCheckData)
            } else {
                debug('Check outcome has not changed no need to send alert')
            }
        } else {
            debug('Error trying save updates to one of the check')
        }
    })
}

//alert user
workers.alertUserToStatusChanged = (newCheckData) => {
    const msg = `Alert: your check for ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}"//${newCheckData.url} is currently ${newCheckData.state}`
    helpers.sendTwilioSms(newCheckData.userPhone, msg, (err) => {
        if (!err) {
            debug('Success: User were alerted to a status change via sms:\n' + msg)
        } else {
            debug('Error: could not send sms alert to a user who has a status change')
        }
    })
}

workers.log = (originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) => {
    const logData = {
        'check': originalCheckData,
        'outcome': checkOutcome,
        state,
        'alert': alertWarranted,
        'time': timeOfCheck
    }
    const logString = JSON.stringify(logData)

    _logs.append(originalCheckData.id, logString, (err) => {
        if (!err) {
            debug('logging to file succeeded')
        } else {
            debug('logging to file failed')
        }
    })
}
//timer to execute the worker-process once per minute
workers.loop = () => {
    setInterval(() => {
        workers.gatherAllChecks()
    }, 1000 * 60)
}

//rotate (compressing)
workers.rotateLogs = () => {
    //list all none compressed files
    _logs.list(false, (err, logs) => {
        if (!err && logs && logs.length > 0) {
            logs.forEach(logName => {
                const logId = logName.replace('.log', '')
                const newFileId = logId + '-' + Date.now()
                _logs.compress(logId, newFileId, (err)=>{
                    if(!err){
                        //truncate the log
                        _logs.truncate(logId, (err)=>{
                            if(!err){
                                debug('Success truncating logFile')
                            } else {
                                debug('Success truncating logFile')
                            }
                        })
                    } else {
                        debug('Error compressing one of the file', err)
                    }
                })
            })
        } else {
            debug('Error: could not find any logs to compress')
        }
    })
}

//timer to execute the compressing logs once per day
workers.logRotationLoop = () => {
    setInterval(() => {
        workers.rotateLogs()
    }, 1000 * 60 * 60 * 24)
}

workers.init = () => {
    //sent to console in yellow
    console.log('\x1b[33m%s\x1b[0m','background workers are running')
    //exec all checks immediately 
    workers.gatherAllChecks()
    // loop
    workers.loop()

    //compress all logs immediately
    workers.rotateLogs()

    //call compression later on
    workers.logRotationLoop()
}

module.exports = workers