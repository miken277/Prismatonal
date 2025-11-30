
import { LatticeNode } from '../types';

// --- Math Helpers ---

// Returns the largest prime factor of n (ignoring 2)
const getMaxPrime = (n: number): number => {
  // Remove factors of 2 (Unity in Partch color theory typically)
  while (n % 2 === 0 && n > 1) {
    n /= 2;
  }
  
  if (n === 1) return 1;

  let maxP = 1;
  let d = 3;
  let temp = n;
  
  // Check odd factors
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

// Parses a ratio string "7/4" or "2" into n and d
const parseRatio = (str: string): { n: number, d: number, val: number } => {
  const parts = str.split('/').map(s => parseInt(s.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
    return { n: parts[0], d: parts[1], val: parts[0] / parts[1] };
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    return { n: parts[0], d: 1, val: parts[0] };
  }
  // Fallback
  return { n: 1, d: 1, val: 1 };
};

// --- Generation ---

export const generateGrid = (size: number, csvData: string): LatticeNode[] => {
  const nodes: LatticeNode[] = [];
  
  // Parse CSV into rows
  const rows = csvData.split('\n').map(row => row.split(',').map(cell => cell.trim()));

  const centerOffset = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Get data if exists, else default 1/1
      const rawCell = rows[y] && rows[y][x] ? rows[y][x] : "1/1";
      
      // Clean string
      const cleanStr = rawCell.replace(/[^0-9/]/g, '');
      const { n, d, val } = parseRatio(cleanStr || "1/1");
      
      const limitTop = getMaxPrime(n);
      const limitBottom = getMaxPrime(d);

      // Map grid coordinates to centered layout
      // x increases right, y increases down (screen coords)
      // Visual Grid: (0,0) is top-left of the input
      const posX = (x - centerOffset); 
      const posY = (y - centerOffset);

      nodes.push({
        id: `${x}_${y}`, // Unique ID based on grid position
        label: `${n}/${d}`,
        ratio: val,
        x: posX,
        y: posY,
        limitTop,
        limitBottom
      });
    }
  }

  return nodes;
};
