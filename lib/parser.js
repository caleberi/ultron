const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const converter =  require("convert-excel-to-json");

/**
 * Writes data to a file syncronously
 * @param {*} data buffer to write to file as json
 * @param {*} filename name of the origina file
 * @param {*} destination path to add all the parsed file
 * @param {*} cb callback
 */
function writeFileToDirectory(data, filename, destination, cb){
    let outputPath = path.join(destination,filename);
    fs.writeFileSync(outputPath, JSON.stringify(data,null,"\t"), function(err){
        if(!err){
            return cb(null,{code:200,message:"SUCCESS"})
        }
        return cb(err,{code:500,message:"FAILURE"})
    })
}

/**
 * Process a file with `.xlsx` to `.json`
 * @param {*} inputFilePath the path currently been processed
 * @param {*} outputFilePath the path to write output to
 */
function processXLSXFileToJson(inputFilePath,outputFilePath){
    if (fs.existsSync(inputFilePath)){
        let result = converter({ 
            source: fs.readFileSync(inputFilePath),
            header:{
                rows: 1
            }
        });
        let fragment = path.basename(inputFilePath).split(".");
        let filename = fragment[0]+".json"
        function callback(err,info){
            if(err){
                console.log(info)
                throw err
            }
            console.log(info);
        }
        let dirpath = path.resolve(outputFilePath);
        if(!fs.existsSync(dirpath)){
            fs.mkdirSync(dirpath,{recursive:true});
        }
        writeFileToDirectory(result,filename,dirpath,callback);
    }
}

/**
 * Filters away path with some specific extension
 * @param {*} filepaths  array of filepath to filter
 * @param {*} extension the extension to filter for
 * @returns 
 */
function filterPathForExtension(filepaths,extensions){
    return filepaths.filter(function(p){
        let ext = path.extname(p);
        return (extensions.includes(ext)) ? true : false;
    })
}


/**
 * Retrieves all the possible path in this `src` directory
 * @param {*} src the original source path to start parsing `.xlsx` files
 * @returns 
 */
function RetrieveAllPathInFolder(src){
    let queue =  [src]
    let result = []
    while(queue.length){
        let curr = queue.pop()
        queue = ProcessPath(curr,result,queue)
    }
    return result
}

/**
 * Process all path in association with this `src` path 
 * @param {*} src the original source path to start parsing `.xlsx` files
 * @param {*} result all possible path in current `src` path
 * @param {*} queue the processing queue
 * @returns 
 */
function ProcessPath(src,result,queue){
    let files = fs.statSync(src).isDirectory() ? 
                    fs.readdirSync(src):null;
    if(_.isNull(files))
        throw new Error(`${src} is not a directory`)
    let basepath = path.resolve(src)
    files.forEach(function(file){
        let filepath =  path.join(basepath,file)
        if(fs.statSync(filepath).isDirectory()){
            if(!path.basename(filepath)!= ".git"||!path.basename(filepath)!= "node_modules"){
                queue.unshift(filepath)
                return
            }
        }
        result.push(filepath)
    })
    return queue
}

function Parser(src,filters=[".xlsx",".xls"]){
    return filterPathForExtension(
        RetrieveAllPathInFolder(src),filters
    );
}

module.exports = {
    Parser,
    processXLSXFileToJson
}