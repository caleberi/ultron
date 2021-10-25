const worker_threads = require("worker_threads");
const os =  require("os");
const _ = require("lodash");
const { Parser, processXLSXFileToJson } = require("./lib/parser");
const amqp = require('amqplib/callback_api');
const queue = "xlsx_json";
const path = require("path");
const fs = require("fs");
if(!fs.existsSync(path.join(__dirname,`logs.out`))){
    fs.writeFileSync(path.join(__dirname,`logs.out`),"",null);
}
const logger = fs.createWriteStream(path.join(__dirname,`logs.out`),{flags:"r+"});

/**
 * Processes cli arguments into options object
 * @param {*} args  argument to use in building the opts
 * @returns {object} options filled object
 */
function buildOptions(args){
    let opts = {};
    _.forEach(args,(arg)=>{
        if(arg.startsWith("--")){
            let [opt,val] = arg.split("=");
            if(!_.has(opts,opt)){
                if(opt=="--src")
                    opts[opt]=val;
                else if(opt=="--destination")
                    opts[opt]=val;
                else if(opt== "--filter")
                    opts[opt]=JSON.parse(val);
                else
                    opts[opt]=JSON.parse(val);
            }
        }
    });
    return opts;
}

/**
 * Yields each chunk of data from a input array
 * @param {*} data  array of items that need to be broken into chunks
 * @returns {Array} 
 */
 function generateChunks(data,length){
    let chunks = _.chunk(data,length)
    return function* (data){
        try{
            for (let idx = 0; idx < data.length; idx++) {
                yield data[idx];                
            }
        }catch(err){
            throw err;
        }
    }(chunks);
}



( 
    /**
    *  if we are in the main thread , we need to get the cpu core number to use
    *  in managing the processing each entry in the parsed result of type `{path:"./example.xlxs"}`
    *  
    * 
    **/
    function delegateChunkToTask(args){
    let opts = buildOptions(args);
    let isMainThread = worker_threads.isMainThread;
    let cpus =  _.isEqual(os.cpus(),0)?2:os.cpus().length/2;
    if(isMainThread){
        // create  a producer in this block  using worker api
        
        amqp.connect("amqp://localhost:5672",function publisher(err, conn) {
            if (err)
              throw {err:err,msg:"CONNECTION FAILURE"};
            conn.createChannel(function(err, channel) {
                if(err)
                    throw {err:err,msg:"CHANNEL CREATION FAILURE"};
                let paths =  Parser(opts["--src"],opts["--filters"]);
                let chunkified = generateChunks(paths,opts["--length"]);
                let itr =  chunkified.next();
                channel.assertQueue(queue,{durable:true});
                let cnt = 0 ;
                while(itr.done!=true){
                    let data = Buffer.from(JSON.stringify(itr.value));
                    channel.sendToQueue(queue,data,{persistent:false});
                    console.log(`Sending batch path {${cnt}} for proccessing ...`);
                    itr=chunkified.next();
                    cnt++;
                }
            });
            let tracker = [];

            for (let idx = 0; idx < cpus; idx++) {
                let worker  =  new worker_threads.Worker(
                                        __filename,
                                        {workerData:{dest:opts["--destination"]}});
                worker.on("message",(message)=>{
                    logger.write(message);
                    logger.write("\n");
                    console.log(message);
                }).on("exit",(code)=>{
                    console.log(`worker with ID:{${worker.threadId}} exited with code ${code}`);
                });
                tracker.push(worker);
            }

            setTimeout(function(){
                conn.close((err)=>{
                    if(err) throw {err:err,msg:"CONNECTION CLOSURE ERROR"};
                    console.log("Succesfully closed the queue connection");
                });
            },opts["--time"]);
        });
    }else{
        //implement consumer logic into of queue block
        const {parentPort,workerData} = worker_threads;
        amqp.connect("amqp://localhost:5672", function consumer(err,conn) {
            if (err) {
                throw err;
            }
            conn.createChannel(function(err, channel) {
                if (err)
                    throw err;

                channel.assertQueue(queue, {
                    durable:true
                })
                channel.consume(queue,function(msg){
                    if(!_.isNull(msg)){
                        const deserialized_msg = JSON.parse(msg.content.toString());
                        channel.ack(msg);
                        deserialized_msg.forEach((filepath)=>{
                            let startTime = Date.now();
                            processXLSXFileToJson(filepath,workerData.dest);
                            let finishTime = Date.now();
                            parentPort.postMessage(`Finished processing file with name ${filepath} `+
                            `in ${finishTime-startTime}`+` millisecond${(finishTime-startTime)>1?"s":""}`);
                        });
                    }
                    else{
                        console.log("Message was null");
                        channel.checkQueue(queue,function(err,queue){
                            if (err) {
                                throw err;
                            }
                            if(!queue.messageCount) channel.close()
                        })
                    }
                })
                setTimeout(function(){
                    conn.close((err)=>{
                        if(err) throw {err:err,msg:"CONNECTION CLOSURE ERROR"};
                        console.log("Succesfully closed the queue connection");
                    });
                },3000);
            });
        });
    }
})(process.argv.slice(1,process.argv.length));

