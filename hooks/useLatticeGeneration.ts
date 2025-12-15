
import { useState, useEffect, useRef, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine } from '../types';
import { generateLattice } from '../services/LatticeService';

const MAX_CANVAS_SIZE = 8192; // Hardware limit safety cap (common max texture size)

export const useLatticeGeneration = (settings: AppSettings) => {
    const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
    const [isGenerating, setIsGenerating] = useState(false);
    const [dynamicSize, setDynamicSize] = useState(2000);

    // Track previous spacing to optimize resize logic
    const prevSpacingRef = useRef(settings.buttonSpacingScale);

    // Dependencies that trigger a full regeneration
    const generationDeps = useMemo(() => JSON.stringify({
        depths: settings.limitDepths,
        complexities: settings.limitComplexities,
        hidden: settings.hiddenLimits,
        ratio: settings.latticeAspectRatio
    }), [settings.limitDepths, settings.limitComplexities, settings.hiddenLimits, settings.latticeAspectRatio]);

    useEffect(() => {
        setIsGenerating(true);
        // Timeout allows the UI to update (show spinner) before the heavy calculation runs on main thread
        const timerId = setTimeout(() => {
            const effectiveSettings: AppSettings = JSON.parse(JSON.stringify(settings));
            const hiddenLimits = effectiveSettings.hiddenLimits || [];
            
            // Optimization: Skip generation for hidden limits by setting depth to 0
            hiddenLimits.forEach((limit: number) => {
                // @ts-ignore
                if (effectiveSettings.limitDepths[limit] !== undefined) effectiveSettings.limitDepths[limit] = 0;
            });

            const result = generateLattice(effectiveSettings);
            
            // Post-process: Filter lines connected to visible nodes only
            const visibleNodeIds = new Set(result.nodes.map(n => n.id));
            const visibleLines = result.lines.filter(l => {
                if (hiddenLimits.includes(l.limit)) return false;
                if (!visibleNodeIds.has(l.sourceId) || !visibleNodeIds.has(l.targetId)) return false;
                return true;
            });

            // Calculate max extent for dynamic canvas sizing
            let maxExtent = 0;
            for (const n of result.nodes) {
                const absX = Math.abs(n.x);
                const absY = Math.abs(n.y);
                if (absX > maxExtent) maxExtent = absX;
                if (absY > maxExtent) maxExtent = absY;
            }

            const padding = 600; 
            const spacing = settings.buttonSpacingScale; 
            const calculatedSize = (maxExtent * spacing * 2) + padding;
            
            // Clamp size to prevent browser crashes on extreme settings
            const finalSize = Math.min(MAX_CANVAS_SIZE, Math.max(calculatedSize, window.innerWidth, window.innerHeight));

            // Only update size if significant change to prevent jitter
            if (Math.abs(finalSize - dynamicSize) > 50) setDynamicSize(finalSize);
            
            setData({ nodes: result.nodes, lines: visibleLines });
            setIsGenerating(false);
            prevSpacingRef.current = spacing;
        }, 10);
        return () => clearTimeout(timerId);
    }, [generationDeps]);

    // Fast resize if only spacing changes (no regeneration needed)
    useEffect(() => {
        if (settings.buttonSpacingScale === prevSpacingRef.current) return;
        if (data.nodes.length === 0) return;

        let maxExtent = 0;
        for (const n of data.nodes) {
            const absX = Math.abs(n.x);
            const absY = Math.abs(n.y);
            if (absX > maxExtent) maxExtent = absX;
            if (absY > maxExtent) maxExtent = absY;
        }
        const padding = 600; 
        const spacing = settings.buttonSpacingScale;
        const calculatedSize = (maxExtent * spacing * 2) + padding;
        const finalSize = Math.min(MAX_CANVAS_SIZE, Math.max(calculatedSize, window.innerWidth, window.innerHeight));
        
        if (Math.abs(finalSize - dynamicSize) > 50) setDynamicSize(finalSize);
        prevSpacingRef.current = spacing;
    }, [settings.buttonSpacingScale]);

    return { data, isGenerating, dynamicSize };
};
