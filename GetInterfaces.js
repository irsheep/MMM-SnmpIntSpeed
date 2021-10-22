var snmp = require('net-snmp')

const versioni = process.argv.indexOf("--version")
const communityi = process.argv.indexOf("--community")
const hosti = process.argv.indexOf("--host")
const helpi = process.argv.indexOf("--help")

const oid2mib = {
    '1.3.6.1.2.1.2.2.1.2': 'ifDescr',
    '1.3.6.1.2.1.31.1.1.1.1': 'ifName',
    '1.3.6.1.2.1.31.1.1.1.18': 'ifAlias',
    '1.3.6.1.2.1.2.2.1.5': 'ifSpeed',
    '1.3.6.1.2.1.31.1.1.1.15': 'ifHighSpeed',
    '1.3.6.1.2.1.31.1.1.1.6': 'ifHCInOctets',
    '1.3.6.1.2.1.31.1.1.1.10': 'ifHCOutOctets'
}

var options = {
    port: 161,
    retries: 1,
    timeout: 5000,
    transport: "udp4",
    trapPort: 162,
    version: snmp.Version2c,
    idBitsSize: 16
}

var version = null
var community = null
var host = null

var maxRepetitions = 20
var poolerThreadCount = 0
var isPoolerRunning = false

var snmpData = {}

if (helpi != -1) {
    console.log("Usage: node GetInterfaces.js --version [1|2] --community snmpCommunity --host host")
    console.log("--version snmpVersion this can be 1 or 2. SNMP version 3 isn't supported")
    console.log("--community snmp community")
    console.log("--host the host to pool SNMP data from")
    console.log("--help show this information")
    return
}

if (versioni == -1 && communityi == -1 && hosti == -1) {
    mmconf = require("../../config/config.js")

    for (i = 0; i < mmconf.modules.length; i++) {
        if (mmconf.modules[i].module == "MMM-SnmpIntSpeed") {
            console.log("gotyou")
            config = mmconf.modules[i].config
            version = config.versioni
            community = config.community
            host = config.host
        }
    }
    if (typeof(config) === 'undefined') {
        console.log("Unable to find MMM-SnmpIntSpeed configuration in MagicMirror config.js file.")
        console.log("Either configure MagicMirror to run this module or pass the required arguments")
        console.log("Run node GetInterfaces.js --help for mode information")
        return
    }
} else if (versioni == -1 || communityi == -1 || hosti == -1) {
    console.log("Invalid arguments")
    console.log("Run node GetInterfaces.js --help for mode information")
    return
} else {
    version = process.argv[versioni + 1]
    community = process.argv[communityi + 1]
    host = process.argv[hosti + 1]
}

session = snmp.createSession(host, community, options)
session.on("error", function(error) {
    console.log(error.toString())
    session.close()
})
session.on("close", function(error) {
    isPoolerRunning = false
    console.log(snmpData)
})

//  Walks through all the OID trees in the oids array
var oids = (Object.keys(oid2mib)).length
    // poolerThreadCount = oids
isPoolerRunning = true
for (i = 0; i < oids; i++) {
    poolerThreadCount += 1
    session.subtree((Object.keys(oid2mib))[i], maxRepetitions, feedCb, doneCb)
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
    poolerThreadCount--
    if (poolerThreadCount == 0) {
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
    for (i = 0; i < res.length; i++) {
        var oidArray = res[i].oid.split('.')
        var idx = oidArray.pop()
        var oid = oidArray.join('.')

        // As per NET-SNMP documentation, check if there are any errors
        if (snmp.isVarbindError(res[i])) console.error(snmp.varbindError(res[i]))

        // Add the interface index to the SNMP data array, and store the data received
        if (typeof(snmpData[idx]) === 'undefined') snmpData[idx] = {}
        snmpData[idx][oid2mib[oid]] = ConvertBuffer(res[i])
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
    if (snmpObj.type == 4) { return snmpObj.value.toString() }
    if (snmpObj.type == 2) { return snmpObj.value }
    if (snmpObj.type == 62) { return snmpObj.value }
    if (snmpObj.type == 65) { return snmpObj.value }
    if (snmpObj.type == 66) { return snmpObj.value }
    if (snmpObj.type == 70) {
        var buf = new Buffer.alloc(4)
        buf.write(snmpObj.value.toString(), 0)
        return parseInt(snmpObj.value.toString('hex'), 16)
    }
}