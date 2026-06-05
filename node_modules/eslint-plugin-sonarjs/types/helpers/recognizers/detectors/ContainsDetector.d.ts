import Detector from '../Detector.js';
export default class ContainsDetector extends Detector {
    strings: (string | RegExp)[];
    constructor(probability: number, ...strings: (string | RegExp)[]);
    scan(line: string): number;
}
