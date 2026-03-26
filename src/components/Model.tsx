import * as PIXI from 'pixi.js';
import { Application } from 'pixi.js';
import { useAtomValue, useAtom } from 'jotai';
import { audioAnalyserAtom } from '~/atoms/ChatAtom';
import { customModelPathAtom, modelTransformAtom } from '~/atoms/SettingsAtom';
import React, { useEffect, useRef, useCallback, memo } from 'react';
import { Live2DModel } from 'pixi-live2d-display/cubism4';

if (typeof window !== 'undefined') (window as any).PIXI = PIXI;

const SENSITIVITY = 0.95;
const SMOOTHNESS = 1;
const RECENTER_DELAY = 1000;
const DEFAULT_MODEL = '/model/vanilla/vanilla.model3.json';

const Model: React.FC = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioAnalyser = useAtomValue(audioAnalyserAtom);
  const customModelPath = useAtomValue(customModelPathAtom);
  const [transforms, setTransforms] = useAtom(modelTransformAtom);
  const transformsRef = useRef(transforms);
  const modelRef = useRef<any>(null);
  const appRef = useRef<Application | null>(null);
  const mouseMoveRef = useRef({ last: 0, target: { x: 0, y: 0 }, current: { x: 0, y: 0 } });
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothMouthRef = useRef(0);
  
  // Transform state
  const transformRef = useRef({ x: 0, y: 0, scale: 1, isDefault: true });
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const targetUrlRef = useRef<string>("");

  useEffect(() => { transformsRef.current = transforms; }, [transforms]);

  useEffect(() => {
    analyserRef.current = audioAnalyser;
    if (audioAnalyser) analyserDataRef.current = new Uint8Array(audioAnalyser.frequencyBinCount);
    else analyserDataRef.current = null;
  }, [audioAnalyser]);

  const applyTransform = useCallback(() => {
    const model = modelRef.current;
    if (model) {
      model.scale.set(transformRef.current.scale);
      model.position.set(transformRef.current.x, transformRef.current.y);
    }
  }, []);

  const saveTransform = useCallback(() => {
    const url = targetUrlRef.current;
    if (url && !transformRef.current.isDefault) {
      setTransforms(prev => ({
        ...prev,
        [url]: { x: transformRef.current.x, y: transformRef.current.y, scale: transformRef.current.scale }
      }));
    }
  }, [setTransforms]);

  const animateModel = useCallback((deltaTime: number) => {
    const model = modelRef.current;
    if (!model) return;

    const now = Date.now();
    const factor = Math.max(0, Math.min((now - mouseMoveRef.current.last - RECENTER_DELAY) / 1000, 1));
    const ease = Math.sin(Math.PI * factor / 2);
    mouseMoveRef.current.current.x += (mouseMoveRef.current.target.x * (1 - ease) - mouseMoveRef.current.current.x) * SMOOTHNESS * deltaTime;
    mouseMoveRef.current.current.y += (mouseMoveRef.current.target.y * (1 - ease) - mouseMoveRef.current.current.y) * SMOOTHNESS * deltaTime;
    model.internalModel.focusController?.focus(mouseMoveRef.current.current.x, mouseMoveRef.current.current.y);

    let mouthTarget = 0;
    if (analyserRef.current && analyserDataRef.current) {
      analyserRef.current.getByteFrequencyData(analyserDataRef.current);
      const sr = analyserRef.current.context.sampleRate;
      const binSize = sr / (analyserRef.current.fftSize || 2048);
      const start = Math.floor(300 / binSize);
      const end = Math.min(Math.floor(3000 / binSize), analyserDataRef.current.length);
      let sum = 0, count = 0;
      for (let i = start; i < end; i++) { sum += analyserDataRef.current[i]!; count++; }
      const avg = count > 0 ? sum / count : 0;
      const threshold = 15;
      mouthTarget = avg > threshold ? Math.min((avg - threshold) / 120, 1.0) : 0;
    }

    const sf = mouthTarget > smoothMouthRef.current ? 0.4 : 0.2;
    smoothMouthRef.current += (mouthTarget - smoothMouthRef.current) * sf;
    model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', smoothMouthRef.current);
  }, []);

  const renderLoop = useCallback((dt: number) => animateModel(dt), [animateModel]);

  // Handle pointer events for drag & drop & zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      container.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      transformRef.current.isDefault = false;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      applyTransform();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        container.releasePointerCapture(e.pointerId);
        saveTransform();
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      const scaleChange = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
      
      const prevScale = transformRef.current.scale;
      const newScale = prevScale * scaleChange;
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      transformRef.current.x = mouseX - (mouseX - transformRef.current.x) * (newScale / prevScale);
      transformRef.current.y = mouseY - (mouseY - transformRef.current.y) * (newScale / prevScale);
      transformRef.current.scale = newScale;
      transformRef.current.isDefault = false;
      
      applyTransform();
      saveTransform();
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('wheel', onWheel);
    };
  }, [applyTransform, saveTransform]);

  // Viewport tracking for look
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (isDraggingRef.current) return;
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        mouseMoveRef.current.target = {
          x: ((e.clientX - rect.left) / rect.width - 0.5) * 2 * SENSITIVITY,
          y: -(((e.clientY - rect.top) / rect.height - 0.5) * 2 * SENSITIVITY),
        };
        mouseMoveRef.current.last = Date.now();
      }
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  // PIXI App lifecycle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const app = new Application({
      backgroundAlpha: 0,
      resizeTo: window,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    
    // Style the generated canvas
    app.view.style.width = '100%';
    app.view.style.height = '100%';
    app.view.style.display = 'block';
    
    container.appendChild(app.view);
    appRef.current = app;
    app.ticker.add(renderLoop);

    const handleResize = () => { 
      app.renderer.resize(window.innerWidth, window.innerHeight); 
      if (transformRef.current.isDefault && modelRef.current) {
         const scale = Math.min(app.screen.width / modelRef.current.width, app.screen.height / modelRef.current.height);
         transformRef.current = { x: app.screen.width / 2, y: app.screen.height * 0.85, scale, isDefault: true };
         applyTransform();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      app.ticker.remove(renderLoop);
      app.destroy(true, { children: true, texture: true, baseTexture: true });
      appRef.current = null;
      modelRef.current = null;
    };
  }, [renderLoop, applyTransform]);

  // Load Model effect
  useEffect(() => {
    const url = customModelPath || DEFAULT_MODEL;
    targetUrlRef.current = url;

    let aborted = false;

    const load = async () => {
      // Small delay to allow React 18 strict mode double-effect to clear out
      await new Promise(r => setTimeout(r, 50));
      if (aborted || !appRef.current || targetUrlRef.current !== url) return;
      const app = appRef.current;

      try {
        const m = await Live2DModel.from(url);
        if (aborted || targetUrlRef.current !== url || !appRef.current) {
          m.destroy();
          return;
        }

        if (modelRef.current) {
          app.stage.removeChild(modelRef.current);
          modelRef.current.destroy();
        }

        modelRef.current = m;
        app.stage.addChild(m);
        m.anchor.set(0.5, 0.78);

        const saved = transformsRef.current[url];
        if (saved) {
          transformRef.current = { x: saved.x, y: saved.y, scale: saved.scale, isDefault: false };
        } else {
          const scale = Math.min(app.screen.width / m.width, app.screen.height / m.height);
          transformRef.current = { x: app.screen.width / 2, y: app.screen.height * 0.85, scale, isDefault: true };
        }
        applyTransform();
      } catch (err) {
        console.error("Failed to load model:", url, err);
      }
    };

    load();

    return () => { aborted = true; };
  }, [customModelPath, applyTransform]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />;
});

export default Model;