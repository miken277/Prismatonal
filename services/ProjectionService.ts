
import { AppSettings, LayoutApproach } from '../types';

export const PITCH_SCALE = 200; // Pixels per octave (Base Scale)

// Basis vectors for the lattice projection (X-axis contribution per prime index)
// Order strictly corresponds to LatticeService PRIMES: [3, 5, 7, 11, 13]
export const BASIS_VECTORS_X = [
    100, // Prime 3: Major axis (Right)
    30,  // Prime 5: Minor axis (Right)
    20,  // Prime 7: Micro axis (Right)
    -35, // Prime 11: Offset Left (Distinct from 5/7 cluster)
    75   // Prime 13: Wide Right (Distinct lane between 5 and 3)
];

/**
 * Projects harmonic coordinates into 2D screen space based on selected layout approach.
 */
export const projectCoordinates = (
    coords: number[], 
    ratio: number, 
    aspectRatio: number,
    approach: LayoutApproach = 'lattice'
): { x: number, y: number } => {
    let x = 0;
    let y = 0;

    const spacing = 140; 
    const p3 = coords[0] || 0;
    const p5 = coords[1] || 0;
    const p7 = coords[2] || 0;
    const p11 = coords[3] || 0;
    const p13 = coords[4] || 0;

    if (approach === 'lattice') {
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
         * Partch Tonality Diamond (Discrete Identity Space):
         * coords[0] = Otonality Index, coords[1] = Utonality Index
         */
        x = coords[0] * spacing;
        y = coords[1] * spacing;
        // Rotation handled in LatticeService for simpler line logic
    }
    else if (approach === 'row') {
        x = Math.log2(ratio) * 1200; 
        const maxP = Math.max(1, ...coords.map((c, i) => c !== 0 ? [3,5,7,11,13][i] : 1));
        const limitIndex = [1, 3, 5, 7, 11, 13].indexOf(maxP);
        const dir = limitIndex % 2 === 0 ? 1 : -1;
        y = dir * (limitIndex * spacing * 0.6);
        y += (p3 * 5 + p5 * 3); 
    }
    else if (approach === 'honeycomb') {
        const hexUnit = spacing * 0.9;
        x = (p3 + p5 * 0.5 + p7 * -0.5) * hexUnit;
        y = (p5 * 0.866 + p7 * 0.866) * hexUnit;
        x += (p11 * 0.25) * hexUnit;
        y += (p13 * 0.25) * hexUnit;
        x = x * (1.0 / aspectRatio);
    }

    return { x, y };
};

export const getPitchRatioFromScreenDelta = (
    deltaY: number, 
    spacingScale: number
): number => {
    const effectiveScale = PITCH_SCALE * spacingScale;
    return Math.pow(2, -deltaY / effectiveScale);
};

export const getRainbowPeriod = (spacingScale: number): number => {
    return PITCH_SCALE * spacingScale;
};
