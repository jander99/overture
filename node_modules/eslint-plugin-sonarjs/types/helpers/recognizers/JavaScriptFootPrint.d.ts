import Detector from './Detector.js';
import LanguageFootprint from './LanguageFootprint.js';
export declare class JavaScriptFootPrint implements LanguageFootprint {
    detectors: Set<Detector>;
    constructor();
    getDetectors(): Set<Detector>;
}
