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
                    fs.close(fileDescriptor, (err) => {
                        if (!err) {
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

lib.list = (includeCompressedLogs, callback) => {
    fs.readdir(lib.baseDir, (err, data) => {
        if (!err && data && data.length > 0) {
            const trimmedFileNames = []
            data.forEach(fileName => {
                //add the .log files
                if (fileName.indexOf('.log') > -1) {
                    trimmedFileNames.push(fileName.replace('.log', ''))
                }

                //Add on the .gz
                if (fileName.indexOf('.gz.b64') > -1 && includeCompressedLogs) {
                    trimmedFileNames.push(fileName.replace('.gz.b64', ''))
                }
            })
            callback(false, trimmedFileNames)
        } else {
            callback(err, data)
        }
    })
}

//compress the content on .log into .gz.b64 file within the same directory

lib.compress = (logId, newFileId, callback) => {
    const sourceFile = logId + '.log'
    const destinationFile = newFileId + '.gz.b64'

    //read source file
    fs.readFile(lib.baseDir + sourceFile, 'utf8', (err, inputString)=>{
        if(!err && inputString){
            zlib.gzip(inputString, (err, buffer)=>{
                if(!err && buffer){
                    //send the data to destination file
                    fs.open(lib.baseDir + destinationFile, 'wx', (err, fileDescriptor)=>{
                        if(!err && fileDescriptor){
                            fs.writeFile(fileDescriptor, buffer.toString('base64'), (err)=>{
                                if(!err){
                                    //close destination file
                                    fs.close(fileDescriptor, (err)=>{
                                        if(!err){
                                            callback(false)
                                        } else {
                                            callback(err)
                                        }
                                    })
                                } else {
                                    callback(err)
                                }
                            })
                        } else {
                            callback(err)
                        }
                    })
                } else {
                    callback(err)
                }
            })
        } else {
            callback(err)
        }

    })

}

//decompress content of gz.b64 into a string variable
lib.decompress = (fileId, callback)=>{
    const fileName = fileId + '.gz.b64'
    fs.read(lib.baseDir + fileName,'utf8',  (err, string)=>{
        if(!err && str){
            const inputBuffer = Buffer.from(str)
            zlib.unzip(inputBuffer, (err, outputBuffer)=>{
                if(!err && outputBuffer){
                    const str = outputBuffer.toString()
                    callback(false, str)
                } else {
                    callback(err)
                }
            })
        } else {
            callback(err)
        }
    })
}

//truncating a log file

lib.truncate = (logId, callback)=>{
    fs.truncate(lib.baseDir+logId+'.log', (err)=>{
        if(!err){
            callback(false)
        } else {
            callback(err)
        }
    })
}

module.exports = lib