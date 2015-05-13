var logentries = require('le_node');
var winston = require('winston');
var log = logentries.logger({
  token: process.env.LOG_ENTRIES_TOKEN
});

winston.cli();
log.winston(winston);
module.exports = winston;