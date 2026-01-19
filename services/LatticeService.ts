
import { LatticeNode, LatticeLine, AppSettings, GenerationOrigin } from '../types';
import { projectCoordinates } from './ProjectionService';
import { GRID_IDENTITIES } from '../constants';

// --- Math Helpers ---

const gcd = (a: number, b: number): number => {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    let t = y;
    y = x % y;
    x = t;
  }
  return x;
};

export const getOddLimit = (n: number): number => {
  let temp = Math.abs(Math.round(n));
  while (temp % 2 === 0 && temp > 0) temp /= 2;
  return temp;
};

export class Fraction {
  n: number;
  d: number;

  constructor(n: number, d: number) {
    const common = gcd(n, d);
    this.n = n / common;
    this.d = d / common;
  }

  mul(other: Fraction): Fraction {
    return new Fraction(this.n * other.n, this.d * other.d);
  }

  div(other: Fraction): Fraction {
    return new Fraction(this.n * other.d, this.d * other.n);
  }

  normalize(): Fraction {
    let nn = this.n;
    let dd = this.d;
    if (nn === 0 || dd === 0) return new Fraction(0, 1);
    while (nn >= 2 * dd) dd *= 2;
    while (nn < dd) nn *= 2;
    return new Fraction(nn, dd);
  }

  shiftOctave(octave: number): Fraction {
    let nn = this.n;
    let dd = this.d;
    if (octave > 0) nn *= Math.pow(2, octave);
    else if (octave < 0) dd *= Math.pow(2, Math.abs(octave));
    return new Fraction(nn, dd);
  }
  
  valueOf() {
      return this.n / this.d;
  }
}

const PRIMES = [3, 5, 7, 11, 13];
// Prime Ratios for Line Checking (Standard Steps)
const PRIME_STEPS = {
  3: new Fraction(3, 2),
  5: new Fraction(5, 4),
  7: new Fraction(7, 4),
  11: new Fraction(11, 8),
  13: new Fraction(13, 8),
};

// Decompose a number into prime powers for [3, 5, 7, 11, 13]
// Returns array [p3, p5, p7, p11, p13]
const getPrimeFactors = (n: number): number[] => {
    let temp = n;
    const result = [0, 0, 0, 0, 0];
    
    // Remove factors of 2 (Octaves don't affect lattice position X)
    while (temp % 2 === 0 && temp > 0) temp /= 2;

    PRIMES.forEach((p, idx) => {
        while (temp % p === 0 && temp > 0) {
            result[idx]++;
            temp /= p;
        }
    });
    
    // Handle remaining composite factors roughly if needed, 
    // but for the defined GRID_IDENTITIES (1,3,5,7,9,11,13,15) this covers all bases.
    // 9 is 3^2, 15 is 3*5.
    
    return result;
};

// Calculate vector for a Fraction (Numerator Vector - Denominator Vector)
const getFractionVector = (frac: Fraction): number[] => {
    const nVec = getPrimeFactors(frac.n);
    const dVec = getPrimeFactors(frac.d);
    return nVec.map((val, i) => val - dVec[i]);
};

// --- Reconstruction Helper ---

export const reconstructNode = (id: string, settings: AppSettings): LatticeNode | null => {
    try {
        const parts = id.split(':');
        // Legacy IDs might be different, but Matrix IDs are usually "coords:octave"
        // However, with Matrix generation, we might want to support reconstruction for 
        // persistent latches even if they fall outside the current mask.
        
        if (parts.length !== 2) return null;
        
        const coordStr = parts[0];
        const octStr = parts[1];
        const coords = coordStr.split(',').map(Number);
        const octave = parseInt(octStr);
        
        if (coords.some(isNaN) || isNaN(octave)) return null;

        // Rebuild Fraction from Coords
        // This is the reverse of decomposition. 
        let frac = new Fraction(1, 1);
        PRIMES.forEach((gen, idx) => {
            const val = coords[idx] || 0;
            // @ts-ignore
            const gRat = PRIME_STEPS[gen];
            for(let i=0; i<Math.abs(val); i++) {
                frac = val > 0 ? frac.mul(gRat).normalize() : frac.mul(new Fraction(gRat.d, gRat.n)).normalize();
            }
        });
        
        // Apply octave shift
        frac = frac.shiftOctave(octave);
        
        const ratio = frac.n / frac.d;
        const { x, y } = projectCoordinates(coords, ratio, settings.latticeAspectRatio, settings.layoutApproach);
        
        return {
            id,
            coords,
            octave,
            ratio,
            n: frac.n,
            d: frac.d,
            label: `${frac.n}/${frac.d}`,
            x, y,
            limitTop: getOddLimit(frac.n),
            limitBottom: getOddLimit(frac.d),
            maxPrime: Math.max(getOddLimit(frac.n), getOddLimit(frac.d)),
            isGhost: true
        };
    } catch (e) {
        return null;
    }
};

// --- Main Generation ---

export const generateLattice = (
    settings: AppSettings, 
    generationOrigins: GenerationOrigin[] = [{coords: [0,0,0,0,0], octave: 0}]
): { nodes: LatticeNode[], lines: LatticeLine[] } => {
  
  const nodesMap = new Map<string, LatticeNode>();
  const mask = settings.enabledGridMask;
  const identities = GRID_IDENTITIES;
  
  // If mask is invalid size, fallback to default (should be handled in Store, but safety first)
  const safeMask = (mask && mask.length === 64) ? mask : new Array(64).fill(false);
  
  // Pre-calculate vectors for the 8 identities to speed up the loop
  const identityVectors = identities.map(id => getFractionVector(new Fraction(id.n, id.d)));
  
  // Iterate through all Modulation Origins (Poly-Modulation support)
  generationOrigins.forEach(origin => {
      
      // Calculate origin ratio to multiply
      // (Used for n/d labeling logic if we wanted absolute labels, 
      // but usually we keep labels relative to 1/1 or just display the calculated ratio)
      
      // We iterate the 8x8 Matrix
      for (let i = 0; i < 64; i++) {
          if (!safeMask[i]) continue;

          const row = Math.floor(i / 8); // Otonality (Numerator)
          const col = i % 8;             // Utonality (Denominator)
          
          const otonalIdentity = identities[row];
          const utonalIdentity = identities[col];
          const oVec = identityVectors[row];
          const uVec = identityVectors[col];

          // Resulting Ratio = Otonal / Utonal
          const baseFrac = new Fraction(otonalIdentity.n, otonalIdentity.d)
                            .div(new Fraction(utonalIdentity.n, utonalIdentity.d))
                            .normalize();

          // Resulting Vector = OtonalVec - UtonalVec + OriginVec
          const combinedCoords = oVec.map((val, idx) => val - uVec[idx] + (origin.coords[idx] || 0));
          
          // Generate for Octaves (usually -1, 0, +1 around center for lattice view flexibility)
          // The "Matrix" defines the chroma, we might want to see it in a few octaves
          const octaveRange = 1; 
          
          for (let oct = origin.octave - octaveRange; oct <= origin.octave + octaveRange; oct++) {
              
              // Adjust coords for projection if specific lattice logic requires it?
              // Standard lattice: Coords define X/Y. Octave defines Y offset.
              // We pass the coords directly.
              
              // Unique ID based on absolute coordinates
              const id = `${combinedCoords.join(',')}:${oct}`;
              
              if (!nodesMap.has(id)) {
                  const finalFrac = baseFrac.shiftOctave(oct - origin.octave); // Adjust for loop relative to origin
                  // Note: The origin's own octave shift is conceptual; 
                  // usually modulation keeps 1/1 at the new center visually.
                  // If we want absolute frequency ratios, we must multiply by origin's scalar ratio.
                  // For the UI Label (n/d), we usually display the relationship *within* the matrix.
                  // Let's stick to the matrix ratio normalized.
                  
                  const ratioValue = finalFrac.valueOf();
                  
                  // Project
                  const { x, y } = projectCoordinates(combinedCoords, ratioValue, settings.latticeAspectRatio, settings.layoutApproach);

                  nodesMap.set(id, {
                      id,
                      coords: combinedCoords,
                      octave: oct,
                      ratio: ratioValue, // This ratio is relative to global 1/1 if origin was 1/1
                      n: finalFrac.n,
                      d: finalFrac.d,
                      label: `${finalFrac.n}/${finalFrac.d}`,
                      x, y,
                      limitTop: getOddLimit(finalFrac.n),
                      limitBottom: getOddLimit(finalFrac.d),
                      maxPrime: Math.max(getOddLimit(finalFrac.n), getOddLimit(finalFrac.d)),
                      originIndex: 0 // Could track which origin generated it
                  });
              }
          }
      }
  });

  const nodes = Array.from(nodesMap.values());
  const lines: LatticeLine[] = [];
  
  // Connect Lines based on Prime Intervals (Lattice Logic)
  // We check every node against every other to see if they are a 'prime step' away.
  // Optimization: Only check nodes within a reasonable coordinate distance? 
  // Given max 64 nodes * 3 octaves = ~200 nodes, $N^2$ is fine (40k checks).
  
  nodes.forEach(node => {
      PRIMES.forEach((prime, idx) => {
          // Check for neighbor with coord + 1 in this prime dimension
          const targetCoords = [...node.coords];
          targetCoords[idx] += 1;
          const coordKey = targetCoords.join(',');
          
          // Check same octave and adjacent octaves (3/2 might cross octave boundary in some representations, 
          // but here we define connection by coordinate adjacency. 
          // A step of "3" is a coordinate change of +1 in index 0. 
          // The octave of the target might be different if we normalized the ratio?
          // ReconstructNode logic uses explicit coords.
          // Let's look for exact coordinate matches in the map.
          
          // Note: In Just Intonation, moving by a prime ratio often shifts the pitch 
          // such that we might need to normalize the octave to find the neighbor if we were strictly grid-based.
          // But here, `coords` tracks the prime powers directly. 
          // So [1,0,0] is 3/2. [2,0,0] is 9/8. 
          // A connection exists if coords differ by exactly 1 in one dimension.
          // The node at `coordKey` might be in any octave.
          
          // However, for visual clarity, we usually only connect nodes that are relatively close in pitch (Y axis).
          // We'll check the current octave and maybe +/- 1.
          
          for (let o = node.octave - 1; o <= node.octave + 1; o++) {
              const targetId = `${coordKey}:${o}`;
              const target = nodesMap.get(targetId);
              
              if (target) {
                  // Verify the musical interval is actually the prime (ignoring octave)
                  // Ratio T / S
                  const ratio = target.ratio / node.ratio;
                  // Normalize ratio to 1-2
                  let normRatio = ratio;
                  while (normRatio < 1.0) normRatio *= 2;
                  while (normRatio >= 2.0) normRatio /= 2;
                  
                  // Expected Prime Ratio (e.g. 1.5 for 3)
                  // @ts-ignore
                  const pFrac = PRIME_STEPS[prime];
                  const pVal = pFrac.n / pFrac.d;
                  
                  // Allow slight float error
                  if (Math.abs(normRatio - pVal) < 0.001) {
                      lines.push({
                          id: `${node.id}-${target.id}`,
                          x1: node.x, y1: node.y, x2: target.x, y2: target.y,
                          limit: prime, 
                          sourceId: node.id, targetId: target.id
                      });
                  }
              }
          }
      });
  });

  return { nodes, lines };
};
