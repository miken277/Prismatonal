
import { useState, useEffect, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine } from '../types';
import { generateLattice } from '../services/LatticeService';
import { GRID_CELL_SIZE } from '../constants';

export const useLatticeData = (settings: AppSettings, globalScale: number) => {
    const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
    const [isGenerating, setIsGenerating] = useState(false);
    const [dynamicSize, setDynamicSize] = useState(2000);
    
    const centerOffset = dynamicSize / 2;

    const nodeMap = useMemo(() => {
        return new Map(data.nodes.map(n => [n.id, n]));
    }, [data.nodes]);

    const spatialGrid = useMemo(() => {
        const grid = new Map<string, LatticeNode[]>();
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
    }, [data.nodes, settings.buttonSpacingScale, globalScale, centerOffset]);

    const adjacencyMap = useMemo(() => {
        const map = new Map<string, { target: string, limit: number }[]>();
        data.lines.forEach(line => {
            if (!map.has(line.sourceId)) map.set(line.sourceId, []);
            if (!map.has(line.targetId)) map.set(line.targetId, []);
            map.get(line.sourceId)!.push({ target: line.targetId, limit: line.limit });
            map.get(line.targetId)!.push({ target: line.sourceId, limit: line.limit });
        });
        return map;
    }, [data.lines]);

    const generationDeps = useMemo(() => {
        return JSON.stringify({
            tuning: settings.tuningSystem,
            layout: settings.layoutApproach,
            depths: settings.limitDepths,
            // @ts-ignore
            complexities: settings.limitComplexities,
            hidden: settings.hiddenLimits,
            ratio: settings.latticeAspectRatio,
            skin: settings.activeSkin,
            layerOrder: settings.layoutApproach === 'diamond' ? settings.layerOrder : [] 
        });
        // @ts-ignore
    }, [settings.tuningSystem, settings.layoutApproach, settings.limitDepths, settings.limitComplexities, settings.hiddenLimits, settings.latticeAspectRatio, settings.activeSkin, settings.layerOrder]);

    useEffect(() => {
        setIsGenerating(true);
        const timerId = setTimeout(() => {
            const effectiveSettings: AppSettings = JSON.parse(JSON.stringify(settings));
            const hiddenLimits = effectiveSettings.hiddenLimits || [];
            hiddenLimits.forEach((limit: number) => {
                // @ts-ignore
                if (effectiveSettings.limitDepths[limit] !== undefined) effectiveSettings.limitDepths[limit] = 0;
            });

            const result = generateLattice(effectiveSettings);
            const visibleNodeIds = new Set(result.nodes.map(n => n.id));
            const visibleLines = result.lines.filter(l => {
                if (hiddenLimits.includes(l.limit)) return false;
                if (!visibleNodeIds.has(l.sourceId) || !visibleNodeIds.has(l.targetId)) return false;
                return true;
            });

            setData({ nodes: result.nodes, lines: visibleLines });
            setIsGenerating(false);
        }, 10);
        return () => clearTimeout(timerId);
    }, [generationDeps]);

    useEffect(() => {
        if (data.nodes.length === 0) return;

        let maxExtent = 0;
        for (const n of data.nodes) {
            const absX = Math.abs(n.x);
            const absY = Math.abs(n.y);
            if (absX > maxExtent) maxExtent = absX;
            if (absY > maxExtent) maxExtent = absY;
        }
        
        const spacing = settings.buttonSpacingScale * globalScale;
        const padding = 1000; 
        const calculatedSize = (maxExtent * spacing * 2) + padding;
        
        const minSize = Math.max(typeof window !== 'undefined' ? window.innerWidth : 1000, typeof window !== 'undefined' ? window.innerHeight : 800);
        const MAX_CANVAS_SIZE = 12000; // Increased limit for larger diamonds
        const finalSize = Math.min(Math.max(calculatedSize, minSize), MAX_CANVAS_SIZE);

        if (Math.abs(finalSize - dynamicSize) > 100) {
            setDynamicSize(finalSize);
        }
    }, [data.nodes, settings.buttonSpacingScale, globalScale]);

    return {
        data,
        isGenerating,
        dynamicSize,
        nodeMap,
        spatialGrid,
        adjacencyMap,
        centerOffset
    };
};
