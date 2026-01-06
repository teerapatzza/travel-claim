import { useState, useCallback } from 'react';
import type { RouteData } from '../types/index';

export const useOSRM = () => {
  const [loading, setLoading] = useState(false);

  // ใช้ useCallback เพื่อให้ฟังก์ชันไม่ถูกสร้างใหม่ทุกครั้งที่หน้าจอกระพริบ
  const getRoute = useCallback(async (start: [number, number], end: [number, number]): Promise<RouteData | null> => {
    setLoading(true);
    try {
      // OSRM ใช้ [Lng, Lat]
      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
      
      const response = await fetch(url, { referrerPolicy: "no-referrer" }); // เพิ่ม policy กันบล็อก
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes[0]) return null;

      return {
        distance: data.routes[0].distance / 1000,
        duration: data.routes[0].duration / 60,
        geometry: data.routes[0].geometry
      };
    } catch (error) {
      console.warn("OSRM API Failed, switching to fallback mode.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getRoute, loading };
};