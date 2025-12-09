
import { LatticeNode, LatticeLine, AppSettings } from '../types';

// --- Math Helpers ---

// Reduce fraction to simplest form
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

// Returns the largest prime factor of n (ignoring 2)
const getMaxPrime = (n: number): number => {
  let temp = n;
  while (temp % 2 === 0 && temp > 1) temp /= 2;
  if (temp === 1) return 1;

  let maxP = 1;
  let d = 3;
  while (d * d <= temp) {
    while (temp % d === 0) {
      maxP = d;
      temp /= d;
    }
    d += 2;
  }
  if (temp > 1) maxP = temp;
  return maxP;
};

// Fraction Class for integer math
class Fraction {
  n: number;
  d: number;

  constructor(n: number, d: number) {
    this.n = n;
    this.d = d;
  }

  mul(other: Fraction): Fraction {
    return new Fraction(this.n * other.n, this.d * other.d);
  }

  normalize(): Fraction {
    // Bring into 1/1 to 2/1 range (approx)
    // Actually, we usually want 1 <= ratio < 2
    let nn = this.n;
    let dd = this.d;
    
    // Simplification first
    const divisor = gcd(nn, dd);
    nn /= divisor;
    dd /= divisor;

    // Octave reduce
    while (nn >= 2 * dd) dd *= 2;
    while (nn < dd) nn *= 2;

    return new Fraction(nn, dd);
  }
}

// --- Vectors for Projection ---
// Adjust these to change the visual "tilt"
// Screen coords: +y is Down.
const VECTORS = {
  3: { x: 0, y: -90 },    // North (Up)
  5: { x: 75, y: -50 },   // Northeast (Right-Up)
  7: { x: 60, y: 50 },    // Southeast (Right-Down)
  11: { x: -60, y: -40 }, // Northwest (Left-Up)
  13: { x: -50, y: 60 },  // Southwest (Left-Down)
};

const PRIMES = [3, 5, 7, 11, 13];
const PRIME_RATIOS = {
  3: new Fraction(3, 2),
  5: new Fraction(5, 4),
  7: new Fraction(7, 4),
  11: new Fraction(11, 8),
  13: new Fraction(13, 8),
};

// --- Generation ---

const getDistance = (coords: number[]): number => {
  const p3 = coords[0];
  const p5 = coords[1];

  let hexDist = 0;
  // Hexagonal Distance Metric for the 3-Limit (Axis 1) and 5-Limit (Axis 2) plane.
  // In a hex grid defined by two axes 60 degrees apart:
  // - If signs match (e.g., +3, +5), we are moving away in the cone between axes -> Sum of coords.
  // - If signs differ (e.g., +3, -5), we are moving "across" the hex -> Max of coords.
  // This ensures that "Northwest" (1, -1) is distance 1, forming a hexagon instead of a diamond.
  if (Math.sign(p3) === Math.sign(p5) && p3 !== 0 && p5 !== 0) {
    hexDist = Math.abs(p3) + Math.abs(p5);
  } else {
    hexDist = Math.max(Math.abs(p3), Math.abs(p5));
  }

  // For higher limits (7, 11, 13), we treat them as additional orthogonal dimensions (Manhattan distance)
  // because they don't form a planar hex grid with 3 and 5 in this visualization.
  let otherDist = 0;
  for (let i = 2; i < coords.length; i++) {
    otherDist += Math.abs(coords[i]);
  }

  return hexDist + otherDist;
};

export const generateLattice = (settings: AppSettings): { nodes: LatticeNode[], lines: LatticeLine[] } => {
  const nodes: Map<string, LatticeNode> = new Map();
  const queue: { coords: number[], ratio: Fraction }[] = [];
  
  // Start at Origin
  // Coords: [exp3, exp5, exp7, exp11, exp13]
  const originCoords = [0, 0, 0, 0, 0];
  const originFrac = new Fraction(1, 1);
  queue.push({ coords: originCoords, ratio: originFrac });

  // Add origin node immediately
  nodes.set(originCoords.join(','), createNode(originCoords, originFrac));

  const MAX_NODES = 4000; // Increased safety cap for larger shells
  let processedCount = 0;

  // Set of visited coord strings to prevent duplicates in queue
  const visited = new Set<string>();
  visited.add(originCoords.join(','));

  while (queue.length > 0 && processedCount < MAX_NODES) {
    const current = queue.shift()!;
    processedCount++;
    
    const { coords, ratio } = current;
    
    PRIMES.forEach((prime, idx) => {
      // Skip if limit not enabled
      if (prime === 7 && !settings.enabledLimits[7]) return;
      if (prime === 11 && !settings.enabledLimits[11]) return;
      if (prime === 13 && !settings.enabledLimits[13]) return;

      // Directions: +1 and -1
      [1, -1].forEach(dir => {
        const nextPos = [...coords];
        nextPos[idx] += dir;
        const posKey = nextPos.join(',');
        
        if (!visited.has(posKey)) {
          // Check Distance
          const dist = getDistance(nextPos);

          if (dist < settings.latticeShells) {
             
             let nextRatio: Fraction;
             const pRat = PRIME_RATIOS[prime as keyof typeof PRIME_RATIOS];
             
             if (dir === 1) {
                nextRatio = ratio.mul(pRat).normalize();
             } else {
                const invRatio = new Fraction(pRat.d, pRat.n);
                nextRatio = ratio.mul(invRatio).normalize();
             }

             // --- Complexity Check ---
             // Prune branches that exceed the max Numerator/Denominator complexity
             if (nextRatio.n <= settings.maxND && nextRatio.d <= settings.maxND) {
                visited.add(posKey);
                const node = createNode(nextPos, nextRatio);
                nodes.set(posKey, node);
                queue.push({ coords: nextPos, ratio: nextRatio });
             }
          }
        }
      });
    });
  }

  // Generate Lines
  const lines: LatticeLine[] = [];
  const nodeList = Array.from(nodes.values());
  
  // Sort nodes for rendering order (Consonance: Low limit first -> High Z-Index)
  // But DOM renders bottom-up. So first in array = behind.
  // User wants "top to bottom layer 2,3,5...".
  // So 13 limit should be drawn first (bottom layer), 1 limit last (top layer).
  nodeList.sort((a, b) => b.maxPrime - a.maxPrime);

  // Generate connections
  nodeList.forEach(node => {
    PRIMES.forEach((prime, idx) => {
       // Look for neighbor in +1 direction only (to avoid double lines)
       const neighborCoords = [...node.coords];
       neighborCoords[idx] += 1;
       const neighborKey = neighborCoords.join(',');
       const neighbor = nodes.get(neighborKey);

       if (neighbor) {
         lines.push({
           id: `${node.id}-${neighbor.id}`,
           x1: node.x,
           y1: node.y,
           x2: neighbor.x,
           y2: neighbor.y,
           limit: prime
         });
       }
    });
  });

  return { nodes: nodeList, lines };
};

const createNode = (coords: number[], frac: Fraction): LatticeNode => {
  // Project coordinates to 2D
  let x = 0;
  let y = 0;
  
  // 3-limit (Index 0)
  x += coords[0] * VECTORS[3].x;
  y += coords[0] * VECTORS[3].y;
  
  // 5-limit (Index 1)
  x += coords[1] * VECTORS[5].x;
  y += coords[1] * VECTORS[5].y;

  // 7-limit (Index 2)
  x += coords[2] * VECTORS[7].x;
  y += coords[2] * VECTORS[7].y;

  // 11-limit (Index 3)
  x += coords[3] * VECTORS[11].x;
  y += coords[3] * VECTORS[11].y;

  // 13-limit (Index 4)
  x += coords[4] * VECTORS[13].x;
  y += coords[4] * VECTORS[13].y;

  const n = frac.n;
  const d = frac.d;
  const val = n / d;
  
  const limitTop = getMaxPrime(n);
  const limitBottom = getMaxPrime(d);
  const maxPrime = Math.max(limitTop, limitBottom);

  return {
    id: coords.join(','),
    label: `${n}/${d}`,
    n, d,
    ratio: val,
    x, y,
    limitTop,
    limitBottom,
    maxPrime,
    coords
  };
};
