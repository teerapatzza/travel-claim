import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline } from 'react-leaflet';
import { FileText, RotateCcw, Download, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import { useOSRM } from './hooks/useOSRM';
import type { TravelData } from './types/index';
import { jsPDF } from 'jspdf';
import L from 'leaflet';

// ตั้งค่าไอคอนหมุด Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

export default function App() {
  const { getRoute, loading } = useOSRM();
  
  // States
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState(0);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [usingFallback, setUsingFallback] = useState(false);

  const [formData, setFormData] = useState<TravelData>({
    userName: '', department: 'กองคลัง', purpose: '', vehicleType: 'CAR',
    originName: '', destinationName: '', distance: 0, totalAmount: 0
  });

  const rates = { CAR: 4, MOTORCYCLE: 2, PLANE: 0 };
  const currentRate = rates[formData.vehicleType];
  const totalAmount = distance * currentRate;

  useEffect(() => {
    const calculatePath = async () => {
      if (startPoint && endPoint) {
        const res = await getRoute(startPoint, endPoint);
        if (res) {
          setDistance(res.distance);
          const coords = res.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
          setRoutePolyline(coords);
          setUsingFallback(false);
        } else {
          const p1 = L.latLng(startPoint[0], startPoint[1]);
          const p2 = L.latLng(endPoint[0], endPoint[1]);
          const distKm = p1.distanceTo(p2) / 1000;
          setDistance(distKm);
          setRoutePolyline([startPoint, endPoint]);
          setUsingFallback(true);
        }
      }
    };
    calculatePath();
  }, [startPoint, endPoint, getRoute]);

  const handleReset = () => {
    setStartPoint(null); setEndPoint(null); setDistance(0); setRoutePolyline([]); setUsingFallback(false);
  };

  // --- ฟังก์ชันโหลดไฟล์เป็น Base64 ---
  const getFileBase64 = async (path: string): Promise<string> => {
    const response = await fetch(path);
    if (!response.ok) throw new Error("File not found");
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  // --- ฟังก์ชัน Export PDF เวอร์ชันสมบูรณ์ (แก้ Path แล้ว) ---
  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();

      // 1. โหลดฟอนต์ไทย (ลบเครื่องหมาย / ออก เพื่อให้หาเจอในทุก Folder)
      try {
        const fontBase64 = await getFileBase64('Sarabun-Regular.ttf');
        const fontData = fontBase64.split(',')[1];
        
        doc.addFileToVFS("MyFont.ttf", fontData);
        doc.addFont("MyFont.ttf", "MyFont", "normal");
        doc.setFont("MyFont"); 
      } catch (e) {
        console.warn("ไม่เจอไฟล์ฟอนต์ภาษาไทย ใช้ฟอนต์มาตรฐานแทน");
        alert("⚠️ ไม่พบไฟล์ฟอนต์ 'Sarabun-Regular.ttf' ในโฟลเดอร์ public");
      }

      // 2. โหลดโลโก้ (ลบเครื่องหมาย / ออก)
      try {
        const logoBase64 = await getFileBase64('logo.png');
        doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20); 
      } catch (e) {
        console.warn("ไม่เจอไฟล์โลโก้");
      }

      // 3. วาด Header
      doc.setFontSize(22);
      doc.text("ใบบันทึกการเบิกจ่ายค่าเดินทาง", 105, 25, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text(`วันที่: ${new Date().toLocaleDateString('th-TH')}`, 150, 40);

      // 4. ข้อมูล
      doc.setLineWidth(0.5);
      doc.line(15, 45, 195, 45);

      doc.setFontSize(16);
      let y = 60;
      const lineHeight = 12;

      doc.text(`ชื่อผู้เบิก: ${formData.userName || '-'}`, 20, y);
      y += lineHeight;
      doc.text(`แผนก: ${formData.department}`, 20, y);
      y += lineHeight;
      doc.text(`วัตถุประสงค์: ${formData.purpose || '-'}`, 20, y);
      y += lineHeight;
      doc.text(`ยานพาหนะ: ${formData.vehicleType === 'CAR' ? 'รถยนต์ส่วนตัว' : 'รถจักรยานยนต์'}`, 20, y);
      y += lineHeight;
      doc.text(`ระยะทางรวม: ${distance.toFixed(2)} กม. ${usingFallback ? '(คำนวณเส้นตรง)' : '(ตามเส้นทางจริง)'}`, 20, y);
      y += lineHeight * 2;

      // สรุปยอดเงิน
      doc.setFillColor(230, 240, 255);
      doc.rect(15, y - 10, 180, 30, 'F');
      
      doc.setFontSize(20);
      doc.setTextColor(0, 50, 150);
      doc.text(`ยอดเงินสุทธิ: ${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} บาท`, 105, y + 10, { align: 'center' });

      // Footer
      doc.setTextColor(150);
      doc.setFontSize(10);
      doc.text("เอกสารนี้สร้างโดยระบบอัตโนมัติ (Travel Claim System)", 105, 280, { align: 'center' });

      doc.save(`Travel_Claim_${formData.userName || 'Report'}.pdf`);

    } catch (error) {
      console.error("PDF Error:", error);
      alert("เกิดข้อผิดพลาดในการสร้าง PDF: กรุณาตรวจสอบไฟล์ logo.png และ Sarabun-Regular.ttf");
    }
  };

  function MapEvents() {
    useMapEvents({
      click(e) {
        if (!startPoint) setStartPoint([e.latlng.lat, e.latlng.lng]);
        else if (!endPoint) setEndPoint([e.latlng.lat, e.latlng.lng]);
      },
    });
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ฝั่งซ้าย: ฟอร์ม */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3 text-blue-600">
                <FileText size={32} />
                <h1 className="text-2xl font-black">ระบบเบิกค่าเดินทาง</h1>
              </div>
              <button onClick={handleReset} className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-3 py-2 rounded-xl font-bold transition-all">
                <RotateCcw size={18} /> รีเซ็ต
              </button>
            </div>

            <div className="space-y-4">
              <input className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" 
                     placeholder="ชื่อ-นามสกุล (ภาษาไทย)" onChange={e => setFormData({...formData, userName: e.target.value})} />
              
              <div className="grid grid-cols-2 gap-4">
                <select className="p-4 bg-slate-50 border rounded-2xl outline-none" 
                        onChange={e => setFormData({...formData, vehicleType: e.target.value as any})}>
                  <option value="CAR">รถยนต์ (4฿)</option>
                  <option value="MOTORCYCLE">มอเตอร์ไซค์ (2฿)</option>
                </select>
                <input className="p-4 bg-slate-50 border rounded-2xl outline-none" 
                       placeholder="วัตถุประสงค์ (ภาษาไทย)" onChange={e => setFormData({...formData, purpose: e.target.value})} />
              </div>

              {/* แสดงผลระยะทาง */}
              <div className={`p-8 rounded-3xl text-white shadow-lg relative overflow-hidden transition-colors ${usingFallback ? 'bg-orange-500' : 'bg-blue-600'}`}>
                {loading && <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin" size={32}/></div>}
                <div className="flex justify-between items-center mb-4 border-b border-white/20 pb-4">
                  <span className="font-medium flex items-center gap-2">
                    {usingFallback ? '⚠️ ระยะทางเส้นตรง:' : '✅ ระยะทางจริง:'}
                  </span>
                  <span className="text-2xl font-black">{distance.toFixed(2)} กม.</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">ยอดเงินสุทธิ:</span>
                  <span className="text-4xl font-black">{totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿</span>
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleExportPDF} disabled={distance === 0}
                  className="w-full mt-8 py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
            <Download size={20} /> ดาวน์โหลด PDF (รองรับภาษาไทย)
          </button>
        </div>

        {/* ฝั่งขวา: แผนที่ */}
        <div className="h-[650px] bg-white p-2 rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden relative">
          <MapContainer center={[13.7367, 100.5232]} zoom={12} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapEvents />
            {startPoint && <Marker position={startPoint} />}
            {endPoint && <Marker position={endPoint} />}
            {routePolyline.length > 0 && <Polyline positions={routePolyline} color={usingFallback ? 'orange' : '#2563eb'} weight={6} dashArray={usingFallback ? '10, 10' : undefined} />}
          </MapContainer>
          
          <div className="absolute top-8 left-8 z-[1000] flex flex-col gap-3">
             {!startPoint && <div className="bg-blue-600 text-white px-5 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce">📍 คลิกจุดเริ่มต้น</div>}
             {startPoint && !endPoint && <div className="bg-orange-500 text-white px-5 py-2 rounded-full shadow-lg font-bold text-sm animate-pulse">🚩 คลิกจุดปลายทาง</div>}
          </div>
        </div>

      </div>
    </div>
  );
}