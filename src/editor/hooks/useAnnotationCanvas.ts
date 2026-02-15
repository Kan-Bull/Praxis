import { useEffect, useRef, useCallback, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import type { ToolType } from '../components/ToolPalette';
import type { BoundingRectLike } from '@shared/types';
import { viewportToCanvas, boundingRectCenter } from '../lib/coordinateScaler';

// Fabric types — imported dynamically to allow mocking in tests
type FabricCanvas = import('fabric').Canvas;
type FabricObject = import('fabric').FabricObject;

export interface UseAnnotationCanvasOptions {
  canvasHostRef: RefObject<HTMLDivElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  screenshotDataUrl: string | null;
  tool: ToolType;
  color: string;
  annotations: string | undefined;
  onAnnotationsChange: (json: string) => void;
  onBlurRequest: (region: { x: number; y: number; width: number; height: number }) => void;
  onCropRequest: (region: { x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number }) => void;
  onToolChange?: (tool: ToolType) => void;
  clickX?: number;
  clickY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  boundingRect?: BoundingRectLike;
  stepNumber?: number;
}

export interface UseAnnotationCanvasReturn {
  deleteActiveObject: () => void;
  canvas: FabricCanvas | null;
}

export function useAnnotationCanvas({
  canvasHostRef,
  containerRef,
  screenshotDataUrl,
  tool,
  color,
  annotations,
  onAnnotationsChange,
  onBlurRequest,
  onCropRequest,
  onToolChange,
  clickX,
  clickY,
  viewportWidth,
  viewportHeight,
  boundingRect,
  stepNumber,
}: UseAnnotationCanvasOptions): UseAnnotationCanvasReturn {
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const scaleRef = useRef(1);
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const tempRectRef = useRef<FabricObject | null>(null);
  const tempArrowLineRef = useRef<FabricObject | null>(null);
  const imgDimsRef = useRef({ width: 800, height: 600 });

  // Track current tool via ref so applyToolMode stays dependency-stable
  const toolRef = useRef(tool);
  toolRef.current = tool;

  // Stable helper to (re-)apply tool mode to canvas — called after any
  // operation that may reset object selectability (clear, loadFromJSON).
  const applyToolMode = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const t = toolRef.current;
    canvas.isDrawingMode = false;
    canvas.selection = t === 'select';
    canvas.defaultCursor = t === 'select' ? 'default' : 'crosshair';
    canvas.forEachObject((obj: FabricObject) => {
      obj.selectable = t === 'select';
      obj.evented = t === 'select';
    });
    canvas.renderAll();
  }, []);

  // Create/dispose canvas
  useEffect(() => {
    if (!canvasHostRef.current) return;

    let disposed = false;
    const el = document.createElement('canvas');
    el.dataset.testid = 'annotation-canvas';
    canvasHostRef.current.appendChild(el);

    import('fabric').then(({ Canvas }) => {
      if (disposed) return;
      const canvas = new Canvas(el, {
        width: 800,
        height: 600,
        selection: true,
      });
      fabricCanvasRef.current = canvas;
      setCanvasReady(true);
    });

    return () => {
      disposed = true;
      if (fabricCanvasRef.current) {
        try {
          fabricCanvasRef.current.dispose();
        } catch {
          // Fabric.js dispose does DOM manipulation (replaceChild) that can
          // throw if Preact already removed the host from the tree
        }
        fabricCanvasRef.current = null;
      }
      if (canvasHostRef.current) {
        canvasHostRef.current.innerHTML = '';
      }
    };
  }, [canvasHostRef]);

  // Load background image when screenshot changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !screenshotDataUrl) return;

    import('fabric').then(({ FabricImage }) => {
      FabricImage.fromURL(screenshotDataUrl).then((img) => {
        if (!fabricCanvasRef.current) return;

        const imgWidth = img.width ?? 800;
        const imgHeight = img.height ?? 600;
        imgDimsRef.current = { width: imgWidth, height: imgHeight };

        // Get container width for dynamic sizing (use layout container, not Fabric wrapper)
        // Reserve space for blueprint gutters: use 85% of container, cap at 1600px
        const containerWidth = containerRef.current?.clientWidth ?? 800;
        const maxWidth = Math.max(Math.min(Math.round(containerWidth * 0.85), 1600), 400);

        const scale = imgWidth > maxWidth ? maxWidth / imgWidth : 1;
        scaleRef.current = scale;

        const displayWidth = Math.round(imgWidth * scale);
        const displayHeight = Math.round(imgHeight * scale);

        canvas.setDimensions({ width: displayWidth, height: displayHeight });
        canvas.backgroundImage = img;
        img.set({
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0,
          scaleX: scale,
          scaleY: scale,
        });
        canvas.renderAll();

        // Auto-place click indicator if no annotations exist yet
        if (!annotations && stepNumber != null) {
          // Determine viewport-space click position
          let vpX: number | undefined = clickX;
          let vpY: number | undefined = clickY;

          // Fall back to bounding rect center when exact click coords are absent.
          // Skip zero-size rects (e.g. screenshot mode) — center would be (0,0).
          if ((vpX == null || vpY == null) && boundingRect && (boundingRect.width > 0 || boundingRect.height > 0)) {
            const center = boundingRectCenter(boundingRect);
            vpX = center.x;
            vpY = center.y;
          }

          if (vpX != null && vpY != null) {
            // Build scale context: use stored viewport dimensions or fall back
            // to the image dimensions (assumes 1:1 viewport-to-image mapping)
            const vw = viewportWidth ?? imgWidth;
            const vh = viewportHeight ?? imgHeight;

            const canvasPos = viewportToCanvas(vpX, vpY, {
              viewportWidth: vw,
              viewportHeight: vh,
              canvasWidth: displayWidth,
              canvasHeight: displayHeight,
            });

            import('../lib/fabricHelpers').then(({ createClickIndicator }) => {
              if (!fabricCanvasRef.current) return;
              const indicator = createClickIndicator(
                canvasPos.x,
                canvasPos.y,
                stepNumber,
              );
              canvas.add(indicator);
              canvas.renderAll();

              // Persist the indicator so it survives step switching
              const json = JSON.stringify(canvas.toJSON());
              onAnnotationsChange(json);
            });
          }
        }
      });
    });
  }, [screenshotDataUrl, canvasReady]);

  // Load annotations when they change (step switch)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (!annotations) {
      // Clear existing annotations but keep background
      const bg = canvas.backgroundImage;
      canvas.clear();
      canvas.backgroundImage = bg;
      applyToolMode();
      return;
    }

    try {
      const bg = canvas.backgroundImage;
      canvas.loadFromJSON(annotations).then(() => {
        if (!fabricCanvasRef.current) return;
        canvas.backgroundImage = bg;
        applyToolMode();
      });
    } catch {
      // Invalid JSON — ignore
    }
  }, [annotations]);

  // Set up drawing mode based on tool
  useEffect(() => {
    applyToolMode();
  }, [tool]);

  // Handle mouse events for rect/text/blur drawing
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    if (tool !== 'rect' && tool !== 'text' && tool !== 'blur' && tool !== 'crop' && tool !== 'arrow') return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseDown = (opt: any) => {
      isDrawingRef.current = true;
      const pointer = canvas.getScenePoint(opt.e);
      drawStartRef.current = { x: pointer.x, y: pointer.y };

      if (tool === 'rect' || tool === 'blur' || tool === 'crop') {
        import('fabric').then(({ Rect }) => {
          const rect = new Rect({
            left: pointer.x,
            top: pointer.y,
            originX: 'left',
            originY: 'top',
            width: 0,
            height: 0,
            fill: tool === 'blur' ? 'rgba(0,0,0,0.3)' : tool === 'crop' ? 'rgba(34,211,238,0.1)' : 'transparent',
            stroke: tool === 'blur' ? '#ef4444' : tool === 'crop' ? '#22d3ee' : color,
            strokeWidth: 2,
            strokeDashArray: (tool === 'blur' || tool === 'crop') ? [5, 5] : undefined,
            selectable: false,
            evented: false,
          });
          tempRectRef.current = rect;
          canvas.add(rect);
        });
      } else if (tool === 'arrow') {
        import('fabric').then(({ Line }) => {
          const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: color,
            strokeWidth: 3,
            fill: '',
            selectable: false,
            evented: false,
          });
          tempArrowLineRef.current = line;
          canvas.add(line);
        });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseMove = (opt: any) => {
      if (!isDrawingRef.current || !drawStartRef.current) return;
      const pointer = canvas.getScenePoint(opt.e);

      if (tempArrowLineRef.current) {
        tempArrowLineRef.current.set({ x2: pointer.x, y2: pointer.y } as any);
        canvas.renderAll();
        return;
      }

      if (!tempRectRef.current) return;
      const start = drawStartRef.current;

      const left = Math.min(start.x, pointer.x);
      const top = Math.min(start.y, pointer.y);
      const width = Math.abs(pointer.x - start.x);
      const height = Math.abs(pointer.y - start.y);

      tempRectRef.current.set({ left, top, width, height });
      canvas.renderAll();
    };

    const handleMouseUp = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      // Arrow finalization
      const arrowLine = tempArrowLineRef.current;
      if (arrowLine) {
        tempArrowLineRef.current = null;
        const start = drawStartRef.current;
        if (!start) { canvas.remove(arrowLine); return; }

        const endX = (arrowLine as any).x2 ?? start.x;
        const endY = (arrowLine as any).y2 ?? start.y;
        const dist = Math.hypot(endX - start.x, endY - start.y);

        if (dist < 5) {
          canvas.remove(arrowLine);
          return;
        }

        canvas.remove(arrowLine);
        import('../lib/fabricHelpers').then(({ createArrowAnnotation }) => {
          if (!fabricCanvasRef.current) return;
          const arrow = createArrowAnnotation(start.x, start.y, endX, endY, color);
          canvas.add(arrow);
          canvas.renderAll();
          serializeAnnotations();
        });
        return;
      }

      // Text tool — place text at click start position (no rect)
      if (tool === 'text') {
        const start = drawStartRef.current;
        if (!start) return;

        import('fabric').then(({ IText }) => {
          if (!fabricCanvasRef.current) return;
          const text = new IText('Text', {
            left: start.x,
            top: start.y,
            originX: 'left',
            originY: 'top',
            fontSize: 18,
            fill: color,
            fontFamily: 'sans-serif',
          });
          canvas.add(text);
          canvas.setActiveObject(text);
          text.enterEditing();
          text.selectAll();
          canvas.renderAll();
          serializeAnnotations();
          onToolChange?.('select');
        });
        return;
      }

      const rect = tempRectRef.current;
      if (!rect) return;

      const left = (rect as unknown as { left: number }).left ?? 0;
      const top = (rect as unknown as { top: number }).top ?? 0;
      const width = (rect as unknown as { width: number }).width ?? 0;
      const height = (rect as unknown as { height: number }).height ?? 0;

      // Ignore tiny accidental drags
      if (width < 5 || height < 5) {
        canvas.remove(rect);
        tempRectRef.current = null;

        return;
      }

      if (tool === 'blur') {
        // Remove temp rect and fire blur request
        canvas.remove(rect);
        tempRectRef.current = null;

        const scale = scaleRef.current;
        onBlurRequest({
          x: left / scale,
          y: top / scale,
          width: width / scale,
          height: height / scale,
        });
        return;
      }

      if (tool === 'crop') {
        // Remove temp rect and fire crop request
        canvas.remove(rect);
        tempRectRef.current = null;

        const scale = scaleRef.current;
        onCropRequest({
          x: left / scale,
          y: top / scale,
          width: width / scale,
          height: height / scale,
          imageWidth: imgDimsRef.current.width,
          imageHeight: imgDimsRef.current.height,
        });
        return;
      }

      // rect tool — finalize
      rect.set({ selectable: true, evented: true });
      tempRectRef.current = null;
      canvas.renderAll();
      serializeAnnotations();
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [tool, color, onBlurRequest, onCropRequest]);

  // Serialize on object modification
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleModified = () => serializeAnnotations();

    canvas.on('object:modified', handleModified);
    return () => {
      canvas.off('object:modified', handleModified);
    };
  }, [onAnnotationsChange]);

  function serializeAnnotations() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON());
    onAnnotationsChange(json);
  }

  const deleteActiveObject = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.renderAll();
      serializeAnnotations();
    }
  }, [onAnnotationsChange]);

  return {
    deleteActiveObject,
    canvas: fabricCanvasRef.current,
  };
}
