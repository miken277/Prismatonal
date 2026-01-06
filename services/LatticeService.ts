
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

export const getMaxPrime = (n: number): number => {
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

const PRIMES = [3, 5, 7, 11, 13];
const PRIME_RATIOS = {
  3: new Fraction(3, 2),
  5: new Fraction(5, 4),
  7: new Fraction(7, 4),
  11: new Fraction(11, 8),
  13: new Fraction(13, 8),
};

const ODD_IDENTITIES = [1, 3, 5, 7, 11, 13];

// --- Generation ---

export const generateLattice = (
    settings: AppSettings, 
    generationOrigins: GenerationOrigin[] = [{coords: [0,0,0,0,0], octave: 0}]
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
          const val = origin.coords[idx];
          const pRat = PRIME_RATIOS[p as 3|5|7|11|13];
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
              const depthLimit = settings.limitDepths[prime as 3|5|7|11|13];
              if (depthLimit <= 0) return;

              [1, -1].forEach(dir => {
                  const nextCoords = [...current.coords];
                  nextCoords[idx] += dir;
                  
                  if (Math.abs(nextCoords[idx] - origin.coords[idx]) > depthLimit) return;
                  
                  const key = nextCoords.join(',');
                  if (!visitedLocal.has(key)) {
                      const pRat = PRIME_RATIOS[prime as 3|5|7|11|13];
                      const nextFrac = dir === 1 ? current.ratio.mul(pRat).normalize() : current.ratio.mul(new Fraction(pRat.d, pRat.n)).normalize();
                      
                      // Complexity Filter: Use the MAX PRIME IDENTITY of the *result* to determine the limit.
                      // This ensures that a node with a factor of 7 (even if reached via 3-limit axis)
                      // is checked against the 7-limit complexity setting (e.g. 50).
                      const maxP = Math.max(getMaxPrime(nextFrac.n), getMaxPrime(nextFrac.d));
                      let compLimit = 10000; // Default high for safe limits (e.g. 1/1, 2/1)
                      
                      // @ts-ignore
                      if (settings.limitComplexities && settings.limitComplexities[maxP]) {
                          // @ts-ignore
                          compLimit = settings.limitComplexities[maxP];
                      }

                      if (nextFrac.n <= compLimit && nextFrac.d <= compLimit) {
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
      // 1. Prime Connections
      PRIMES.forEach((prime, idx) => {
          const targetCoords = [...node.coords];
          targetCoords[idx] += 1;
          const coordKey = targetCoords.join(',');
          
          for (let o = node.octave - 1; o <= node.octave + 1; o++) {
              const target = nodesMap.get(`${coordKey}:${o}`);
              if (target) {
                  const ratio = target.ratio / node.ratio;
                  const test = ratio / (PRIME_RATIOS[prime as 3|5|7|11|13].n / PRIME_RATIOS[prime as 3|5|7|11|13].d);
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

      // 2. Octave Connections (Vertical 2/1)
      // Check for the node exactly one octave up with the same coordinates
      const coordKey = node.coords.join(',');
      const octaveTargetId = `${coordKey}:${node.octave + 1}`;
      const octaveTarget = nodesMap.get(octaveTargetId);
      
      if (octaveTarget) {
          lines.push({
              id: `${node.id}-${octaveTarget.id}`,
              x1: node.x, y1: node.y, 
              x2: octaveTarget.x, y2: octaveTarget.y,
              limit: 2, // Limit 2 (Octave)
              sourceId: node.id, 
              targetId: octaveTarget.id
          });
      }
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
    const centerOffset = (N - 1) / 2;

    for (let o = 0; o < N; o++) {
        for (let u = 0; u < N; u++) {
            const idOton = activeIdentities[o];
            const idUton = activeIdentities[u];
            
            const frac = new Fraction(idOton, idUton).normalize();
            const ratio = frac.n / frac.d;
            
            // Layout indices rotated 45 degrees
            // 1/1 at (0,0)
            // o increases: moves top-right
            // u increases: moves bottom-right
            const x = (o + u) - (N - 1);
            const y = (o - u);

            const id = `diamond-${o}-${u}`;
            
            nodes.push({
                id,
                coords: [o, u, 0, 0, 0], // Not standard prime coords, but used for grid
                ratio,
                n: frac.n,
                d: frac.d,
                label: `${frac.n}/${frac.d}`,
                x: x * 1.0,
                y: y * 0.8, // Slightly squashed vertically
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
