
import { LatticeNode, LatticeLine, AppSettings, GenerationOrigin } from '../types';
import { projectCoordinates } from './ProjectionService';

// --- Math Helpers ---

const gcd = (a: number, b: number): number => {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
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

// Optimization: Use plain objects instead of Class to reduce GC pressure
interface Fraction {
    n: number;
    d: number;
}

const createFraction = (n: number, d: number): Fraction => {
    const common = gcd(n, d);
    return { n: n / common, d: d / common };
};

const mulFractions = (a: Fraction, b: Fraction): Fraction => {
    return createFraction(a.n * b.n, a.d * b.d);
};

const normalizeFraction = (f: Fraction): Fraction => {
    let nn = f.n;
    let dd = f.d;
    while (nn >= 2 * dd) dd *= 2;
    while (nn < dd) nn *= 2;
    return createFraction(nn, dd);
};

const shiftOctave = (f: Fraction, octave: number): Fraction => {
    let nn = f.n;
    let dd = f.d;
    if (octave > 0) nn *= Math.pow(2, octave);
    else if (octave < 0) dd *= Math.pow(2, Math.abs(octave));
    return createFraction(nn, dd);
};

const PRIMES = [3, 5, 7, 9, 11, 13, 15];
const PRIME_RATIOS: Record<number, Fraction> = {
  3: createFraction(3, 2),
  5: createFraction(5, 4),
  7: createFraction(7, 4),
  9: createFraction(9, 8),
  11: createFraction(11, 8),
  13: createFraction(13, 8),
  15: createFraction(15, 8),
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
      let originFrac = createFraction(1, 1);
      PRIMES.forEach((p, idx) => {
          const val = origin.coords[idx] || 0;
          const pRat = PRIME_RATIOS[p];
          for(let i=0; i<Math.abs(val); i++) {
              if (val > 0) {
                  originFrac = normalizeFraction(mulFractions(originFrac, pRat));
              } else {
                  originFrac = normalizeFraction(mulFractions(originFrac, { n: pRat.d, d: pRat.n }));
              }
          }
      });

      localQueue.push({ coords: origin.coords, ratio: originFrac });
      const visitedLocal = new Set<string>([origin.coords.join(',')]);
      
      const MAX_LOCAL_NODES = 1200;
      let processed = 0;

      while (localQueue.length > 0 && processed < MAX_LOCAL_NODES) {
          const current = localQueue.shift()!;
          processed++;

          for (let oct = origin.octave - OCTAVE_RANGE; oct <= origin.octave + OCTAVE_RANGE; oct++) {
              const shifted = shiftOctave(current.ratio, oct);
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

          for (let idx = 0; idx < PRIMES.length; idx++) {
              const prime = PRIMES[idx];
              // @ts-ignore
              const depthLimit = settings.limitDepths[prime];
              if (depthLimit <= 0) continue;

              const originVal = origin.coords[idx] || 0;
              const currentVal = current.coords[idx] || 0;

              const dirs = [1, -1];
              for (let dIdx = 0; dIdx < dirs.length; dIdx++) {
                  const dir = dirs[dIdx];
                  if (Math.abs((currentVal + dir) - originVal) > depthLimit) continue;

                  const nextCoords = current.coords.slice();
                  // Ensure coords array is long enough 
                  while(nextCoords.length <= idx) nextCoords.push(0);
                  
                  nextCoords[idx] += dir;
                  
                  const key = nextCoords.join(',');
                  if (!visitedLocal.has(key)) {
                      const pRat = PRIME_RATIOS[prime];
                      let nextFrac: Fraction;
                      if (dir === 1) {
                          nextFrac = normalizeFraction(mulFractions(current.ratio, pRat));
                      } else {
                          nextFrac = normalizeFraction(mulFractions(current.ratio, { n: pRat.d, d: pRat.n }));
                      }
                      
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
              }
          }
      }
  });

  const nodes = Array.from(nodesMap.values());
  const lines: LatticeLine[] = [];
  
  for (const node of nodes) {
      for (let idx = 0; idx < PRIMES.length; idx++) {
          const prime = PRIMES[idx];
          
          const targetCoords = node.coords.slice();
          while(targetCoords.length <= idx) targetCoords.push(0);
          targetCoords[idx] += 1;
          const coordKey = targetCoords.join(',');
          
          for (let o = node.octave - 1; o <= node.octave + 1; o++) {
              const targetId = `${coordKey}:${o}`;
              const target = nodesMap.get(targetId);
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
      }
  }

  return { nodes, lines };
};

/**
 * Generates a Harry Partch-style Tonality Diamond
 */
const generatePartchDiamond = (settings: AppSettings): { nodes: LatticeNode[], lines: LatticeLine[] } => {
    const nodes: LatticeNode[] = [];
    const lines: LatticeLine[] = [];
    
    const activeIdentities = ODD_IDENTITIES.filter(id => !settings.hiddenLimits.includes(id));
    const N = activeIdentities.length;
    
    // Scale factor to ensure nodes are visually separated
    const diamondSpacing = 200; 

    for (let o = 0; o < N; o++) {
        for (let u = 0; u < N; u++) {
            const idOton = activeIdentities[o];
            const idUton = activeIdentities[u];
            
            const frac = normalizeFraction(createFraction(idOton, idUton));
            const ratio = frac.n / frac.d;
            
            // Layout indices rotated 45 degrees
            const x = ((o + u) - (N - 1)) * diamondSpacing;
            const y = (u - o) * diamondSpacing;

            const id = `diamond-${o}-${u}`;
            
            nodes.push({
                id,
                coords: [o, u, 0, 0, 0, 0, 0], 
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
