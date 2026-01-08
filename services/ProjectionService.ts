
import { AppSettings, LayoutApproach } from '../types';

export const PITCH_SCALE = 200; // Pixels per octave (Base Scale)

// Basis vectors for the lattice projection (X-axis contribution per generator index)
// Order corresponds to [3, 5, 7, 9, 11, 13, 15]
export const BASIS_VECTORS_X = [
    100,  // Generator 3
    30,   // Generator 5
    20,   // Generator 7
    200,  // Generator 9 (Approximately 2 * 3-vector)
    -20,  // Generator 11
    -30,  // Generator 13
    130   // Generator 15 (Approximately 3-vector + 5-vector)
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
    
    // Map coords to named primes for non-lattice layouts (legacy support for simple mappings)
    // Note: This mapping assumes the first 3 indices are 3, 5, 7. 
    const p3 = coords[0] || 0;
    const p5 = coords[1] || 0;
    const p7 = coords[2] || 0;
    const p9 = coords[3] || 0;
    const p11 = coords[4] || 0;
    const p13 = coords[5] || 0;
    const p15 = coords[6] || 0;

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
        // Handled in LatticeService for geometry, this is a fallback if called
        x = coords[0] * spacing;
        y = coords[1] * spacing;
    }
    else if (approach === 'row') {
        // Linear frequency mapping
        x = Math.log2(ratio) * 1200; 
        
        // Y-axis stacking based on complexity/limit
        // We find the highest active generator index
        let maxIndex = 0;
        for(let i = 0; i < coords.length; i++) {
            if (coords[i] !== 0) maxIndex = Math.max(maxIndex, i);
        }
        
        // Alternating up/down based on index parity for separation
        const dir = maxIndex % 2 === 0 ? 1 : -1;
        y = dir * (maxIndex * spacing * 0.6);
        
        // Add subtle offset for 3 and 5 to prevent overlap in center
        y += (p3 * 5 + p5 * 3); 
    }
    else if (approach === 'honeycomb') {
        const hexUnit = spacing * 0.9;
        // Standard Hex: 3 and 5 axes
        x = (p3 + p5 * 0.5 + p7 * -0.5) * hexUnit;
        y = (p5 * 0.866 + p7 * 0.866) * hexUnit;
        
        // Z-axis/depth offset for higher limits
        x += (p11 * 0.25 + p9 * 0.5) * hexUnit;
        y += (p13 * 0.25 + p15 * 0.5) * hexUnit;
        
        x = x * (1.0 / aspectRatio);
    }
    else if (approach === 'et_row' || approach === 'et_grid' || approach === 'et_wheel') {
        // ET Layouts generally ignore prime coords and rely purely on Ratio/Cents
        const semitones = Math.log2(ratio) * 12;
        
        if (approach === 'et_wheel') {
            const radius = spacing * 3;
            const angle = (semitones / 12) * Math.PI * 2 - (Math.PI / 2); // Start top
            x = Math.cos(angle) * radius;
            y = Math.sin(angle) * radius;
        } else if (approach === 'et_grid') {
            const col = Math.round(semitones);
            x = col * (spacing * 0.6);
            y = (semitones - col) * spacing * 10; // Detune on Y
        } else {
            // et_row
            x = semitones * (spacing * 0.8);
            y = 0;
        }
    }
    // Pythagorean Spiral & Row
    else if (approach === 'pyth_spiral') {
        // 3-limit stack wrapped
        const fifths = p3; // Only p3 is relevant effectively
        const radius = spacing * 2 + (fifths * 5);
        const angle = fifths * (Math.PI * 2 * (7/12)); // Circle of fifths angle
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius;
    }
    else if (approach === 'pyth_row') {
        x = p3 * spacing;
        y = p5 * spacing; // Just in case 5 is involved
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
