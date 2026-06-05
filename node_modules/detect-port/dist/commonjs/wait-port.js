"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitPortRetryError = void 0;
exports.waitPort = waitPort;
const node_util_1 = require("node:util");
const detect_port_js_1 = require("./detect-port.js");
const debug = (0, node_util_1.debuglog)('detect-port:wait-port');
function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
class WaitPortRetryError extends Error {
    retries;
    count;
    constructor(message, retries, count, options) {
        super(message, options);
        this.name = this.constructor.name;
        this.retries = retries;
        this.count = count;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.WaitPortRetryError = WaitPortRetryError;
async function waitPort(port, options = {}) {
    const { retryInterval = 1000, retries = Infinity } = options;
    let count = 1;
    async function loop() {
        debug('wait port %d, retries %d, count %d', port, retries, count);
        if (count > retries) {
            const err = new WaitPortRetryError('retries exceeded', retries, count);
            throw err;
        }
        count++;
        const freePort = await (0, detect_port_js_1.detectPort)(port);
        if (freePort === port) {
            await sleep(retryInterval);
            return loop();
        }
        return true;
    }
    return await loop();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FpdC1wb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3dhaXQtcG9ydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUE2QkEsNEJBb0JDO0FBakRELHlDQUFxQztBQUNyQyxxREFBOEM7QUFFOUMsTUFBTSxLQUFLLEdBQUcsSUFBQSxvQkFBUSxFQUFDLHVCQUF1QixDQUFDLENBQUM7QUFFaEQsU0FBUyxLQUFLLENBQUMsRUFBVTtJQUN2QixPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzNCLFVBQVUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDMUIsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsTUFBYSxrQkFBbUIsU0FBUSxLQUFLO0lBQzNDLE9BQU8sQ0FBUztJQUNoQixLQUFLLENBQVM7SUFFZCxZQUFZLE9BQWUsRUFBRSxPQUFlLEVBQUUsS0FBYSxFQUFFLE9BQXNCO1FBQ2pGLEtBQUssQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDeEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztRQUNsQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNsRCxDQUFDO0NBQ0Y7QUFYRCxnREFXQztBQU9NLEtBQUssVUFBVSxRQUFRLENBQUMsSUFBWSxFQUFFLFVBQTJCLEVBQUU7SUFDeEUsTUFBTSxFQUFFLGFBQWEsR0FBRyxJQUFJLEVBQUUsT0FBTyxHQUFHLFFBQVEsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUM3RCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7SUFFZCxLQUFLLFVBQVUsSUFBSTtRQUNqQixLQUFLLENBQUMsb0NBQW9DLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNsRSxJQUFJLEtBQUssR0FBRyxPQUFPLEVBQUUsQ0FBQztZQUNwQixNQUFNLEdBQUcsR0FBRyxJQUFJLGtCQUFrQixDQUFDLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN2RSxNQUFNLEdBQUcsQ0FBQztRQUNaLENBQUM7UUFDRCxLQUFLLEVBQUUsQ0FBQztRQUNSLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBQSwyQkFBVSxFQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLElBQUksUUFBUSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3RCLE1BQU0sS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzNCLE9BQU8sSUFBSSxFQUFFLENBQUM7UUFDaEIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELE9BQU8sTUFBTSxJQUFJLEVBQUUsQ0FBQztBQUN0QixDQUFDIn0=