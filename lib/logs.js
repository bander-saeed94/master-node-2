const fs = require('fs')
const path = require('path')
const zlib = require('zlib')


const lib = {}

lib.baseDir = path.join(__dirname, '/../.logs/')

lib.append = (filename, str, callback) => {
    //open file
    fs.open(lib.baseDir + filename + '.log', 'a', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            //append and then close it
            fs.appendFile(fileDescriptor, str + '\n', (err) => {
                if (!err) {
                    fs.close(fileDescriptor, (err)=>{
                        if(!err){
                            callback(false)
                        } else {
                            callback('error closing file that was being appended')
                        }
                    })
                } else {
                    callback('Error appending to file')
                }
            })
        } else {
            callback('Could not open file for appending')
        }
    })
}

module.exports = lib