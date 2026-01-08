
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

const GENERATORS = [3, 5, 7, 9, 11, 13, 15];
const GENERATOR_RATIOS: Record<number, Fraction> = {
  3: new Fraction(3, 2),
  5: new Fraction(5, 4),
  7: new Fraction(7, 4),
  9: new Fraction(9, 8),
  11: new Fraction(11, 8),
  13: new Fraction(13, 8),
  15: new Fraction(15, 8),
};

// --- Reconstruction ---

export const reconstructNode = (id: string, settings: AppSettings): LatticeNode | null => {
    try {
        const parts = id.split(':');
        if (parts.length !== 2) return null;
        
        const coordStr = parts[0];
        const octStr = parts[1];
        const coords = coordStr.split(',').map(Number);
        const octave = parseInt(octStr);
        
        if (coords.some(isNaN) || isNaN(octave)) return null;

        let frac = new Fraction(1, 1);
        GENERATORS.forEach((gen, idx) => {
            const val = coords[idx] || 0;
            const gRat = GENERATOR_RATIOS[gen];
            for(let i=0; i<Math.abs(val); i++) {
                frac = val > 0 ? frac.mul(gRat).normalize() : frac.mul(new Fraction(gRat.d, gRat.n)).normalize();
            }
        });
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
            limitTop: getMaxPrime(frac.n),
            limitBottom: getMaxPrime(frac.d),
            maxPrime: Math.max(getMaxPrime(frac.n), getMaxPrime(frac.d)),
            isGhost: true
        };
    } catch (e) {
        return null;
    }
};

// --- Generation ---

export const generateLattice = (
    settings: AppSettings, 
    generationOrigins: GenerationOrigin[] = [{coords: [0,0,0,0,0,0,0], octave: 0}]
): { nodes: LatticeNode[], lines: LatticeLine[] } => {
  
  if (settings.layoutApproach === 'diamond') {
      return generatePartchDiamond(settings);
  }

  const nodesMap = new Map<string, LatticeNode>();
  const lines: LatticeLine[] = [];
  const OCTAVE_RANGE = 2; 
  const maxDist = settings.latticeMaxDistance !== undefined ? settings.latticeMaxDistance : 12;

  // The latest origin in the path is the "Active" one
  const activeOriginIndex = generationOrigins.length - 1;

  generationOrigins.forEach((origin, oIdx) => {
      const isGhost = oIdx !== activeOriginIndex;
      const localQueue: { coords: number[], ratio: Fraction }[] = [];
      
      // Calculate absolute start ratio for origin coords relative to global 1/1
      let originFrac = new Fraction(1, 1);
      GENERATORS.forEach((gen, idx) => {
          const val = origin.coords[idx] || 0;
          const gRat = GENERATOR_RATIOS[gen];
          for(let i=0; i<Math.abs(val); i++) {
              originFrac = val > 0 ? originFrac.mul(gRat).normalize() : originFrac.mul(new Fraction(gRat.d, gRat.n)).normalize();
          }
      });
      // Adjust for base octave of the origin
      originFrac = originFrac.shiftOctave(origin.octave);

      const fullCoords = [...origin.coords];
      while(fullCoords.length < GENERATORS.length) fullCoords.push(0);

      localQueue.push({ coords: fullCoords, ratio: originFrac });
      const visitedLocal = new Set<string>([fullCoords.join(',')]);
      
      // Reduce complexity limits for ghost lattices to save performance and visual clutter
      const MAX_LOCAL_NODES = isGhost ? 100 : 1200; 
      let processed = 0;

      while (localQueue.length > 0 && processed < MAX_LOCAL_NODES) {
          const current = localQueue.shift()!;
          processed++;

          for (let oct = origin.octave - OCTAVE_RANGE; oct <= origin.octave + OCTAVE_RANGE; oct++) {
              const shifted = current.ratio.shiftOctave(oct - origin.octave);
              const id = `${current.coords.join(',')}:${oct}`;
              
              if (!nodesMap.has(id) || !isGhost) {
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
                      octave: oct,
                      isGhost: isGhost,
                      originIndex: oIdx
                  });
              }
          }

          GENERATORS.forEach((gen, idx) => {
              // @ts-ignore
              let depthLimit = settings.limitDepths[gen];
              if (depthLimit <= 0) return;
              
              // Reduce spread of ghost lattices
              if (isGhost) depthLimit = Math.min(depthLimit, 1);

              [1, -1].forEach(dir => {
                  const nextCoords = [...current.coords];
                  nextCoords[idx] += dir;
                  
                  const originVal = origin.coords[idx] || 0;
                  // 1. Per-Axis Depth Check
                  if (Math.abs(nextCoords[idx] - originVal) > depthLimit) return;
                  
                  // 2. Global Distance Check
                  let dist = 0;
                  nextCoords.forEach((v, i) => dist += Math.abs(v - (origin.coords[i] || 0)));
                  if (dist > maxDist) return;

                  const key = nextCoords.join(',');
                  if (!visitedLocal.has(key)) {
                      const gRat = GENERATOR_RATIOS[gen];
                      const nextFrac = dir === 1 ? current.ratio.mul(gRat).normalize() : current.ratio.mul(new Fraction(gRat.d, gRat.n)).normalize();
                      
                      // 3. Complexity Check (optional but recommended)
                      // @ts-ignore
                      const compLimit = (settings.limitComplexities && settings.limitComplexities[gen]) ? settings.limitComplexities[gen] : 1000;
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
  
  nodes.forEach(node => {
      // 1. Generate Octave Lines (Vertical/Limit 2)
      const octaveTargetId = `${node.coords.join(',')}:${node.octave + 1}`;
      const octaveTarget = nodesMap.get(octaveTargetId);
      if (octaveTarget) {
          const lineGhost = node.isGhost || octaveTarget.isGhost;
          
          lines.push({
              id: `${node.id}-${octaveTarget.id}`,
              x1: node.x, y1: node.y, x2: octaveTarget.x, y2: octaveTarget.y,
              limit: 2, 
              sourceId: node.id, targetId: octaveTarget.id,
              isGhost: lineGhost
          });
      }

      // 2. Generate Prime Generator Lines
      GENERATORS.forEach((gen, idx) => {
          const targetCoords = [...node.coords];
          targetCoords[idx] += 1;
          const coordKey = targetCoords.join(',');
          
          for (let o = node.octave - 1; o <= node.octave + 1; o++) {
              const target = nodesMap.get(`${coordKey}:${o}`);
              if (target) {
                  const ratio = target.ratio / node.ratio;
                  const genRat = GENERATOR_RATIOS[gen];
                  const targetVal = genRat.n / genRat.d;
                  const normalizedRatio = ratio >= 1 ? ratio : 1/ratio; 
                  const test = Math.log2(normalizedRatio / targetVal);
                  
                  if (Math.abs(test - Math.round(test)) < 0.001) {
                      const lineGhost = node.isGhost || target.isGhost;
                      lines.push({
                          id: `${node.id}-${target.id}`,
                          x1: node.x, y1: node.y, x2: target.x, y2: target.y,
                          limit: gen, 
                          sourceId: node.id, targetId: target.id,
                          isGhost: lineGhost
                      });
                  }
              }
          }
      });
  });

  return { nodes, lines };
};

/**
 * Generates a Harry Partch-style Tonality Diamond based on enabled Identities
 */
const generatePartchDiamond = (settings: AppSettings): { nodes: LatticeNode[], lines: LatticeLine[] } => {
    const nodes: LatticeNode[] = [];
    const lines: LatticeLine[] = [];
    
    const activeIdentities = (settings.enabledIdentities || [1, 3, 5, 7, 9, 11, 13, 15]).filter(id => !settings.hiddenLimits.includes(id));
    activeIdentities.sort((a, b) => a - b);
    if (!activeIdentities.includes(1)) activeIdentities.unshift(1);

    const N = activeIdentities.length;
    const diamondSpacing = 100; 

    for (let o = 0; o < N; o++) {
        for (let u = 0; u < N; u++) {
            const idOton = activeIdentities[o];
            const idUton = activeIdentities[u];
            
            const frac = new Fraction(idOton, idUton).normalize();
            const ratio = frac.n / frac.d;
            
            const id = `diamond-${idOton}-${idUton}`;
            const x = ((o + u) - (N - 1)) * diamondSpacing;
            const y = (u - o) * diamondSpacing;

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

    nodes.forEach((node) => {
        const [o, u] = node.coords;
        nodes.forEach((target) => {
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
