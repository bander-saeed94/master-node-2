const config = require('./config');
const crypto = require('crypto');
const https = require('https')
const queryString = require('querystring')

// Container for all the helpers
const helpers = {};

// Parse a JSON string to an object in all cases, without throwing
helpers.parseJsonToObject = (str) => {
  try {
    const obj = JSON.parse(str);
    return obj;
  } catch (e) {
    return {};
  }
};

// Create a SHA256 hash
helpers.hash = (str) => {
  if (typeof (str) == 'string' && str.length > 0) {
    const hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
};

helpers.createRandomString = (length) => {
  length = typeof (length) == 'number' && length > 0 ? length : false
  if (length) {
    const possibleChars = 'abcdefghijklmnopqrstuvwyz01234567890'
    let str = ''
    for (i = 0; i < length; i++) {
      //get random char
      let randomChar = possibleChars.charAt(Math.floor(Math.random() * possibleChars.length))
      str += randomChar
    }
    return str
  } else {
    return false
  }
}


helpers.sendTwilioSms = (phone, msg, callback) => {
  phone = typeof (phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false
  msg = typeof (msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false

  if (phone && msg) {

    const payload = {
      'From': config.twilio.fromPhone,
      'To': '+966' + phone,
      'Body': msg
    }

    const stringPayload = queryString.stringify(payload)

    const requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.twilio.com',
      'method': 'POST',
      'path': '/2010-04-01/Accounts/' + config.twilio.accountSid + '/Messages.json',
      'auth': config.twilio.accountSid + ':' + config.twilio.authToken,
      'headers': {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload)
      }
    }

    const req = https.request(requestDetails, (res) => {
      const status = res.statusCode
      if (status == 200 || status == 201) {
        callback(false)
      } else {
        callback('Status code was returned with ' + status)
      }
    })

    req.on('error', (e)=>{
      callback(e)
    })

    req.write(stringPayload)

    req.end()

  } else {
    callback('Given parmas missing or invalid')
  }
}
// Export the module
module.exports = helpers;