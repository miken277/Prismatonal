
import { LatticeNode, LatticeLine, AppSettings } from '../types';

// --- Math Helpers ---

const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

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
    let nn = this.n;
    let dd = this.d;
    
    const divisor = gcd(nn, dd);
    nn /= divisor;
    dd /= divisor;

    while (nn >= 2 * dd) dd *= 2;
    while (nn < dd) nn *= 2;

    return new Fraction(nn, dd);
  }

  // Adjust fraction by octave shift
  shiftOctave(octave: number): Fraction {
    let nn = this.n;
    let dd = this.d;
    if (octave > 0) {
        nn *= Math.pow(2, octave);
    } else if (octave < 0) {
        dd *= Math.pow(2, Math.abs(octave));
    }
    // Simplify again to keep numbers clean
    const divisor = gcd(nn, dd);
    return new Fraction(nn / divisor, dd / divisor);
  }
}

// X-Axis projection vectors (Harmonic Width)
const X_VECTORS = {
  3: 100,
  5: 30,  
  7: 20,
  11: -20,
  13: -30,
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

export const getHarmonicDistance = (coordsA: number[], coordsB: number[] = [0,0,0,0,0]): number => {
  const p3 = coordsA[0] - coordsB[0];
  const p5 = coordsA[1] - coordsB[1];
  
  // Standard lattice distance logic for generation bounds
  let hexDist = 0;
  if (Math.sign(p3) === Math.sign(p5) && p3 !== 0 && p5 !== 0) {
    hexDist = Math.abs(p3) + Math.abs(p5);
  } else {
    hexDist = Math.max(Math.abs(p3), Math.abs(p5));
  }

  let otherDist = 0;
  for (let i = 2; i < coordsA.length; i++) {
    otherDist += Math.abs(coordsA[i] - coordsB[i]);
  }

  return hexDist + otherDist;
};

export const generateLattice = (settings: AppSettings): { nodes: LatticeNode[], lines: LatticeLine[] } => {
  const baseNodes: Map<string, { coords: number[], ratio: Fraction }> = new Map();
  const queue: { coords: number[], ratio: Fraction }[] = [];
  
  // 1. Generate Base Set (Normalized 1-2)
  const originCoords = [0, 0, 0, 0, 0];
  const originFrac = new Fraction(1, 1);
  queue.push({ coords: originCoords, ratio: originFrac });
  baseNodes.set(originCoords.join(','), { coords: originCoords, ratio: originFrac });

  const MAX_NODES = 2000;
  let processedCount = 0;

  while (queue.length > 0 && processedCount < MAX_NODES) {
    const current = queue.shift()!;
    processedCount++;
    const { coords, ratio } = current;
    
    PRIMES.forEach((prime, idx) => {
      if (prime === 7 && !settings.enabledLimits[7]) return;
      if (prime === 11 && !settings.enabledLimits[11]) return;
      if (prime === 13 && !settings.enabledLimits[13]) return;

      [1, -1].forEach(dir => {
        const nextPos = [...coords];
        nextPos[idx] += dir;
        const posKey = nextPos.join(',');
        
        if (!baseNodes.has(posKey)) {
          const dist = getHarmonicDistance(nextPos);
          if (dist < settings.latticeShells) {
             let nextRatio: Fraction;
             const pRat = PRIME_RATIOS[prime as keyof typeof PRIME_RATIOS];
             if (dir === 1) nextRatio = ratio.mul(pRat).normalize();
             else {
                const invRatio = new Fraction(pRat.d, pRat.n);
                nextRatio = ratio.mul(invRatio).normalize();
             }

             if (nextRatio.n <= settings.maxND && nextRatio.d <= settings.maxND) {
                baseNodes.set(posKey, { coords: nextPos, ratio: nextRatio });
                queue.push({ coords: nextPos, ratio: nextRatio });
             }
          }
        }
      });
    });
  }

  // 2. Expand Vertically (Octaves)
  const OCTAVE_RANGE = 2; 
  const nodes: LatticeNode[] = [];
  const nodesMap: Map<string, LatticeNode> = new Map();

  baseNodes.forEach((data, key) => {
      for (let oct = -OCTAVE_RANGE; oct <= OCTAVE_RANGE; oct++) {
          const shiftedRatio = data.ratio.shiftOctave(oct);
          const absoluteRatio = shiftedRatio.n / shiftedRatio.d;
          
          const id = `${key}:${oct}`;
          
          let x = 0;
          x += data.coords[0] * X_VECTORS[3];
          x += data.coords[1] * X_VECTORS[5];
          x += data.coords[2] * X_VECTORS[7];
          x += data.coords[3] * X_VECTORS[11];
          x += data.coords[4] * X_VECTORS[13];
          
          // Apply Aspect Ratio Stretch/Squish
          // If Ratio is 2.0 (Squished), we divide X by 2.
          // If Ratio is 0.5 (Stretched), we divide X by 0.5 (Multiply by 2).
          x = x * (1.0 / settings.latticeAspectRatio);

          const PITCH_SCALE = 200; // Pixels per octave
          const y = -(Math.log2(absoluteRatio) * PITCH_SCALE);

          const limitTop = getMaxPrime(shiftedRatio.n);
          const limitBottom = getMaxPrime(shiftedRatio.d);
          const maxPrime = Math.max(limitTop, limitBottom);

          const node: LatticeNode = {
              id,
              coords: data.coords,
              ratio: absoluteRatio,
              n: shiftedRatio.n,
              d: shiftedRatio.d,
              label: `${shiftedRatio.n}/${shiftedRatio.d}`,
              x,
              y,
              limitTop,
              limitBottom,
              maxPrime,
              octave: oct
          };
          nodes.push(node);
          nodesMap.set(id, node);
      }
  });

  // 3. Generate Lines
  const lines: LatticeLine[] = [];
  
  nodes.sort((a, b) => b.maxPrime - a.maxPrime);

  nodes.forEach(node => {
      // Harmonic Neighbors
      PRIMES.forEach((prime, idx) => {
          const neighborCoords = [...node.coords];
          neighborCoords[idx] += 1;
          const key = neighborCoords.join(',');
          
          if (baseNodes.has(key)) {
             const basePrimeRatio = PRIME_RATIOS[prime as keyof typeof PRIME_RATIOS].n / PRIME_RATIOS[prime as keyof typeof PRIME_RATIOS].d;
             
             // Iterate nearby octaves
             for(let o = node.octave - 1; o <= node.octave + 1; o++) {
                 const targetId = `${key}:${o}`;
                 const target = nodesMap.get(targetId);
                 
                 if (target) {
                      // Check for power-of-2 relationship relative to prime
                      // ratio / basePrimeRatio = 2^k
                      const ratio = target.ratio / node.ratio;
                      const test = ratio / basePrimeRatio;
                      const log2 = Math.log2(test);
                      
                      // Allow small epsilon error
                      if (Math.abs(log2 - Math.round(log2)) < 0.001) {
                          lines.push({
                            id: `${node.id}-${target.id}`,
                            x1: node.x,
                            y1: node.y,
                            x2: target.x,
                            y2: target.y,
                            limit: prime
                          });
                      }
                 }
             }
          }
      });
      
      // Vertical Octave Connections
      const octUpId = `${node.coords.join(',')}:${node.octave + 1}`;
      const octUpNode = nodesMap.get(octUpId);
      if (octUpNode) {
          lines.push({
              id: `${node.id}-oct-${node.octave}`,
              x1: node.x,
              y1: node.y,
              x2: octUpNode.x,
              y2: octUpNode.y,
              limit: 1 // Octave "limit"
          });
      }
  });

  return { nodes, lines };
};
