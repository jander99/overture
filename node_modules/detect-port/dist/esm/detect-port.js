import { createServer } from 'node:net';
import { debuglog } from 'node:util';
import { ip } from 'address';
const debug = debuglog('detect-port');
export class IPAddressNotAvailableError extends Error {
    constructor(options) {
        super('The IP address is not available on this machine', options);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
export function detectPort(port, callback) {
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
        return await listen(port, ip());
    }
    catch (err) {
        return await handleError(++port, maxPort, hostname);
    }
}
function listen(port, hostname) {
    const server = createServer();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV0ZWN0LXBvcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvZGV0ZWN0LXBvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFlBQVksRUFBZSxNQUFNLFVBQVUsQ0FBQztBQUNyRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBRSxFQUFFLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFFN0IsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBVXRDLE1BQU0sT0FBTywwQkFBMkIsU0FBUSxLQUFLO0lBQ25ELFlBQVksT0FBc0I7UUFDaEMsS0FBSyxDQUFDLGlEQUFpRCxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7UUFDbEMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBS0QsTUFBTSxVQUFVLFVBQVUsQ0FBQyxJQUF3RCxFQUFFLFFBQTZCO0lBQ2hILElBQUksUUFBUSxHQUF1QixFQUFFLENBQUM7SUFFdEMsSUFBSSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDckMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDekIsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDekIsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDbkIsQ0FBQztTQUFNLENBQUM7UUFDTixJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRSxDQUFDO1lBQy9CLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDaEIsSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDO1FBQ2hCLENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBSSxHQUFHLFFB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