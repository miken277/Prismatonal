
import { AppSettings } from '../types';

export const PITCH_SCALE = 200; // Pixels per octave (Base Scale)

// Basis vectors for the lattice projection (X-axis contribution per prime index)
// Indices correspond to [3, 5, 7, 11, 13]
export const BASIS_VECTORS_X = [
    100, // Prime 3
    30,  // Prime 5
    20,  // Prime 7
    -20, // Prime 11
    -30  // Prime 13
];

/**
 * Projects 5-limit harmonic coordinates into 2D screen space (Base unscaled coordinates)
 * @param coords Array of exponents for [3, 5, 7, 11, 13]
 * @param ratio The absolute frequency ratio of the node
 * @param aspectRatio The lattice aspect ratio setting
 * @returns {x, y} coordinates relative to origin (0,0)
 */
export const projectCoordinates = (
    coords: number[], 
    ratio: number, 
    aspectRatio: number
): { x: number, y: number } => {
    let x = 0;
    
    // Dot product of coords and basis vectors
    for(let i = 0; i < coords.length; i++) {
        // Safety check if coords length matches basis vectors
        if (i < BASIS_VECTORS_X.length) {
            x += coords[i] * BASIS_VECTORS_X[i];
        }
    }
    
    // Apply Aspect Ratio (Squish/Stretch X)
    x = x * (1.0 / aspectRatio);

    // Y is purely determined by pitch (vertical layout) with logarithmic spacing
    // Negative Y goes UP in standard cartesian, but here we want higher pitch = higher Y (negative pixel value)
    const y = -(Math.log2(ratio) * PITCH_SCALE);

    return { x, y };
};

/**
 * Calculates the frequency ratio change resulting from a vertical drag distance.
 * @param deltaY The vertical distance in pixels (relative to node center)
 * @param spacingScale The current button spacing scale setting
 * @returns The frequency ratio multiplier (e.g. 1.05 for slight sharp)
 */
export const getPitchRatioFromScreenDelta = (
    deltaY: number, 
    spacingScale: number
): number => {
    // The visual lattice scales PITCH_SCALE by the buttonSpacingScale.
    // We must invert this scaling to get back to the musical ratio.
    const effectiveScale = PITCH_SCALE * spacingScale;
    
    // Formula: ratio = 2^(-dy / scale)
    // Negative deltaY (moving up) should increase pitch (ratio > 1)
    return Math.pow(2, -deltaY / effectiveScale);
};

/**
 * Helper to get the vertical repetition period for the rainbow background
 */
export const getRainbowPeriod = (spacingScale: number): number => {
    return PITCH_SCALE * spacingScale;
};
