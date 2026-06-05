import { debuglog } from 'node:util';
import { detectPort } from './detect-port.js';
const debug = debuglog('detect-port:wait-port');
function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
export class WaitPortRetryError extends Error {
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
export async function waitPort(port, options = {}) {
    const { retryInterval = 1000, retries = Infinity } = options;
    let count = 1;
    async function loop() {
        debug('wait port %d, retries %d, count %d', port, retries, count);
        if (count > retries) {
            const err = new WaitPortRetryError('retries exceeded', retries, count);
            throw err;
        }
        count++;
        const freePort = await detectPort(port);
        if (freePort === port) {
            await sleep(retryInterval);
            return loop();
        }
        return true;
    }
    return await loop();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FpdC1wb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3dhaXQtcG9ydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUU5QyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsdUJBQXVCLENBQUMsQ0FBQztBQUVoRCxTQUFTLEtBQUssQ0FBQyxFQUFVO0lBQ3ZCLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDM0IsVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMxQixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxNQUFNLE9BQU8sa0JBQW1CLFNBQVEsS0FBSztJQUMzQyxPQUFPLENBQVM7SUFDaEIsS0FBSyxDQUFTO0lBRWQsWUFBWSxPQUFlLEVBQUUsT0FBZSxFQUFFLEtBQWEsRUFBRSxPQUFzQjtRQUNqRixLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7UUFDbEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBT0QsTUFBTSxDQUFDLEtBQUssVUFBVSxRQUFRLENBQUMsSUFBWSxFQUFFLFVBQTJCLEVBQUU7SUFDeEUsTUFBTSxFQUFFLGFBQWEsR0FBRyxJQUFJLEVBQUUsT0FBTyxHQUFHLFFBQVEsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUM3RCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7SUFFZCxLQUFLLFVBQVUsSUFBSTtRQUNqQixLQUFLLENBQUMsb0NBQW9DLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNsRSxJQUFJLEtBQUssR0FBRyxPQUFPLEVBQUUsQ0FBQztZQUNwQixNQUFNLEdBQUcsR0FBRyxJQUFJLGtCQUFrQixDQUFDLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN2RSxNQUFNLEdBQUcsQ0FBQztRQUNaLENBQUM7UUFDRCxLQUFLLEVBQUUsQ0FBQztRQUNSLE1BQU0sUUFBUSxHQUFHLE1BQU0sVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLElBQUksUUFBUSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3RCLE1BQU0sS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzNCLE9BQU8sSUFBSSxFQUFFLENBQUM7UUFDaEIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELE9BQU8sTUFBTSxJQUFJLEVBQUUsQ0FBQztBQUN0QixDQUFDIn0=