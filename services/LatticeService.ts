
import { LatticeNode, LatticeLine, AppSettings, GenerationOrigin } from '../types';
import { projectCoordinates } from './ProjectionService';

// --- Math Helpers ---

const gcd = (a: number, b: number): number => {
  while (b !== 0) {
    let t = b;
    b = a % b;
    a = t;
  }
  return a;
};

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

// Helper to calculate the absolute ratio of a coordinate set starting from 1/1
const calculateRatioFromCoords = (coords: number[]): Fraction => {
    let ratio = new Fraction(1, 1);
    
    PRIMES.forEach((prime, idx) => {
        const pRat = PRIME_RATIOS[prime as keyof typeof PRIME_RATIOS];
        const val = coords[idx];
        if (val === 0) return;
        
        for(let i=0; i < Math.abs(val); i++) {
             if (val > 0) ratio = ratio.mul(pRat).normalize();
             else {
                 const invRatio = new Fraction(pRat.d, pRat.n);
                 ratio = ratio.mul(invRatio).normalize();
             }
        }
    });
    return ratio;
};

// Origins now includes octave information
export const generateLattice = (
    settings: AppSettings, 
    generationOrigins: GenerationOrigin[] = [{coords: [0,0,0,0,0], octave: 0}],
    // Incremental generation support
    existingNodesMap?: Map<string, LatticeNode>,
    startIndex: number = 0
): { nodes: LatticeNode[], lines: LatticeLine[] } => {
  
  // Clone existing map if provided to avoid mutation of cache, or create new
  const nodesMap: Map<string, LatticeNode> = existingNodesMap ? new Map(existingNodesMap) : new Map();
  
  const OCTAVE_RANGE = 2; // Range +/- around the origin octave

  // Iterate through new origins only
  for (let i = startIndex; i < generationOrigins.length; i++) {
      const origin = generationOrigins[i];
      
      // 1. BFS for Prime Coordinates relative to this origin
      const localQueue: { coords: number[], ratio: Fraction, relativeRatio: Fraction }[] = [];
      const originFrac = calculateRatioFromCoords(origin.coords);
      
      const originKey = origin.coords.join(',');
      const visitedLocal = new Set<string>();
      
      localQueue.push({ coords: origin.coords, ratio: originFrac, relativeRatio: new Fraction(1, 1) });
      visitedLocal.add(originKey);

      const MAX_LOCAL_NODES = 1000;
      let processedCount = 0;
      
      const foundBaseNodes: { coords: number[], ratio: Fraction }[] = [];
      foundBaseNodes.push({ coords: origin.coords, ratio: originFrac });

      while (localQueue.length > 0 && processedCount < MAX_LOCAL_NODES) {
        const current = localQueue.shift()!;
        processedCount++;
        const { coords, ratio, relativeRatio } = current;
        
        PRIMES.forEach((prime, idx) => {
          const depthLimit = settings.limitDepths[prime as 3|5|7|11|13];
          if (depthLimit <= 0) return;

          const complexityLimit = settings.limitComplexities[prime as 3|5|7|11|13];

          [1, -1].forEach(dir => {
            const nextPos = [...coords];
            nextPos[idx] += dir;
            
            // Strict axis checking RELATIVE to current local origin
            if (Math.abs(nextPos[idx] - origin.coords[idx]) > depthLimit) return;

            const posKey = nextPos.join(',');
            
            if (!visitedLocal.has(posKey)) {
                visitedLocal.add(posKey);

                 let nextRatio: Fraction;
                 let nextRelativeRatio: Fraction;
                 
                 const pRat = PRIME_RATIOS[prime as keyof typeof PRIME_RATIOS];
                 if (dir === 1) {
                    nextRatio = ratio.mul(pRat).normalize();
                    nextRelativeRatio = relativeRatio.mul(pRat).normalize();
                 } else {
                    const invRatio = new Fraction(pRat.d, pRat.n);
                    nextRatio = ratio.mul(invRatio).normalize();
                    nextRelativeRatio = relativeRatio.mul(invRatio).normalize();
                 }
                 
                 if (nextRelativeRatio.n <= complexityLimit && nextRelativeRatio.d <= complexityLimit) {
                    const nodeData = { coords: nextPos, ratio: nextRatio, relativeRatio: nextRelativeRatio };
                    foundBaseNodes.push(nodeData);
                    localQueue.push(nodeData);
                 }
            }
          });
        });
      }

      // 2. Vertical Expansion
      foundBaseNodes.forEach(data => {
          for (let oct = origin.octave - OCTAVE_RANGE; oct <= origin.octave + OCTAVE_RANGE; oct++) {
               const shiftedRatio = data.ratio.shiftOctave(oct);
               const absoluteRatio = shiftedRatio.n / shiftedRatio.d;
               const coordKey = data.coords.join(',');
               const id = `${coordKey}:${oct}`;

               if (!nodesMap.has(id)) {
                   const limitTop = getMaxPrime(shiftedRatio.n);
                   const limitBottom = getMaxPrime(shiftedRatio.d);
                   const maxPrime = Math.max(limitTop, limitBottom);

                   // Use Unified Projection Service with current approach
                   const { x, y } = projectCoordinates(data.coords, absoluteRatio, settings.latticeAspectRatio, settings.layoutApproach);

                   nodesMap.set(id, {
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
                   });
               }
          }
      });
  }

  const nodes = Array.from(nodesMap.values());
  const lines: LatticeLine[] = [];
  
  // Sort for rendering order
  nodes.sort((a, b) => b.maxPrime - a.maxPrime);

  // Line generation must run on ALL nodes (new + old) to ensure connectivity
  nodes.forEach(node => {
      PRIMES.forEach((prime, idx) => {
          if (settings.limitDepths[prime as 3|5|7|11|13] <= 0) return;

          const neighborCoords = [...node.coords];
          neighborCoords[idx] += 1;
          const coordKey = neighborCoords.join(',');
          
          const basePrimeRatio = PRIME_RATIOS[prime as keyof typeof PRIME_RATIOS].n / PRIME_RATIOS[prime as keyof typeof PRIME_RATIOS].d;
          
          for(let o = node.octave - 1; o <= node.octave + 1; o++) {
              const targetId = `${coordKey}:${o}`;
              const target = nodesMap.get(targetId);
              
              if (target) {
                  const ratio = target.ratio / node.ratio;
                  const test = ratio / basePrimeRatio;
                  // Use a slightly looser tolerance for floating point drift in complex ratios
                  if (Math.abs(Math.log2(test) - Math.round(Math.log2(test))) < 0.001) {
                      lines.push({
                        id: `${node.id}-${target.id}`,
                        x1: node.x,
                        y1: node.y,
                        x2: target.x,
                        y2: target.y,
                        limit: prime,
                        sourceId: node.id,
                        targetId: target.id
                      });
                  }
              }
          }
      });
      
      const octUpId = `${node.coords.join(',')}:${node.octave + 1}`;
      const octUpNode = nodesMap.get(octUpId);
      if (octUpNode) {
          lines.push({
              id: `${node.id}-oct-${node.octave}`,
              x1: node.x,
              y1: node.y,
              x2: octUpNode.x,
              y2: octUpNode.y,
              limit: 1, 
              sourceId: node.id,
              targetId: octUpNode.id
          });
      }
  });

  return { nodes, lines };
};
