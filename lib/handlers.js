
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config')
// Define all the handlers
const handlers = {};


/**
 * HTML handlers
 */
handlers.index = (data, callback) => {
  //prepare data for interpolation
  const templateData = {
    'head.title': 'This is the title',
    'head.description': 'This is the meta description',
    'body.title': 'Hello templated world!',
    'body.class': 'index'
  }

  if (data.method == 'get') {
    helpers.getTemplate('index', templateData, (err, str) => {
      if (!err && str) {
        //add the universal header and footer
        helpers.addUniversalTemplates(str, templateData, (err, str) => {
          if (!err && str) {
            callback(200, str, 'html')
          } else {
            callback(500, undefined, 'html')
          }
        })
      } else {
        callback(500, undefined, 'html')
      }
    })
  } else {
    callback(405, undefined, 'html')
  }
}

handlers.favicon = (data, callback) => {
  if (data.method == 'get') {
    //read in the favicon data
    helpers.getStaticAsset('favicon.ico', (err, data) => {
      if (!err && data) {
        callback(200, data, 'favicon')
      } else {
        callback(500)
      }
    })
  } else {
    callback(405)
  }
}

handlers.public = (data, callback) => {
  if (data.method == 'get') {
    //get the actaul filename requested
    const trimmedAssetName = data.trimmedPath.replace('public/', '').trim()
    if(trimmedAssetName.length > 0){
      helpers.getStaticAsset(trimmedAssetName, (err, data) => {
        if(!err && data) {
          //determine the content type
          let contentType = 'plain'
          if(trimmedAssetName.indexOf('.css') > -1){
            contentType = 'css'
          }

          if(trimmedAssetName.indexOf('.png') > -1){
            contentType = 'png'
          }

          if(trimmedAssetName.indexOf('.jpg') > -1){
            contentType = 'jpg'
          }

          if(trimmedAssetName.indexOf('.ico') > -1){
            contentType = 'favicon'
          }
          callback(200, data, contentType)
        } else {
          callback(404)
        }
      })
    } else {
      callback(404)
    }
  } else {
    callback(405)
  }
}

/***
 * API handlers
 */
// Ping
handlers.ping = (data, callback) => {
  callback(200);
};

// Not-Found
handlers.notFound = (data, callback) => {
  callback(404);
};

// Users
handlers.users = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the users methods
handlers._users = {};

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = (data, callback) => {
  // Check that all required fields are filled out
  const firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  const lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  const phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
  const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  const tosAgreement = typeof (data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure the user doesnt already exist
    _data.read('users', phone, function (err, data) {
      if (err) {
        // Hash the password
        const hashedPassword = helpers.hash(password);

        // Create the user object
        if (hashedPassword) {
          const userObject = {
            firstName,
            lastName,
            phone,
            hashedPassword,
            'tosAgreement': true
          };

          // Store the user
          _data.create('users', phone, userObject, (err) => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { 'Error': 'Could not create the new user' });
            }
          });
        } else {
          callback(500, { 'Error': 'Could not hash the user\'s password.' });
        }

      } else {
        // User alread exists
        callback(400, { 'Error': 'A user with that phone number already exists' });
      }
    });

  } else {
    callback(400, { 'Error': 'Missing required fields' });
  }

};

// Required data: phone
// Optional data: none
handlers._users.get = (data, callback) => {
  // Check that phone number is valid
  const phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
  if (phone) {
    // Lookup the user

    //check token
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false
    handlers._tokens.verifyToken(token, phone, (tokenIdValid) => {
      if (tokenIdValid) {
        //looking the user
        _data.read('users', phone, (err, data) => {
          if (!err && data) {
            // Remove the hashed password from the user user object before returning it to the requester
            delete data.hashedPassword;
            callback(200, data);
          } else {
            callback(404);
          }
        })
      } else {
        callback(403, { 'Error': 'Missing required token in header, or invalid' })
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' })
  }
};

// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
// @TODO Only let an authenticated user up their object. Dont let them access update elses.
handlers._users.put = (data, callback) => {
  // Check for required field
  const phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;

  // Check for optional fields
  const firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  const lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  // Error if phone is invalid
  if (phone) {
    // Error if nothing is sent to update
    if (firstName || lastName || password) {

      const token = typeof (data.headers.token) == 'string' ? data.headers.token : false
      handlers._tokens.verifyToken(token, phone, (tokenIdValid) => {
        if (tokenIdValid) {
          // Lookup the user
          _data.read('users', phone, (err, userData) => {
            if (!err && userData) {
              // Update the fields if necessary
              if (firstName) {
                userData.firstName = firstName;
              }
              if (lastName) {
                userData.lastName = lastName;
              }
              if (password) {
                userData.hashedPassword = helpers.hash(password);
              }
              // Store the new updates
              _data.update('users', phone, userData, (err) => {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, { 'Error': 'Could not update the user.' });
                }
              });
            } else {
              callback(400, { 'Error': 'Specified user does not exist.' });
            }
          })
        } else {
          callback(403, { 'Error': 'Missing required token in header, or invalid' })
        }
      })
    } else {
      callback(400, { 'Error': 'Missing fields to update.' });
    }
  } else {
    callback(400, { 'Error': 'Missing required field.' });
  }

};

// Required data: phone
// @TODO Only let an authenticated user delete their object. Dont let them delete update elses.
handlers._users.delete = (data, callback) => {
  // Check that phone number is valid
  const phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
  if (phone) {

    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false
    handlers._tokens.verifyToken(token, phone, (tokenIdValid) => {
      if (tokenIdValid) {
        // Lookup the user
        _data.read('users', phone, (err, userData) => {
          if (!err && userData) {
            _data.delete('users', phone, (err) => {
              if (!err) {
                //delete checks related
                const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : []
                const checksToDelete = userChecks.length
                if (checksToDelete > 0) {
                  let checksDeleted = 0
                  let deletionErrors = false

                  userChecks.forEach(checkId => {
                    _data.delete('checks', checkId, (err) => {
                      if (err) {
                        deletionErrors = true
                      }
                      checksDeleted++
                      if (checksDeleted == checksToDelete) {
                        if (!deletionErrors) callback(200)
                        else callback(500, { 'Error': 'when trying to delete associated checks' })
                      }
                    })
                  });
                } else {
                  callback(200)
                }
              } else {
                callback(500, { 'Error': 'Could not delete the specified user' });
              }
            });
          } else {
            callback(400, { 'Error': 'Could not find the specified user.' });
          }
        })
      } else {
        callback(403, { 'Error': 'Missing required token in header, or invalid' })
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' })
  }
};

// Tokens
handlers.tokens = (data, callback) => {
  var acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};
handlers._tokens = {}

//required field: phone, password
handlers._tokens.post = (data, callback) => {
  const phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
  const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  if (phone && password) {
    _data.read('users', phone, (err, userData) => {
      if (!err && userData) {
        //hash the sent password
        const hashPass = helpers.hash(password)
        if (hashPass == userData.hashedPassword) {
          //create a token
          const tokenId = helpers.createRandomString(20)
          const expires = Date.now() + 1000 * 60 * 60
          const tokenObject = {
            phone,
            'id': tokenId,
            expires
          }
          _data.create('tokens', tokenId, tokenObject, (err) => {
            if (!err) {
              callback(200, tokenObject)
            } else {
              callback(400, { 'Error': 'Could not create the new token' })
            }
          })
        } else {
          callback(400, { 'Error': 'Password did not match the specified user' })
        }
      } else {
        callback(400, { 'Error': 'could not find the specified user' })
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' })
  }
}

//requiresd: id
handlers._tokens.get = (data, callback) => {
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    _data.read('tokens', id, (err, tokenData) => {
      if (!err && tokenData) {
        callback(200, tokenData)
      } else {
        callback(404)
      }
    })

  } else {
    callback(400, { 'Error': 'Missing required field' })
  }
}

//required field: id, extend
handlers._tokens.put = (data, callback) => {
  const id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
  const extend = typeof (data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
  if (id && extend) {
    _data.read('tokens', id, (err, tokenData) => {
      if (!err && tokenData) {
        //make sure the token is active
        if (tokenData.expires > Date.now()) {
          tokenData.expires = Date.now() + 1000 * 60 * 60
          //store
          _data.update('tokens', id, tokenData, (err) => {
            if (!err) {
              callback(200)
            } else {
              callback(500, { 'Error': 'Could not update the token expiration' })
            }
          })
        } else {
          callback(400, { 'Error': 'Expired token can not be extend' })
        }
      } else {
        callback(400, { 'Error': 'Specified token does not exist' })
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field(s) or field(s) invalid' })
  }
}

//required data:id
//optinal: none
handlers._tokens.delete = (data, callback) => {
  // Check that phone number is valid
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Lookup the user
    _data.read('tokens', id, (err, data) => {
      if (!err && data) {
        _data.delete('tokens', id, (err) => {
          if (!err) {
            callback(200);
          } else {
            callback(500, { 'Error': 'Could not delete the specified token' });
          }
        });
      } else {
        callback(400, { 'Error': 'Could not find the specified token.' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required field' })
  }
}

//verify if token valid

handlers._tokens.verifyToken = (id, phone, callback) => {
  _data.read('tokens', id, (err, tokenData) => {
    if (!err && tokenData) {
      if (tokenData.phone == phone && tokenData.expires > Date.now()) {
        callback(true)
      } else {
        callback(false)
      }
    } else {
      callback(false)
    }
  })
}


// Tokens
handlers.checks = (data, callback) => {
  var acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};
handlers._checks = {}

//required field data: protocol, url, method, successCodes, timeoutSeconds
//optinal: none
handlers._checks.post = (data, callback) => {
  const protocol = typeof (data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
  const url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  const method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
  const successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  const timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false


  if (protocol && url && method && successCodes && timeoutSeconds) {
    //check token
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false
    _data.read('tokens', token, (err, tokenData) => {
      if (!err && tokenData) {
        const userPhone = tokenData.phone
        //lookup user data
        _data.read('users', userPhone, (err, userData) => {
          if (!err && userData) {
            const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : []

            if (userChecks.length < config.maxChecks) {
              //random id for checks
              const checkId = helpers.createRandomString(20)
              const checkObject = {
                'id': checkId,
                userPhone,
                protocol,
                url,
                method,
                successCodes,
                timeoutSeconds
              }
              _data.create('checks', checkId, checkObject, (err) => {
                if (!err) {
                  userData.checks = userChecks
                  userData.checks.push(checkId)

                  _data.update('users', userPhone, userData, (err) => {
                    if (!err) {
                      callback(200, checkObject)
                    } else {
                      callback(500, { 'Error': 'could not update the user with the new check' })

                    }
                  })
                } else {
                  callback(500, { 'Error': 'could not create the new check' })
                }
              })
            } else {
              callback(400, { 'Error': `User already have the max number of checks ${config.maxChecks}` })
            }
          } else {
            callback(403)
          }
        })
      } else {
        callback(403)
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required inputs, or inputs is invalid' })
  }
}

//required data: id
handlers._checks.get = (data, callback) => {
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;

  if (id) {

    _data.read('checks', id, (err, checkData) => {
      if (!err && checkData) {
        const token = typeof (data.headers.token) == 'string' ? data.headers.token : false
        handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIdValid) => {
          if (tokenIdValid) {
            //looking the user
            _data.read('checks', id, (err, checkData) => {
              if (!err && checkData) {
                callback(200, checkData);
              } else {
                callback(404);
              }
            })
          } else {
            callback(403, { 'Error': 'Missing required token in header, or invalid' })
          }
        })
      } else {
        callback(404)
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' })
  }
}

//Checks - put
//required: id
//optinal: protocol, url, method, successCodes, timeoutSeconds(one at leaset)
handlers._checks.put = (data, callback) => {

  const id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

  const protocol = typeof (data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
  const url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  const method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
  const successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  const timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false

  if (id) {
    if (protocol || url || method || successCodes || timeoutSeconds) {

      _data.read('checks', id, (err, checkData) => {
        if (!err && data) {
          //check token
          const token = typeof (data.headers.token) == 'string' ? data.headers.token : false
          handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIdValid) => {
            if (tokenIdValid) {
              if (protocol) checkData.protocol = protocol
              if (url) checkData.url = url
              if (method) checkData.method = method
              if (successCodes) checkData.successCodes = successCodes
              if (timeoutSeconds) checkData.timeoutSeconds = timeoutSeconds
              _data.update('checks', id, checkData, (err) => {
                if (!err) callback(200)
                else callback(500, { 'Error': 'Could not update the check' })
              })
            } else {
              callback(403, { 'Error': 'Missing required token in header, or invalid' })
            }
          })
        } else {
          callback(404, { 'Error': 'Check Id did not found' })
        }
      })
    } else {
      callback(400, { 'Error': 'Missing field(s) to update' })
    }
  } else {
    callback(400, { 'Error': 'Missing required field' })
  }
}



//checks - delete
//required: id
handlers._checks.delete = (data, callback) => {
  // Check that phone number is valid
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {

    _data.read('checks', id, (err, checkData) => {
      if (!err && checkData) {

        const token = typeof (data.headers.token) == 'string' ? data.headers.token : false
        handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIdValid) => {
          if (tokenIdValid) {
            // delete the check data
            _data.delete('checks', id, (err) => {
              if (!err) {
                _data.read('users', checkData.userPhone, (err, userData) => {
                  if (!err && userData) {
                    const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : []
                    const checkIdPos = userChecks.indexOf(id)
                    if (checkIdPos > -1) {
                      userChecks.splice(checkIdPos, 1)
                      userData.checks = userChecks
                      _data.update('users', checkData.userPhone, userData, (err) => {
                        if (!err) {
                          callback(200)
                        } else {
                          callback(500, { 'Error': 'could not update the user object' })
                        }
                      })
                    } else {
                      callback(500, { 'Error': 'could not find the check on the user object' })
                    }
                  } else {
                    callback(500, { 'Error': 'Could not find the user who created the check to delete the check id ref' })
                  }
                })
              } else {
                callback(500, { 'Error': 'Could not delete the check' })
              }
            })
          } else {
            callback(403, { 'Error': 'Missing required token in header, or invalid' })
          }
        })
      } else {
        callback(404, { 'Error': 'Check Id did not' })
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' })
  }
}


// Export the handlers
module.exports = handlers;
