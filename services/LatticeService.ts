

import { LatticeNode, LatticeLine, AppSettings, GenerationOrigin } from '../types';
import { projectCoordinates } from './ProjectionService';

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

const getMaxPrime = (n: number): number => {
  let temp = Math.abs(Math.round(n));
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
    const common = gcd(n, d);
    this.n = n / common;
    this.d = d / common;
  }

  mul(other: Fraction): Fraction {
    return new Fraction(this.n * other.n, this.d * other.d);
  }

  normalize(): Fraction {
    let nn = this.n;
    let dd = this.d;
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
}

const PRIMES = [3, 5, 7, 9, 11, 13, 15];
const PRIME_RATIOS: Record<number, Fraction> = {
  3: new Fraction(3, 2),
  5: new Fraction(5, 4),
  7: new Fraction(7, 4),
  9: new Fraction(9, 8),
  11: new Fraction(11, 8),
  13: new Fraction(13, 8),
  15: new Fraction(15, 8),
};

const ODD_IDENTITIES = [1, 3, 5, 7, 9, 11, 13, 15];

// --- Generation ---

export const generateLattice = (
    settings: AppSettings, 
    generationOrigins: GenerationOrigin[] = [{coords: [0,0,0,0,0,0,0], octave: 0}]
): { nodes: LatticeNode[], lines: LatticeLine[] } => {
  
  if (settings.layoutApproach === 'diamond') {
      return generatePartchDiamond(settings);
  }

  const nodesMap = new Map<string, LatticeNode>();
  const OCTAVE_RANGE = 2; 

  generationOrigins.forEach(origin => {
      const localQueue: { coords: number[], ratio: Fraction }[] = [];
      
      // Calculate start ratio for origin coords
      let originFrac = new Fraction(1, 1);
      PRIMES.forEach((p, idx) => {
          const val = origin.coords[idx] || 0;
          const pRat = PRIME_RATIOS[p];
          for(let i=0; i<Math.abs(val); i++) {
              originFrac = val > 0 ? originFrac.mul(pRat).normalize() : originFrac.mul(new Fraction(pRat.d, pRat.n)).normalize();
          }
      });

      localQueue.push({ coords: origin.coords, ratio: originFrac });
      const visitedLocal = new Set<string>([origin.coords.join(',')]);
      
      const MAX_LOCAL_NODES = 800;
      let processed = 0;

      while (localQueue.length > 0 && processed < MAX_LOCAL_NODES) {
          const current = localQueue.shift()!;
          processed++;

          for (let oct = origin.octave - OCTAVE_RANGE; oct <= origin.octave + OCTAVE_RANGE; oct++) {
              const shifted = current.ratio.shiftOctave(oct);
              const id = `${current.coords.join(',')}:${oct}`;
              
              if (!nodesMap.has(id)) {
                  const absoluteRatio = shifted.n / shifted.d;
                  const { x, y } = projectCoordinates(current.coords, absoluteRatio, settings.latticeAspectRatio, settings.layoutApproach);

                  nodesMap.set(id, {
                      id,
                      coords: current.coords,
                      ratio: absoluteRatio,
                      n: shifted.n,
                      d: shifted.d,
                      label: `${shifted.n}/${shifted.d}`,
                      x, y,
                      limitTop: getMaxPrime(shifted.n),
                      limitBottom: getMaxPrime(shifted.d),
                      maxPrime: Math.max(getMaxPrime(shifted.n), getMaxPrime(shifted.d)),
                      octave: oct
                  });
              }
          }

          PRIMES.forEach((prime, idx) => {
              // @ts-ignore
              const depthLimit = settings.limitDepths[prime];
              if (depthLimit <= 0) return;

              [1, -1].forEach(dir => {
                  const nextCoords = [...current.coords];
                  // Ensure coords array is long enough if originating from old data
                  while(nextCoords.length <= idx) nextCoords.push(0);
                  
                  nextCoords[idx] += dir;
                  
                  const originVal = origin.coords[idx] || 0;
                  if (Math.abs(nextCoords[idx] - originVal) > depthLimit) return;
                  
                  const key = nextCoords.join(',');
                  if (!visitedLocal.has(key)) {
                      const pRat = PRIME_RATIOS[prime];
                      const nextFrac = dir === 1 ? current.ratio.mul(pRat).normalize() : current.ratio.mul(new Fraction(pRat.d, pRat.n)).normalize();
                      
                      let isComplexValid = true;
                      for (let i = 0; i < PRIMES.length; i++) {
                          const p = PRIMES[i];
                          const coordVal = nextCoords[i] || 0;
                          
                          if (coordVal !== 0) {
                              // @ts-ignore
                              const limit = settings.limitComplexities[p];
                              if (limit !== undefined) {
                                  if (nextFrac.n > limit || nextFrac.d > limit) {
                                      isComplexValid = false;
                                      break;
                                  }
                              }
                          }
                      }

                      if (isComplexValid) {
                          visitedLocal.add(key);
                          localQueue.push({ coords: nextCoords, ratio: nextFrac });
                      }
                  }
              });
          });
      }
  });

  const nodes = Array.from(nodesMap.values());
  const lines: LatticeLine[] = [];
  
  nodes.forEach(node => {
      PRIMES.forEach((prime, idx) => {
          const targetCoords = [...node.coords];
          while(targetCoords.length <= idx) targetCoords.push(0);
          
          targetCoords[idx] += 1;
          const coordKey = targetCoords.join(',');
          
          for (let o = node.octave - 1; o <= node.octave + 1; o++) {
              const target = nodesMap.get(`${coordKey}:${o}`);
              if (target) {
                  const ratio = target.ratio / node.ratio;
                  const primeRat = PRIME_RATIOS[prime];
                  const test = ratio / (primeRat.n / primeRat.d);
                  if (Math.abs(Math.log2(test) - Math.round(Math.log2(test))) < 0.001) {
                      lines.push({
                          id: `${node.id}-${target.id}`,
                          x1: node.x, y1: node.y, x2: target.x, y2: target.y,
                          limit: prime, sourceId: node.id, targetId: target.id
                      });
                  }
              }
          }
      });
  });

  return { nodes, lines };
};

/**
 * Generates a Harry Partch-style Tonality Diamond
 */
const generatePartchDiamond = (settings: AppSettings): { nodes: LatticeNode[], lines: LatticeLine[] } => {
    const nodes: LatticeNode[] = [];
    const lines: LatticeLine[] = [];
    
    // Find highest enabled odd limit
    let maxEnabledLimit = 1;
    settings.layerOrder.forEach(l => {
        if (!settings.hiddenLimits.includes(l) && ODD_IDENTITIES.includes(l)) {
            if (l > maxEnabledLimit) maxEnabledLimit = l;
        }
    });

    const activeIdentities = ODD_IDENTITIES.filter(id => id <= maxEnabledLimit);
    const N = activeIdentities.length;
    
    // Scale factor to ensure nodes are visually separated
    const diamondSpacing = 200; // Matched to Lattice octave spacing

    for (let o = 0; o < N; o++) {
        for (let u = 0; u < N; u++) {
            const idOton = activeIdentities[o];
            const idUton = activeIdentities[u];
            
            const frac = new Fraction(idOton, idUton).normalize();
            const ratio = frac.n / frac.d;
            
            // Layout indices rotated 45 degrees
            // 1/1 at Left (o=0, u=0), Right (o=N-1, u=N-1), Center
            // o (Otonality) increases towards Top (Negative Y)
            // u (Utonality) increases towards Bottom (Positive Y)
            
            const x = ((o + u) - (N - 1)) * diamondSpacing;
            const y = (u - o) * diamondSpacing;

            const id = `diamond-${o}-${u}`;
            
            nodes.push({
                id,
                coords: [o, u, 0, 0, 0, 0, 0], // Not standard prime coords, but used for grid
                ratio,
                n: frac.n,
                d: frac.d,
                label: `${frac.n}/${frac.d}`,
                x: x,
                y: y,
                limitTop: getMaxPrime(frac.n),
                limitBottom: getMaxPrime(frac.d),
                maxPrime: Math.max(getMaxPrime(frac.n), getMaxPrime(frac.d)),
                octave: 0
            });
        }
    }

    // Connect neighbors in the diamond grid
    nodes.forEach((node, i) => {
        const [o, u] = node.coords;
        nodes.forEach((target, j) => {
            const [to, tu] = target.coords;
            const distO = Math.abs(o - to);
            const distU = Math.abs(u - tu);
            if ((distO === 1 && distU === 0) || (distO === 0 && distU === 1)) {
                lines.push({
                    id: `${node.id}-${target.id}`,
                    x1: node.x, y1: node.y, x2: target.x, y2: target.y,
                    limit: Math.max(node.maxPrime, target.maxPrime),
                    sourceId: node.id, targetId: target.id
                });
            }
        });
    });

    return { nodes, lines };
};
