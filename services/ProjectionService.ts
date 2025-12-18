
import { AppSettings, LayoutApproach } from '../types';

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
 * Projects harmonic coordinates into 2D screen space based on selected layout approach.
 * All layouts are designed to be relative to (0,0) as the 1/1 origin.
 * 
 * @param coords Array of exponents for [3, 5, 7, 11, 13]
 * @param ratio The absolute frequency ratio of the node
 * @param aspectRatio The lattice aspect ratio setting
 * @param approach The geometric layout approach
 * @returns {x, y} coordinates relative to origin (0,0)
 */
export const projectCoordinates = (
    coords: number[], 
    ratio: number, 
    aspectRatio: number,
    approach: LayoutApproach = 'lattice'
): { x: number, y: number } => {
    let x = 0;
    let y = 0;

    const spacing = 140; // Unified base spacing for alternate layouts
    const p3 = coords[0] || 0;
    const p5 = coords[1] || 0;
    const p7 = coords[2] || 0;
    const p11 = coords[3] || 0;
    const p13 = coords[4] || 0;

    if (approach === 'lattice') {
        // Standard Tonality Lattice: X = Harmonic Basis, Y = Pitch Height
        for(let i = 0; i < coords.length; i++) {
            if (i < BASIS_VECTORS_X.length) {
                x += coords[i] * BASIS_VECTORS_X[i];
            }
        }
        x = x * (1.0 / aspectRatio);
        y = -(Math.log2(ratio) * PITCH_SCALE);
    } 
    else if (approach === 'diamond') {
        /**
         * Orthogonal Diamond (Limit Space):
         * Rotated 45-degree grid where Prime 3 and Prime 5 form the primary plane.
         * Conceptually maps prime factors to cartesian space.
         */
        const unit = spacing * 0.8;
        // Prime 3 and 5 mapped to diagonal axes
        x = (p3 - p5) * unit;
        y = (p3 + p5) * (unit * 0.6); // Slightly squashed vertically for visual balance
        
        // High primes shift the Z-depth (X/Y offsets) to keep clusters distinct
        x += (p7 * 0.3 + p11 * -0.2) * unit;
        y += (p7 * 0.2 + p13 * 0.3) * unit;
        
        x = x * (1.0 / aspectRatio);
    }
    else if (approach === 'row') {
        /**
         * Linear Ratios (Harmonic Strip):
         * X is strictly Cents (log-frequency).
         * Y is determined by "Harmonicity" - higher limit primes are pushed further from the center line.
         */
        x = Math.log2(ratio) * 1200; // X = Cents
        
        // Harmonicity-based Y stacking:
        // Calculate a "Complexity Offset" based on the highest prime in the ratio
        const maxP = Math.max(1, ...coords.map((c, i) => c !== 0 ? [3,5,7,11,13][i] : 1));
        const limitIndex = [1, 3, 5, 7, 11, 13].indexOf(maxP);
        
        // Alternating Y stacking based on limit level
        const dir = limitIndex % 2 === 0 ? 1 : -1;
        y = dir * (limitIndex * spacing * 0.6);
        
        // Fine-tuning within the row to prevent overlap of identical cents
        y += (p3 * 5 + p5 * 3); 
    }
    else if (approach === 'honeycomb') {
        /**
         * Hexagonal Honeycomb (Euler-Fokker Space):
         * A classic honeycomb grid where every cell is surrounded by its 3-limit, 5-limit, and 7-limit neighbors.
         */
        const hexUnit = spacing * 0.9;
        
        // Standard Pointy-Top Hex math
        // Axis 1: Prime 3
        // Axis 2: Prime 5 (60 deg)
        // Axis 3: Prime 7 (120 deg)
        x = (p3 + p5 * 0.5 + p7 * -0.5) * hexUnit;
        y = (p5 * 0.866 + p7 * 0.866) * hexUnit;

        // High primes (11, 13) act as "plane shifts"
        x += (p11 * 0.25) * hexUnit;
        y += (p13 * 0.25) * hexUnit;

        x = x * (1.0 / aspectRatio);
    }

    return { x, y };
};

/**
 * Calculates the frequency ratio change resulting from a vertical drag distance.
 */
export const getPitchRatioFromScreenDelta = (
    deltaY: number, 
    spacingScale: number
): number => {
    const effectiveScale = PITCH_SCALE * spacingScale;
    return Math.pow(2, -deltaY / effectiveScale);
};

/**
 * Helper to get the vertical repetition period for the rainbow background
 */
export const getRainbowPeriod = (spacingScale: number): number => {
    return PITCH_SCALE * spacingScale;
};
