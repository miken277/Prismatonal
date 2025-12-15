
import { generateLattice } from './LatticeService';
import { AppSettings } from '../types';

// Define the shape of the data returned by this worker
export interface LatticeWorkerResponse {
    nodes: any[];
    lines: any[];
    maxExtent: number;
}

self.onmessage = (e: MessageEvent<AppSettings>) => {
    const settings = e.data;

    try {
        // Clone settings to modify for generation logic without side effects
        const effectiveSettings: AppSettings = JSON.parse(JSON.stringify(settings));
        const hiddenLimits = effectiveSettings.hiddenLimits || [];
        
        // Zero out depths for hidden limits so the generator skips them entirely for efficiency
        hiddenLimits.forEach((limit: number) => {
             // @ts-ignore
            if (effectiveSettings.limitDepths[limit] !== undefined) effectiveSettings.limitDepths[limit] = 0;
        });

        // Heavy computation
        const result = generateLattice(effectiveSettings);

        // Post-processing: Filter lines based on hidden limits and connectivity
        const visibleNodeIds = new Set(result.nodes.map(n => n.id));
        const visibleLines = result.lines.filter(l => {
            if (hiddenLimits.includes(l.limit)) return false;
            if (!visibleNodeIds.has(l.sourceId) || !visibleNodeIds.has(l.targetId)) return false;
            return true;
        });

        // Calculate extent for canvas sizing (avoid doing this on UI thread)
        let maxExtent = 0;
        for (const n of result.nodes) {
            const absX = Math.abs(n.x);
            const absY = Math.abs(n.y);
            if (absX > maxExtent) maxExtent = absX;
            if (absY > maxExtent) maxExtent = absY;
        }

        const response: LatticeWorkerResponse = {
            nodes: result.nodes,
            lines: visibleLines,
            maxExtent
        };

        self.postMessage(response);

    } catch (err) {
        console.error("Lattice Generation Worker Error", err);
    }
};
