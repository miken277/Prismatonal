import React, { useCallback } from 'react';
import { XYPos } from '../types';
import { MARGIN_3MM, SCROLLBAR_WIDTH } from '../constants';

export const useDragManager = (
    enable: boolean,
    draggingId: string | null,
    setDraggingId: (id: string | null) => void,
    onUpdate: (id: string, pos: XYPos) => void,
    positions: Record<string, XYPos>
) => {
    const handleDrag = useCallback((e: React.PointerEvent, id: string) => {
        if (!enable) return;
        if (draggingId !== null && draggingId !== id) return;

        const el = e.currentTarget as HTMLElement;
        const startX = e.clientX;
        const startY = e.clientY;
        
        const initialPos = positions[id];
        if (!initialPos) return;

        const initialLeft = initialPos.x;
        const initialTop = initialPos.y;

        el.setPointerCapture(e.pointerId);
        setDraggingId(id);

        const onMove = (evt: PointerEvent) => {
            const deltaX = evt.clientX - startX;
            const deltaY = evt.clientY - startY;
            let newX = initialLeft + deltaX;
            let newY = initialTop + deltaY;

            // Boundary checks
            const maxX = window.innerWidth - el.offsetWidth - MARGIN_3MM - SCROLLBAR_WIDTH;
            const maxY = window.innerHeight - el.offsetHeight - MARGIN_3MM - SCROLLBAR_WIDTH;
            const minX = MARGIN_3MM;
            const minY = MARGIN_3MM;

            newX = Math.max(minX, Math.min(newX, maxX));
            newY = Math.max(minY, Math.min(newY, maxY));

            onUpdate(id, { x: newX, y: newY });
        };

        const onUp = () => {
            setDraggingId(null);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }, [enable, draggingId, setDraggingId, onUpdate, positions]);

    return handleDrag;
};