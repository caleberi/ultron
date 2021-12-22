#!/usr/bin/env node
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers');
const { alias } = require('yargs');
const cli = yargs(hideBin(process.argv));

/**
 * Register necessary commands for cli useage 
 * for more information : https://github.com/yargs/yargs
 */

cli 
.usage('Usage: $0 -w [num] -h [num]')
.option('src', {
    alias: 'source',
    demandOption: true,
    default: '.',
    describe: 'source folder path to process',
    type: 'string'
}).option('ft',{
    alias:'filters',
    demandOption:false,
    describe:"List of filter for the file type to include",
    type:"array"
}).option('dest', {
    alias: 'destination',
    demandOption: false,
    default: 'out',
    describe: 'destination folder path to write out to',
    type: 'string'
}).option('t', {
    alias: 'timeout',
    demandOption: false,
    default: 10000,
    describe: 'maximum time to use to process before existing',
    type: "number"
})
.demandOption(['src'], 'Please provide both run and path arguments to work with this tool')
.help()
.argv