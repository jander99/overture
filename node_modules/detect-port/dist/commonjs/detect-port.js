"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPAddressNotAvailableError = void 0;
exports.detectPort = detectPort;
const node_net_1 = require("node:net");
const node_util_1 = require("node:util");
const address_1 = require("address");
const debug = (0, node_util_1.debuglog)('detect-port');
class IPAddressNotAvailableError extends Error {
    constructor(options) {
        super('The IP address is not available on this machine', options);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.IPAddressNotAvailableError = IPAddressNotAvailableError;
function detectPort(port, callback) {
    let hostname = '';
    if (port && typeof port === 'object') {
        hostname = port.hostname;
        callback = port.callback;
        port = port.port;
    }
    else {
        if (typeof port === 'function') {
            callback = port;
            port = void 0;
        }
    }
    port = parseInt(port) || 0;
    let maxPort = port + 10;
    if (maxPort > 65535) {
        maxPort = 65535;
    }
    debug('detect free port between [%s, %s)', port, maxPort);
    if (typeof callback === 'function') {
        return tryListen(port, maxPort, hostname)
            .then(port => callback(null, port))
            .catch(callback);
    }
    // promise
    return tryListen(port, maxPort, hostname);
}
async function handleError(port, maxPort, hostname) {
    if (port >= maxPort) {
        debug('port: %s >= maxPort: %s, give up and use random port', port, maxPort);
        port = 0;
        maxPort = 0;
    }
    return await tryListen(port, maxPort, hostname);
}
async function tryListen(port, maxPort, hostname) {
    // use user hostname
    if (hostname) {
        try {
            return await listen(port, hostname);
        }
        catch (err) {
            if (err.code === 'EADDRNOTAVAIL') {
                throw new IPAddressNotAvailableError({ cause: err });
            }
            return await handleError(++port, maxPort, hostname);
        }
    }
    // 1. check null / undefined
    try {
        await listen(port);
    }
    catch (err) {
        // ignore random listening
        if (port === 0) {
            throw err;
        }
        return await handleError(++port, maxPort, hostname);
    }
    // 2. check 0.0.0.0
    try {
        await listen(port, '0.0.0.0');
    }
    catch (err) {
        return await handleError(++port, maxPort, hostname);
    }
    // 3. check 127.0.0.1
    try {
        await listen(port, '127.0.0.1');
    }
    catch (err) {
        return await handleError(++port, maxPort, hostname);
    }
    // 4. check localhost
    try {
        await listen(port, 'localhost');
    }
    catch (err) {
        // if localhost refer to the ip that is not unknown on the machine, you will see the error EADDRNOTAVAIL
        // https://stackoverflow.com/questions/10809740/listen-eaddrnotavail-error-in-node-js
        if (err.code !== 'EADDRNOTAVAIL') {
            return await handleError(++port, maxPort, hostname);
        }
    }
    // 5. check current ip
    try {
        return await listen(port, (0, address_1.ip)());
    }
    catch (err) {
        return await handleError(++port, maxPort, hostname);
    }
}
function listen(port, hostname) {
    const server = (0, node_net_1.createServer)();
    return new Promise((resolve, reject) => {
        server.once('error', err => {
            debug('listen %s:%s error: %s', hostname, port, err);
            server.close();
            if (err.code === 'ENOTFOUND') {
                debug('ignore dns ENOTFOUND error, get free %s:%s', hostname, port);
                return resolve(port);
            }
            return reject(err);
        });
        debug('try listen %d on %s', port, hostname);
        server.listen(port, hostname, () => {
            port = server.address().port;
            debug('get free %s:%s', hostname, port);
            server.close();
            return resolve(port);
        });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV0ZWN0LXBvcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvZGV0ZWN0LXBvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBeUJBLGdDQTJCQztBQXBERCx1Q0FBcUQ7QUFDckQseUNBQXFDO0FBQ3JDLHFDQUE2QjtBQUU3QixNQUFNLEtBQUssR0FBRyxJQUFBLG9CQUFRLEVBQUMsYUFBYSxDQUFDLENBQUM7QUFVdEMsTUFBYSwwQkFBMkIsU0FBUSxLQUFLO0lBQ25ELFlBQVksT0FBc0I7UUFDaEMsS0FBSyxDQUFDLGlEQUFpRCxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7UUFDbEMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBTkQsZ0VBTUM7QUFLRCxTQUFnQixVQUFVLENBQUMsSUFBd0QsRUFBRSxRQUE2QjtJQUNoSCxJQUFJLFFBQVEsR0FBdUIsRUFBRSxDQUFDO0lBRXRDLElBQUksSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ3JDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3pCLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3pCLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ25CLENBQUM7U0FBTSxDQUFDO1FBQ04sSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUUsQ0FBQztZQUMvQixRQUFRLEdBQUcsSUFBSSxDQUFDO1lBQ2hCLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQztRQUNoQixDQUFDO0lBQ0gsQ0FBQztJQUVELElBQUksR0FBRyxRQUFRLENBQUMsSUFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoRCxJQUFJLE9BQU8sR0FBRyxJQUFJ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