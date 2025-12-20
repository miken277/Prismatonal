
import { useState, useEffect, useMemo, useRef } from 'react';
import { AppSettings, LatticeNode, LatticeLine, StoredLayout } from '../types';
import { generateLattice } from '../services/LatticeService';
import { store } from '../services/Store';

export const useLatticeData = (settings: AppSettings, globalScale: number) => {
    const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
    const [isGenerating, setIsGenerating] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [dynamicSize, setDynamicSize] = useState(2000);
    const dynamicSizeRef = useRef(2000);

    const generationDeps = useMemo(() => {
        return JSON.stringify({
            tuning: settings.tuningSystem,
            layout: settings.layoutApproach,
            depths: settings.limitDepths,
            complexities: settings.limitComplexities,
            hidden: settings.hiddenLimits,
            ratio: settings.latticeAspectRatio,
            skin: settings.activeSkin,
            origins: settings.generationOrigins
        });
    }, [settings.tuningSystem, settings.layoutApproach, settings.limitDepths, settings.limitComplexities, settings.hiddenLimits, settings.latticeAspectRatio, settings.activeSkin, settings.generationOrigins]);

    useEffect(() => {
        setIsGenerating(true);
        const timerId = setTimeout(() => {
            const currentLayout = store.getSnapshot().layout;
            
            // 1. Check if we have a valid cached layout
            if (currentLayout && currentLayout.hash === generationDeps) {
                setData({ nodes: currentLayout.nodes, lines: currentLayout.lines });
                setDynamicSize(currentLayout.dynamicSize);
                dynamicSizeRef.current = currentLayout.dynamicSize;
                setIsGenerating(false);
                return;
            }

            // 2. Otherwise Generate
            const effectiveSettings: AppSettings = JSON.parse(JSON.stringify(settings));
            const hiddenLimits = effectiveSettings.hiddenLimits || [];
            hiddenLimits.forEach((limit: number) => {
                // @ts-ignore
                if (effectiveSettings.limitDepths[limit] !== undefined) effectiveSettings.limitDepths[limit] = 0;
            });

            // Use Origins from Settings
            const result = generateLattice(effectiveSettings, effectiveSettings.generationOrigins);
            
            const visibleNodeIds = new Set(result.nodes.map(n => n.id));
            const visibleLines = result.lines.filter(l => {
                if (hiddenLimits.includes(l.limit)) return false;
                if (!visibleNodeIds.has(l.sourceId) || !visibleNodeIds.has(l.targetId)) return false;
                return true;
            });

            let maxExtent = 0;
            for (const n of result.nodes) {
                const absX = Math.abs(n.x);
                const absY = Math.abs(n.y);
                if (absX > maxExtent) maxExtent = absX;
                if (absY > maxExtent) maxExtent = absY;
            }

            const padding = 600; 
            const spacing = settings.buttonSpacingScale * globalScale; 
            const calculatedSize = (maxExtent * spacing * 2) + padding;
            const finalSize = Math.max(calculatedSize, window.innerWidth, window.innerHeight);

            const MAX_CANVAS_SIZE = 5000;
            const clampedSize = Math.min(finalSize, MAX_CANVAS_SIZE);

            if (Math.abs(clampedSize - dynamicSizeRef.current) > 50) {
                setDynamicSize(clampedSize);
                dynamicSizeRef.current = clampedSize;
            }

            // 3. Update State and Cache in Store
            const newData = { nodes: result.nodes, lines: visibleLines };
            setData(newData);
            
            store.setLayout({
                hash: generationDeps,
                nodes: newData.nodes,
                lines: newData.lines,
                dynamicSize: clampedSize
            });

            setIsGenerating(false);
        }, 10);
        return () => clearTimeout(timerId);
    }, [generationDeps]); 

    // Update dynamic size if scale changes without regeneration
    useEffect(() => {
        let maxExtent = 0;
        for (const n of data.nodes) {
            const absX = Math.abs(n.x);
            const absY = Math.abs(n.y);
            if (absX > maxExtent) maxExtent = absX;
            if (absY > maxExtent) maxExtent = absY;
        }
        const padding = 600; 
        const spacing = settings.buttonSpacingScale * globalScale;
        const calculatedSize = (maxExtent * spacing * 2) + padding;
        const finalSize = Math.max(calculatedSize, window.innerWidth, window.innerHeight);
        
        const MAX_CANVAS_SIZE = 5000;
        const clampedSize = Math.min(finalSize, MAX_CANVAS_SIZE);

        if (Math.abs(clampedSize - dynamicSize) > 50) {
            setDynamicSize(clampedSize);
            dynamicSizeRef.current = clampedSize;
        }
    }, [settings.buttonSpacingScale, globalScale]);

    return {
        data,
        isGenerating,
        isInitialLoad,
        setIsInitialLoad,
        dynamicSize,
        dynamicSizeRef
    };
};
