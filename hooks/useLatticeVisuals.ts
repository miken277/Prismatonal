
import { useMemo } from 'react';
import { LatticeNode, LatticeLine, AppSettings } from '../types';

const GRID_CELL_SIZE = 100;

export const useLatticeVisuals = (
    data: { nodes: LatticeNode[], lines: LatticeLine[] },
    settings: AppSettings,
    dynamicSize: number,
    globalScale: number,
    visualLatchedNodes: Map<string, string>
) => {
    
    const nodeMap = useMemo(() => {
        return new Map(data.nodes.map(n => [n.id, n]));
    }, [data.nodes]);

    const spatialGrid = useMemo(() => {
        const grid = new Map<string, LatticeNode[]>();
        const centerOffset = dynamicSize / 2;
        const spacing = settings.buttonSpacingScale * globalScale;

        data.nodes.forEach(node => {
            const x = node.x * spacing + centerOffset;
            const y = node.y * spacing + centerOffset;
            const col = Math.floor(x / GRID_CELL_SIZE);
            const row = Math.floor(y / GRID_CELL_SIZE);
            const key = `${col},${row}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key)!.push(node);
        });
        return grid;
    }, [data.nodes, settings.buttonSpacingScale, dynamicSize, globalScale]);

    const activeLines = useMemo(() => {
        const latched = visualLatchedNodes;
        const lines = data.lines;
        const active: LatticeLine[] = [];
        const reach = settings.voiceLeadingSteps || 1;
        
        if (latched.size < 2) return [];

        if (reach === 1) {
            for (const line of lines) {
                const s = line.sourceId;
                const t = line.targetId;
                if (latched.has(s) && latched.has(t)) {
                    active.push(line);
                }
            }
        } 
        else if (reach === 2) {
            const activeNodes = Array.from(latched.keys()).map(id => nodeMap.get(id)).filter(n => n) as LatticeNode[];
            for (let i=0; i<activeNodes.length; i++) {
                for (let j=i+1; j<activeNodes.length; j++) {
                    const A = activeNodes[i];
                    const B = activeNodes[j];
                    let dist = 0;
                    for (let k=0; k < A.coords.length; k++) {
                        dist += Math.abs(A.coords[k] - B.coords[k]);
                    }
                    dist += Math.abs(A.octave - B.octave); 

                    if (dist <= 2) {
                        const maxP = Math.max(A.maxPrime, B.maxPrime);
                        active.push({
                            id: `${A.id}-${B.id}`,
                            x1: A.x, y1: A.y,
                            x2: B.x, y2: B.y,
                            limit: maxP,
                            sourceId: A.id, targetId: B.id
                        });
                    }
                }
            }
        }
        return active;
    }, [data.lines, visualLatchedNodes, settings.voiceLeadingSteps, nodeMap]);
  
    const brightenedLines = useMemo(() => {
        if (!settings.lineBrighteningEnabled || visualLatchedNodes.size === 0) return [];
        const activeIds = new Set(visualLatchedNodes.keys());
        const resultLines = new Set<LatticeLine>();
        const step1Neighbors = new Set<string>();

        data.lines.forEach(line => {
            const sActive = activeIds.has(line.sourceId);
            const tActive = activeIds.has(line.targetId);
            if (sActive || tActive) {
                resultLines.add(line);
                if (sActive) step1Neighbors.add(line.targetId);
                if (tActive) step1Neighbors.add(line.sourceId);
            }
        });

        if (settings.lineBrighteningSteps === 2) {
            data.lines.forEach(line => {
                if (resultLines.has(line)) return;
                const sNeighbor = step1Neighbors.has(line.sourceId);
                const tNeighbor = step1Neighbors.has(line.targetId);
                if (sNeighbor || tNeighbor) {
                    resultLines.add(line);
                }
            });
        }
        return Array.from(resultLines);
    }, [visualLatchedNodes, data.lines, settings.lineBrighteningEnabled, settings.lineBrighteningSteps]);

    return { nodeMap, spatialGrid, activeLines, brightenedLines };
};
