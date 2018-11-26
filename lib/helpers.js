const config = require('./config');
const crypto = require('crypto');
const https = require('https')
const queryString = require('querystring')
const path = require('path')
const fs = require('fs')
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

    req.on('error', (e) => {
      callback(e)
    })

    req.write(stringPayload)

    req.end()

  } else {
    callback('Given parmas missing or invalid')
  }
}
//return interpolated html
helpers.getTemplate = (templateName, data, callback) => {
  templateName = typeof (templateName) == 'string' && templateName.length > 0 ? templateName : false
  data = typeof (data) == 'object' && data !== null ? data : {}
  if (templateName && data) {
    const templateDir = path.join(__dirname, '/../templates/')
    fs.readFile(templateDir + templateName + '.html', 'utf8', (err, str) => {
      if (!err && str && str.length > 0) {
        //Do interpolitaing
        const finalString = helpers.interpolate(str, data)
        callback(false, finalString)
      } else {
        callback('No template found')
      }
    })
  } else {
    callback('a valid template name was not specifed')
  }
}

helpers.addUniversalTemplates = (str, data, callback) => {
  str = typeof (str) == 'string' && str.length > 0 ? str : ''
  data = typeof (data) == 'object' && data !== null ? data : {}
  //Get the header
  helpers.getTemplate('_header', data, (err, headerString) => {
    if (!err && headerString) {
      helpers.getTemplate('_footer', data, (err, footerString) => {
        if (!err && footerString) {
          //add string all togther
          const fullString = headerString + str + footerString
          callback(false, fullString)
        } else {
          callback('Could not find the footer template')
        }
      })
    } else {
      callback('Could not find the header template')
    }
  })
}

helpers.interpolate = (str, data) => {
  str = typeof (str) == 'string' && str.length > 0 ? str : ''
  data = typeof (data) == 'object' && data !== null ? data : {}

  for (let keyName in config.templateGlobals) {
    if (config.templateGlobals.hasOwnProperty(keyName)) {
      data['global.' + keyName] = config.templateGlobals[keyName]
    }
  }

  //insert into the string
  for (let key in data) {
    if (data.hasOwnProperty(key) && typeof (data[key]) == 'string') {
      let replace = data[key]
      let find = '{' + key + '}'
      str = str.replace(find, replace)
    }
  }
  return str
}
// Export the module
module.exports = helpers;