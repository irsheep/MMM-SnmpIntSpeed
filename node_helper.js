var NodeHelper = require("node_helper")
var fs = require('fs')
var snmp = require('net-snmp')

var community = null
var host = null
var index = null

var options = {
  port: 161,
  retries: 1,
  timeout: 5000,
  transport: "udp4",
  trapPort: 162,
  version: snmp.Version2c,
  idBitsSize: 16
}

var oid2mib = {
  '1.3.6.1.2.1.2.2.1.2': 'ifDescr',
  '1.3.6.1.2.1.2.2.1.7': 'ifAdminStatus',
  '1.3.6.1.2.1.2.2.1.8': 'ifOperStatus',
  '1.3.6.1.2.1.31.1.1.1.1': 'ifName',
  '1.3.6.1.2.1.31.1.1.1.15': 'ifHighSpeed',
  '1.3.6.1.2.1.31.1.1.1.18': 'ifAlias',

  '1.3.6.1.2.1.31.1.1.1.6': 'ifHCInOctets',
  '1.3.6.1.2.1.31.1.1.1.10': 'ifHCOutOctets',

  '1.3.6.1.2.1.31.1.1.1.7': 'ifHCInUcastPkts',
  '1.3.6.1.2.1.31.1.1.1.11': 'ifHCOutUcastPkts',

  '1.3.6.1.2.1.31.1.1.1.8': 'ifHCInMulticastPkts',
  '1.3.6.1.2.1.31.1.1.1.12': 'ifHCOutMulticastPkts',

  '1.3.6.1.2.1.31.1.1.1.9': 'ifHCInBroadcastPkts',
  '1.3.6.1.2.1.31.1.1.1.13': 'ifHCOutBroadcastPkts',

  '1.3.6.1.2.1.2.2.1.13': 'ifInDiscards',
  '1.3.6.1.2.1.2.2.1.19': 'ifOutDiscards',

  '1.3.6.1.2.1.2.2.1.14': 'ifInErrors',
  '1.3.6.1.2.1.2.2.1.20': 'ifOutErrors'
}

var config = {}
var snmpData = {}

var session = null

var maxRepetitions = 20
var poolerThreadCount = 0
var isPoolerRunning = false
var interval = 0
//
module.exports = NodeHelper.create({
  start: function(){
      console.log(this.name + ' helper started ...')
  },
  socketNotificationReceived : function(notification, payload){
    if ( notification == "SNMP_POOL_SERVERS") {
      ConfigureSnmp(payload.config)
      if (!isPoolerRunning) { SnmpWalk(this) }
    }
  }
})

function ConfigureSnmp(config) {
  host = config.host
  community = config.community
  if (config.version == 1 ) {
    options.version = snmp.Version1
  } else {
    options.version = snmp.Version2c
  }
  index = config.index
  interval = config.interval
}

/**
* Calculates a rate difference between two values
*
* @param {integer} latest the latest recived value
* @param {integer} previous the previous received value
* @param {integer} timeElapsed the time difference in seconds between both values
* @return {integer} a value with a rate between both value
*/
function GetSpeed(latest, previous, timeElapsed) {
  var x = (latest - previous) / timeElapsed
  x = Math.round(x, 2)
  return x*8
}


/**
* Reads the last saved data, if possible, and compares it against the latest
* pooled data, returning the download and upload differece between the two pools
*
* @return {object} an object with the download and upload data
*/
function PrepareData() {
  var dataPath = __dirname+"/data"
  var dataFile = dataPath+"/snmp.json"
  var live = snmpData
  var liveData = snmpData[host][index]

  // Load previous pooled data and replace with the updated data
  if (fs.existsSync(dataFile)) {
    savedJson = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  } else {
    savedJson = []
    savedJson[host] = []
    savedJson[host][index] = 0
  }

  // Return 0's if there was no previous data, or the speeds would make no sense
  if (savedJson === 'undefined') { return {download: 0, upload: 0} }
  savedData = savedJson[host][index]

  if ( (liveData.timestamp - savedData.timestamp) / 1000 <= interval ) {
    return {download: savedData.lastbw.inBits, upload: savedData.lastbw.outBits, highSpeed: savedData.lastbw.ifspeed}
  }

  // Calculates download and upload speeds based on difference between pools
  if (liveData.timestamp !== 'undefined' || savedData.timestamp !== 'undefined') {
    timeDelta = ((liveData.timestamp - savedData.timestamp) / 1000)
    inBits = GetSpeed(liveData.ifHCInOctets, savedData.ifHCInOctets, timeDelta)
    outBits = GetSpeed(liveData.ifHCOutOctets, savedData.ifHCOutOctets, timeDelta)
    // console.log("out: " + outBits + "\tin: " +  inBits + "\tdelta: "+timeDelta + "\tliveTimestamp: " + liveData.timestamp + "\tsavedTimeStamp: " + savedData.timestamp)
  }

  snmpData[host][index]["lastbw"] = {}
  snmpData[host][index]["lastbw"]["inBits"] = inBits
  snmpData[host][index]["lastbw"]["outBits"] = outBits
  snmpData[host][index]["lastbw"]["ifspeed"] = liveData.ifHighSpeed*1024000

  if ( !fs.existsSync(dataPath) ) { fs.mkdirSync(dataPath) }
  fs.writeFileSync(dataFile, JSON.stringify(snmpData), 'utf8')


  return {download: inBits, upload: outBits, highSpeed: liveData.ifHighSpeed*1024000}
}

/**
* Walks through an array of OIDs
*
* @param  {object} obj the nodeJs object from the main application
* @return {void}
*/
function SnmpWalk(obj){
  // Create a session to pool data from the server and regirster two
  // events if there are any errors and when the session/socket is closed
  session = snmp.createSession (host, community, options)
  session.on ("error", function (error) {
    console.log (error.toString ())
    session.close ()
  })
  session.on("close", function(error) {
    isPoolerRunning = false
    obj.sendSocketNotification("SNMP_POOL_RESPONSE", PrepareData())
  })

  //  Walks through all the OID trees in the oids array
  var oids = (Object.keys(oid2mib)).length
  // poolerThreadCount = oids
  isPoolerRunning = true
  for ( i=0; i < oids; i++ ) {
    poolerThreadCount ++
    session.subtree ( (Object.keys(oid2mib))[i], maxRepetitions, feedCb, doneCb)
  }
}

/**
* Reports any error messages with the session and closes it.
* this is triggered when when the session.subtree has completed
* pooling the SNMP tree
*
* @param {object} error An object with the error information
* @return {void} nothing
*/
function doneCb(error) {
  if (error) console.log(error)
  poolerThreadCount --
  if (poolerThreadCount==0) {
    isPoolerRunning = false
    session.close()
  }
}

/**
* Called after net-snmp received data from the server
*
* @param {object} res an object with the results of 'walking' the SNMP tree
* @return {void}
*/
function feedCb(res) {
  for (i=0; i<res.length; i++) {
    var oidArray = res[i].oid.split('.')
    var idx = oidArray.pop()
    var oid = oidArray.join('.')

    // Add a space in the array for the host if it doesn't exists already
    if (typeof(snmpData[host]) === 'undefined')  snmpData[host] = { }

    // As per NET-SNMP documentation, check if there are any errors
    if (snmp.isVarbindError (res[i])) console.error (snmp.varbindError (res[i]))

    // Add the interface index to the SNMP data array
    if (typeof(snmpData[host][idx]) === 'undefined')  snmpData[host][idx] = { }

    // Add a timestamp record to the SNMP data array and store the pooled
    // SNMP value, and convert the OID to it friendly name
    snmpData[host][idx]['timestamp'] = + new Date()
    snmpData[host][idx][oid2mib[oid]] = ConvertBuffer(res[i]) //.toString()
  }
}


/**
* Converts a buffer to human readable getNext
* TODO: This requires a better implementation
*
* @param  {object} snmpObj an object from a snmp query
* @return {void}
*/
function ConvertBuffer(snmpObj) {
  if (snmpObj.type == 4) {return snmpObj.value.toString()}
  if (snmpObj.type == 2 ) { return snmpObj.value }
  if (snmpObj.type == 62 ) { return snmpObj.value }
  if (snmpObj.type == 65 ) { return snmpObj.value }
  if (snmpObj.type == 66 ) { return snmpObj.value }
  if (snmpObj.type == 70 ) {
    var buf = new Buffer.alloc(4)
    buf.write(snmpObj.value.toString(), 0)
    return parseInt(snmpObj.value.toString('hex'), 16)
  }
}
