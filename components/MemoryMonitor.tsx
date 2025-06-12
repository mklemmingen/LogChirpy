import React, { useEffect, useRef } from 'react';

// Extend Performance interface to include memory property for environments that support it
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

/**
 * Memory and FPS Monitor Component
 * 
 * Development-only component that logs memory usage and FPS every 10 seconds.
 * Invisible component that only runs in development mode.
 */
export function MemoryMonitor() {
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const animationFrameRef = useRef<number>();

  // FPS tracking function
  const trackFPS = () => {
    frameCountRef.current++;
    animationFrameRef.current = requestAnimationFrame(trackFPS);
  };

  useEffect(() => {
    // Only run in development mode
    if (!__DEV__) {
      return;
    }

    console.log('[MemoryMonitor] Starting memory and FPS monitoring (10s intervals)');

    // Start FPS tracking
    animationFrameRef.current = requestAnimationFrame(trackFPS);

    // Set up 10-second logging interval
    const logInterval = setInterval(() => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTimeRef.current;
      
      // Calculate FPS
      const fps = frameCountRef.current / (deltaTime / 1000);
      
      // Get memory info if available (cast performance to extended interface)
      let memoryInfo = '';
      const performanceWithMemory = performance as PerformanceWithMemory;
      if (performanceWithMemory.memory) {
        const used = (performanceWithMemory.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
        const total = (performanceWithMemory.memory.totalJSHeapSize / 1024 / 1024).toFixed(1);
        const limit = (performanceWithMemory.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1);
        memoryInfo = `Memory: ${used}MB used / ${total}MB total (limit: ${limit}MB)`;
      } else {
        memoryInfo = 'Memory: Not available on this platform';
      }

      // Create timestamp
      const timestamp = new Date().toLocaleTimeString();

      // Log the information
      console.log(
        `[MemoryMonitor] ${timestamp} - ${memoryInfo} | FPS: ${fps.toFixed(1)}`
      );

      // Reset counters
      frameCountRef.current = 0;
      lastTimeRef.current = currentTime;
    }, 10000); // 10 seconds

    // Cleanup function
    return () => {
      clearInterval(logInterval);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      console.log('[MemoryMonitor] Stopped monitoring');
    };
  }, []);

  // This component is invisible - it only runs monitoring logic
  return null;
}