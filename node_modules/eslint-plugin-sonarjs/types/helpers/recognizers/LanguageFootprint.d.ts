import Detector from './Detector.js';
export default interface LanguageFootprint {
    getDetectors(): Set<Detector>;
}
