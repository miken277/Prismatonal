
import { LatticeNode, LimitType } from '../types';

// --- Math Helpers ---

const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b);
};

// Returns the largest prime factor of n
const getMaxPrime = (n: number): number => {
  if (n === 1) return 1;
  let maxP = 1;
  let d = 2;
  let temp = n;
  while (d * d <= temp) {
    while (temp % d === 0) {
      maxP = d;
      temp /= d;
    }
    d++;
  }
  if (temp > 1) maxP = temp;
  return maxP;
};

// Determines the "Limit Identity" of a ratio n/d according to Partch logic
// This is essentially max(MaxPrime(n), MaxPrime(d))
const getPartchLimitIdentity = (n: number, d: number): number => {
  // First, remove factors of 2 (octave equivalence doesn't change limit identity)
  let tn = n;
  let td = d;
  while (tn % 2 === 0) tn /= 2;
  while (td % 2 === 0) td /= 2;

  const maxN = getMaxPrime(tn);
  const maxD = getMaxPrime(td);
  
  return Math.max(maxN, maxD);
};

const normalizeFraction = (n: number, d: number): { n: number, d: number, val: number } => {
  let val = n / d;
  
  // Normalize to [1, 2)
  while (val < 1) {
    n *= 2;
    val *= 2;
  }
  while (val >= 2) {
    d *= 2;
    val /= 2;
  }

  // Reduce fraction
  const common = gcd(n, d);
  return {
    n: n / common,
    d: d / common,
    val: val
  };
};

// --- Generation ---

export const generateLattice = (limit: LimitType): LatticeNode[] => {
  const nodes: LatticeNode[] = [];
  const generatedIds = new Set<string>();

  // Partch Diamond Construction
  // The diamond is formed by the interaction of the Otonality (Numerators) and Utonality (Denominators)
  // using the odd numbers up to the limit.
  
  // 1. Determine the set of identities (Odd numbers <= Limit)
  // Limit 3: 1, 3
  // Limit 5: 1, 3, 5
  // Limit 7: 1, 3, 5, 7
  // Limit 11: 1, 3, 5, 7, 9, 11
  
  const identities: number[] = [];
  for (let i = 1; i <= limit; i += 2) {
    identities.push(i);
  }

  // Calculate center offset to center the diamond at (0,0)
  // The grid is a square of size N x N rotated 45 degrees.
  // Center index is (N-1) / 2
  const centerIndex = (identities.length - 1) / 2;

  // 2. Iterate through the Otonality (rows) and Utonality (cols) matrix
  for (let i = 0; i < identities.length; i++) {
    for (let j = 0; j < identities.length; j++) {
      const otonality = identities[i];
      const utonality = identities[j];

      // Ratio is Otonality / Utonality
      const { n, d, val } = normalizeFraction(otonality, utonality);
      
      const id = `${n}/${d}`;
      
      // Avoid duplicates if they occur (though in this matrix construction, usually unique or 1/1 at center)
      // Actually, 3/1 and 1/3 normalized might be 3/2 and 4/3. 
      // 1/1 appears multiple times? 3/3, 5/5... -> 1/1.
      if (generatedIds.has(id)) continue;
      generatedIds.add(id);

      const limitId = getPartchLimitIdentity(n, d);

      // Partch Diamond Layout Logic
      // 1/1 (Unity) is traditionally at the bottom or center.
      // In the "Incubation" diamond, 1/1 is at the bottom vertex.
      // However, usually the 'Diamond' is depicted as a rotated square grid.
      // Diagonal 1 (Bottom-Left to Top-Right): Otonality increasing
      // Diagonal 2 (Top-Left to Bottom-Right): Utonality increasing
      
      // Let's map indices to diamond coordinates.
      // We want the shape to look like a diamond.
      // x-axis: (i - j) -> spreads out width-wise
      // y-axis: (i + j) -> spreads out height-wise
      
      // Since screen Y is down, we invert Y to make it grow upwards.
      // We subtract center indices to center the whole shape around (0,0).
      
      // Partch style: 1/1 is usually at the bottom of the structure in diagrams.
      // If we want 1/1 at the bottom, we shouldn't center vertically around 0.
      // However, for the app UX, centering the whole cluster on screen is best.
      
      // Coordinate transformation:
      // Rotate grid 45 degrees
      const xPos = (i - j) * 0.7; // 0.7 is roughly sin(45) scaling to keep spacing consistent
      const yPos = (i + j - (centerIndex * 2)) * 0.7 * -1; // -1 to flip Y so higher index goes UP
      
      // Note:
      // If i=0, j=0 (1/1): x=0, y=positive (top) if we subtract center?
      // Let's trace:
      // i,j range 0..5 (Limit 11)
      // Max Y (top): i=0, j=0 -> y = -(-5) = +5 (UP?? No, Y is up in math, screen Y is down)
      // Let's stick to screen Y.
      // 0,0 (Top Left of matrix) -> 1/1 (math) -> usually bottom of diamond?
      // Actually, in the matrix:
      // Row 0: 1/1, 1/3, 1/5...
      // Col 0: 1/1, 3/1, 5/1...
      // Usually Otonality goes to the right, Utonality goes to the left.
      // Let's assume i is Otonality (Right-up vector), j is Utonality (Left-up vector).
      // x = (i - j)
      // y = -(i + j)
      // But we need to center it.
      
      // Recalculating centering:
      // The "1/1" is at i=0, j=0.
      // The "11/11" (which is 1/1) is at i=5, j=5.
      // The actual 1/1 pitch is the root.
      // Let's ensure the "main" 1/1 (Identity 1) is visually central?
      // In Partch's diamond, the 1/1 is the bottommost point.
      // But for a multitouch surface, having it centered is often more ergonomic.
      // However, the user asked to match "Harry Partch" diamond.
      // Partch's diagram is a lattice standing on a point.
      // I will generate it relative to the center of the bounding box.
      
      // Center of i is (L-1)/2
      // Center of j is (L-1)/2
      
      const x = (i - j) * 0.6; 
      const y = ((i + j) - (identities.length - 1)) * 0.6; 

      nodes.push({
        id,
        label: `${n}/${d}`,
        ratio: val,
        x: x, 
        y: y, 
        limitIdentity: limitId
      });
    }
  }

  return nodes;
};
