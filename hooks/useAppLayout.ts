
import { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { PIXELS_PER_MM, SCROLLBAR_WIDTH } from '../constants';

const REFERENCE_SHORT_EDGE = 1080;

const getSafeAreas = () => {
    if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
    const div = document.createElement('div');
    div.style.paddingTop = 'env(safe-area-inset-top)';
    div.style.paddingRight = 'env(safe-area-inset-right)';
    div.style.paddingBottom = 'env(safe-area-inset-bottom)';
    div.style.paddingLeft = 'env(safe-area-inset-left)';
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    document.body.appendChild(div);
    const computed = getComputedStyle(div);
    const safe = {
        top: parseInt(computed.paddingTop) || 0,
        right: parseInt(computed.paddingRight) || 0,
        bottom: parseInt(computed.paddingBottom) || 0,
        left: parseInt(computed.paddingLeft) || 0
    };
    document.body.removeChild(div);
    return safe;
};

const calculateLayout = (w: number, h: number, scale: number, settings: AppSettings) => {
    const safeArea = getSafeAreas();
    const marginPx = (settings.uiEdgeMargin || 4) * PIXELS_PER_MM;
    
    const marginLeft = marginPx + safeArea.left;
    const marginTop = marginPx + safeArea.top;
    const marginRight = marginPx + safeArea.right + SCROLLBAR_WIDTH;
    const marginBottom = marginPx + safeArea.bottom + SCROLLBAR_WIDTH;
    
    const internalBlockGap = 24 * scale; 
    const baseGap = Math.max(marginPx, 32 * scale); 

    const volumeBarWidth = (settings.uiSizes?.volume?.width || 600) * scale;
    
    const settingsGroupHeight = 40; 
    const largeBtn = 80 * scale; 
    const perfBtn = 92 * scale; 
    
    const colWidth = 136 * scale; 

    const verticalStackGap = 12 * PIXELS_PER_MM * scale; 
    
    const headerGap = 8 * scale; 
    const settingsGroupWidth = 170;

    const newPos = { ...settings.uiPositions };

    newPos.arpeggioBar = { x: marginLeft, y: marginTop };
    
    const volX = w - marginRight - settingsGroupWidth - headerGap - volumeBarWidth;
    newPos.volume = { x: volX, y: marginTop };

    // Bottom Bar Y Calculation
    const bottomY = h - marginBottom - largeBtn; 

    if (w < 600) {
        newPos.layers = { x: -9999, y: -9999 };
        newPos.instruments = { x: -9999, y: -9999 };
    } else {
        const extraLimitMargin = 12 * scale;
        const limitBarX = w - marginRight - colWidth - extraLimitMargin;
        const layersY = marginTop + settingsGroupHeight + verticalStackGap;
        newPos.layers = { x: limitBarX, y: layersY };

        // Center Instruments Cluster vertically between Arp Bar and Bottom Controls
        // Arp Bar Height approx 50px scaled. Bottom starts at bottomY.
        const topSpace = marginTop + (50 * scale);
        const availableHeight = bottomY - topSpace;
        
        // Revised Height Calculation for 5 Buttons:
        // 5 buttons * 78px + 4 gaps * 12px + padding ~20px = 390 + 48 + 20 = 458px
        const clusterHeight = 460 * scale; 
        
        // Weighted positioning: 
        // Instead of pure center (0.5), use 0.25 (25%) of the available slack space 
        // to position it closer to the Arpeggiator Bar (top).
        let targetY = topSpace;
        
        if (availableHeight > clusterHeight) {
            const slack = availableHeight - clusterHeight;
            targetY = topSpace + (slack * 0.25);
        } else {
            // If tight, center it
            targetY = topSpace + (availableHeight / 2) - (clusterHeight / 2);
        }
        
        // Ensure it doesn't overlap top or bottom with a minimum safety margin
        const clampedY = Math.max(topSpace + (10 * scale), Math.min(targetY, bottomY - clusterHeight - (10 * scale)));

        newPos.instruments = { x: marginLeft, y: clampedY };
    }

    newPos.space = { x: -9999, y: -9999 };

    let currentX = marginLeft;
    
    newPos.center = { x: currentX, y: bottomY };
    currentX += (largeBtn + internalBlockGap); 
    
    if (settings.showIncreaseDepthButton) {
        newPos.depth = { x: currentX, y: bottomY };
        currentX += (largeBtn + internalBlockGap);
        newPos.decreaseDepth = { x: currentX, y: bottomY };
        currentX += (largeBtn + internalBlockGap);
    }
    
    currentX += baseGap; 
    newPos.chords = { x: currentX, y: bottomY };

    const perfY = h - marginBottom - perfBtn;
    
    let rightX = w - marginRight - perfBtn; 
    newPos.panic = { x: rightX, y: perfY };
    
    rightX -= (perfBtn + internalBlockGap); 
    newPos.off = { x: rightX, y: perfY };
    
    rightX -= (perfBtn + internalBlockGap); 
    newPos.sust = { x: rightX, y: perfY };
    
    rightX -= (perfBtn + internalBlockGap); 
    newPos.bend = { x: rightX, y: perfY };
    
    newPos.latch = { x: -9999, y: -9999 };

    return newPos;
};

export const useAppLayout = (
    settings: AppSettings,
    updateSettings: (s: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void
) => {
    const [autoScaleFactor, setAutoScaleFactor] = useState(1.0);
    const [isShortScreen, setIsShortScreen] = useState(false);
    
    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    useEffect(() => {
        const handleResize = () => {
            const w = document.documentElement.clientWidth;
            const h = document.documentElement.clientHeight;
            
            setIsShortScreen(h < 800);

            const shortEdge = Math.min(w, h);
            const newAutoScale = shortEdge / REFERENCE_SHORT_EDGE;
            setAutoScaleFactor(newAutoScale);
            
            const currentSettings = settingsRef.current;
            const newEffectiveScale = newAutoScale * (currentSettings.uiScale || 1.0);
            
            const newPositions = calculateLayout(w, h, newEffectiveScale, currentSettings);
            
            updateSettings(prev => ({
                ...prev,
                uiPositions: newPositions
            }));
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [
        settings.uiScale, 
        settings.uiEdgeMargin, 
        settings.showIncreaseDepthButton, 
        settings.uiSizes
    ]);

    return { autoScaleFactor, isShortScreen };
};
