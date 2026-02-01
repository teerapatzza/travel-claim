import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
// ✅ ลบ Bike ออกแล้ว (แก้ Error TS6133)
import { FileText, RotateCcw, Download, Loader2, User, MapPin, Search, ChevronDown, Plane, Upload, X, Image as ImageIcon, Car } from 'lucide-react'; 
import 'leaflet/dist/leaflet.css';

import { useOSRM } from './hooks/useOSRM';
import type { TravelData } from './types/index';
import { jsPDF } from 'jspdf';
import L from 'leaflet';

// Import Data
import { employees, destinations } from './users_data';

// Setup Icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// --- Component 1: Dropdown ---
const SearchableSelect = ({ options, value, onChange, placeholder, icon: Icon }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const filteredOptions = options.filter((opt: any) => opt.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const selectedLabel = options.find((opt: any) => opt.id === value)?.name || "";

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div className="relative group" ref={wrapperRef}>
      <div 
        className={`w-full p-4 bg-slate-50/50 backdrop-blur-sm border-2 rounded-2xl outline-none cursor-pointer flex items-center justify-between transition-all duration-300
        ${isOpen ? 'border-blue-500 shadow-lg ring-2 ring-blue-100' : 'border-slate-100 hover:border-blue-300'}`}
        onClick={() => { setIsOpen(!isOpen); setSearchTerm(""); }}
      >
        <div className="flex items-center gap-3 text-slate-700 overflow-hidden whitespace-nowrap">
          {Icon && <div className={`p-2 rounded-lg ${value ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}><Icon size={18} /></div>}
          <span className={`text-base ${selectedLabel ? "font-semibold text-slate-800" : "text-slate-400"}`}>{selectedLabel || placeholder}</span>
        </div>
        <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-blue-500" : ""}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-[1000] w-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl max-h-72 overflow-hidden flex flex-col animation-fade-in-up">
          <div className="p-3 border-b border-slate-100 sticky top-0 bg-white/50 backdrop-blur-md">
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input autoFocus className="w-full bg-transparent outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400" 
                placeholder="พิมพ์ค้นหา..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt: any) => (
                <div key={opt.id} className={`px-4 py-3 text-sm rounded-xl cursor-pointer transition-all mb-1
                  ${opt.id === value ? 'bg-blue-500 text-white shadow-md' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}
                  onClick={() => { onChange(opt.id); setIsOpen(false); }}>
                  {opt.name}
                </div>
              ))
            ) : (<div className="p-4 text-center text-sm text-slate-400">ไม่พบข้อมูล</div>)}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Component 2: Map Controller ---
const MapController = ({ points, start, end }: { points: [number, number][], start: [number, number] | null, end: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (start && end) {
      const bounds = L.latLngBounds([start, end]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (start) {
      map.setView(start, 13);
    }
  }, [points, start, end, map]);
  return null;
};

// --- Component 3: Draggable Marker ---
function DraggableMarker({ position, setPos, label }: { position: [number, number], setPos: (p: [number, number]) => void, label: string }) {
  const markerRef = useRef<any>(null);
  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const { lat, lng } = marker.getLatLng();
        setPos([lat, lng]); 
      }
    },
  }), [setPos]);

  return (
    <Marker draggable={true} eventHandlers={eventHandlers} position={position} ref={markerRef}>
      <Popup minWidth={90}><div className="text-center font-sans"><b>{label}</b><br/><span className="text-xs text-slate-500">ลากเพื่อปรับตำแหน่งได้</span></div></Popup>
    </Marker>
  );
}

// --- Main App ---
export default function App() {
  const { getRoute, loading } = useOSRM();
  
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState(0);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [usingFallback, setUsingFallback] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedDestId, setSelectedDestId] = useState<number | null>(null);
  
  const [ticketPrice, setTicketPrice] = useState<number>(0);
  const [taxiPrice, setTaxiPrice] = useState<number>(0); 
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  const [formData, setFormData] = useState<TravelData>({
    userName: '', department: 'กองคลัง', purpose: '', vehicleType: 'CAR',
    originName: '', destinationName: '', distance: 0, totalAmount: 0
  });

  const rates = { CAR: 5, MOTORCYCLE: 2, PLANE: 0, TAXI: 0 };
  
  // Logic คำนวณเงิน
  let totalAmount = 0;
  if (formData.vehicleType === 'PLANE') {
    totalAmount = ticketPrice + taxiPrice;
  } else if (formData.vehicleType === 'TAXI') {
    totalAmount = taxiPrice;
  } else {
    // กรณีนี้จะเป็น CAR หรือ MOTORCYCLE เท่านั้น
    const rate = rates[formData.vehicleType as 'CAR' | 'MOTORCYCLE'];
    totalAmount = distance * rate;
  }

  // Handlers
  const handleUserSelect = (id: number) => {
    setSelectedUserId(id);
    const user = employees.find(u => u.id === id);
    if (user) {
      setStartPoint([user.lat, user.lng]);
      setFormData(prev => ({ ...prev, userName: user.name }));
    }
  };

  const handleDestSelect = (id: number) => {
    setSelectedDestId(id);
    const dest = destinations.find(d => d.id === id);
    if (dest) {
      setEndPoint([dest.lat, dest.lng]);
      setFormData(prev => ({ ...prev, purpose: `เดินทางไป ${dest.name}` }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
          setDistance(p1.distanceTo(p2) / 1000);
          setRoutePolyline([startPoint, endPoint]);
          setUsingFallback(true);
        }
      }
    };
    calculatePath();
  }, [startPoint, endPoint, getRoute]);

  const handleReset = () => {
    setStartPoint(null); setEndPoint(null); setDistance(0); setRoutePolyline([]); setUsingFallback(false);
    setSelectedUserId(null); setSelectedDestId(null);
    setTicketPrice(0);
    setTaxiPrice(0);
    setReceiptImage(null);
    setFormData({ ...formData, userName: '', purpose: '', vehicleType: 'CAR' });
  };

  const getFileBase64 = async (path: string): Promise<string> => {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error(`Error loading file: ${path}`, e);
      throw e;
    }
  };

  // PDF Export
  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();
      
      try {
        const fontBase64 = await getFileBase64('./Sarabun-Regular.ttf');
        const fontData = fontBase64.split(',')[1];
        doc.addFileToVFS("MyFont.ttf", fontData);
        doc.addFont("MyFont.ttf", "MyFont", "normal");
        doc.setFont("MyFont"); 
      } catch (e) { 
        console.error("Font missing:", e);
        alert("⚠️ ไม่พบไฟล์ Sarabun-Regular.ttf ในโฟลเดอร์ public!");
      }

      try {
        const logoBase64 = await getFileBase64('./logo.png');
        doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);
      } catch (e) { console.warn("Logo missing"); }

      doc.setFontSize(22);
      doc.text("ใบบันทึกการเบิกจ่ายค่าเดินทาง", 105, 25, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`วันที่: ${new Date().toLocaleDateString('th-TH')}`, 150, 40);
      doc.setLineWidth(0.5); doc.line(15, 45, 195, 45);

      doc.setFontSize(16);
      let y = 60; const lh = 12;
      doc.text(`ชื่อผู้เบิก: ${formData.userName || '-'}`, 20, y); y += lh;
      doc.text(`แผนก: ${formData.department}`, 20, y); y += lh;
      doc.text(`วัตถุประสงค์: ${formData.purpose || '-'}`, 20, y); y += lh;
      
      let vehicleLabel = '';
      if (formData.vehicleType === 'PLANE') vehicleLabel = 'เครื่องบิน (เบิกตามจริง)';
      else if (formData.vehicleType === 'TAXI') vehicleLabel = 'รถแท็กซี่ / รถรับจ้าง (เบิกตามจริง)';
      else if (formData.vehicleType === 'CAR') vehicleLabel = 'รถยนต์ส่วนตัว';
      else vehicleLabel = 'รถจักรยานยนต์';

      doc.text(`ยานพาหนะ: ${vehicleLabel}`, 20, y); y += lh;
      
      if (formData.vehicleType === 'PLANE') {
        doc.text(`- ค่าตั๋วเครื่องบิน: ${ticketPrice.toLocaleString()} บาท`, 25, y); y += lh;
        doc.text(`- ค่ารถรับจ้าง (Taxi): ${taxiPrice.toLocaleString()} บาท`, 25, y); y += lh * 1.5;
        doc.text(`ระยะทาง: - (เดินทางโดยเครื่องบิน)`, 20, y); y += lh * 2;
      } 
      else if (formData.vehicleType === 'TAXI') {
        doc.text(`- ค่ารถรับจ้างตามมิเตอร์/ใบเสร็จ: ${taxiPrice.toLocaleString()} บาท`, 25, y); y += lh * 1.5;
        doc.text(`ระยะทาง: ตามระยะทางจริง`, 20, y); y += lh * 2;
      }
      else {
        doc.text(`ระยะทาง: ${distance.toFixed(2)} กม. ${usingFallback ? '(เส้นตรง)' : ''}`, 20, y); y += lh * 2;
      }

      if (receiptImage) {
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text("(มีเอกสารแนบในหน้าถัดไป)", 20, y - 5);
        doc.setFontSize(16);
        doc.setTextColor(0);
      }

      doc.setFillColor(230, 240, 255);
      doc.rect(15, y - 10, 180, 30, 'F');
      doc.setFontSize(20); doc.setTextColor(0, 50, 150);
      doc.text(`ยอดเงินสุทธิ: ${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} บาท`, 105, y + 10, { align: 'center' });

      doc.setTextColor(150); doc.setFontSize(10);
      doc.text("System Generated Report", 105, 280, { align: 'center' });

      if (receiptImage) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text("เอกสารแนบ: หลักฐานการชำระเงิน / ใบเสร็จ", 105, 20, { align: 'center' });
        try {
            const imgProps = doc.getImageProperties(receiptImage);
            const pdfWidth = 180; 
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            doc.addImage(receiptImage, 'JPEG', 15, 30, pdfWidth, pdfHeight);
        } catch (err) { console.error("Image error", err); }
      }

      doc.save(`Claim_${formData.userName || 'Report'}.pdf`);
    } catch (error) { 
      console.error(error);
      alert("PDF Error: เกิดข้อผิดพลาดในการสร้างไฟล์"); 
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white p-4 md:p-8 text-slate-800 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Form */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-blue-500/30 text-white">
                  <FileText size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">ระบบเบิกค่าเดินทาง</h1>
                  <p className="text-xs text-slate-400 font-medium">Travel Expense Claim System</p>
                </div>
              </div>
              <button onClick={handleReset} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="รีเซ็ต">
                <RotateCcw size={20} />
              </button>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 space-y-6 flex-1">
            <div className="space-y-5">
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> ข้อมูลการเดินทาง
                </label>
                <div className="space-y-3">
                  <SearchableSelect options={employees} value={selectedUserId} onChange={handleUserSelect} placeholder="-- เลือกผู้เบิก (ค้นหาได้) --" icon={User}/>
                  <SearchableSelect options={destinations} value={selectedDestId} onChange={handleDestSelect} placeholder="-- เลือกปลายทาง --" icon={MapPin}/>
                </div>
              </div>

              <div className="pt-2">
                <div className="text-xs text-center text-slate-400 mb-3 bg-slate-100/50 py-1 rounded-lg">หรือกรอกข้อมูลเอง</div>
                <div className="grid gap-3">
                  <div className="relative group">
                    <input className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700" 
                           value={formData.userName} placeholder="พิมพ์ชื่อผู้เบิก..." onChange={e => setFormData({...formData, userName: e.target.value})} />
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20}/>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative">
                      <select className="w-full pl-4 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-400 appearance-none font-medium text-slate-700 cursor-pointer" 
                              value={formData.vehicleType}
                              onChange={e => setFormData({...formData, vehicleType: e.target.value as any})}>
                        <option value="CAR">รถยนต์ส่วนตัว (5฿/กม.)</option>
                        <option value="MOTORCYCLE">รถจักรยานยนต์ (2฿/กม.)</option>
                        <option value="TAXI">รถแท็กซี่ / Grab (เบิกตามจริง)</option>
                        <option value="PLANE">เครื่องบิน (เบิกตามจริง)</option>
                      </select>
                    </div>

                    <div className="animate-fade-in-up grid grid-cols-1 gap-3">
                      {formData.vehicleType === 'PLANE' && (
                        <div>
                          <label className="text-xs font-bold text-blue-600 ml-1 mb-1 block">ค่าตั๋ว (บาท)</label>
                          <div className="relative">
                            <input type="number" className="w-full pl-8 px-4 py-3 bg-blue-50/50 border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-500 font-bold text-slate-800" 
                              value={ticketPrice || ''} placeholder="0" onChange={e => setTicketPrice(parseFloat(e.target.value))} />
                            <Plane className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400" size={16}/>
                          </div>
                        </div>
                      )}

                      {(formData.vehicleType === 'PLANE' || formData.vehicleType === 'TAXI') && (
                        <div>
                          <label className="text-xs font-bold text-orange-600 ml-1 mb-1 block">
                            {formData.vehicleType === 'PLANE' ? 'ค่า Taxi สนามบิน (บาท)' : 'ค่ารถตามมิเตอร์/ใบเสร็จ (บาท)'}
                          </label>
                          <div className="relative">
                            <input type="number" className="w-full pl-8 px-4 py-3 bg-orange-50/50 border-2 border-orange-200 rounded-2xl outline-none focus:border-orange-500 font-bold text-slate-800" 
                              value={taxiPrice || ''} placeholder="0" onChange={e => setTaxiPrice(parseFloat(e.target.value))} />
                            <Car className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-400" size={16}/>
                          </div>
                        </div>
                      )}
                    </div>

                    <input className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-400 font-medium text-slate-700" 
                           value={formData.purpose} placeholder="วัตถุประสงค์การเดินทาง" onChange={e => setFormData({...formData, purpose: e.target.value})} />
                    
                    <div className="relative group">
                      <input type="file" accept="image/*" id="receipt-upload" className="hidden" onChange={handleImageUpload} />
                      <label htmlFor="receipt-upload" className={`w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all
                        ${receiptImage ? 'border-green-400 bg-green-50 text-green-700' : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-blue-400 hover:text-blue-500'}`}>
                        {receiptImage ? <><ImageIcon size={20} /> แนบไฟล์เรียบร้อย (เปลี่ยน)</> : <><Upload size={20} /> แนบรูปใบเสร็จ/ตั๋ว</>}
                      </label>
                      
                      {receiptImage && (
                        <div className="mt-2 relative">
                          <img src={receiptImage} alt="Receipt Preview" className="w-full h-32 object-cover rounded-xl border border-slate-200" />
                          <button onClick={() => setReceiptImage(null)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>

              {/* Stats Card */}
              <div className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl transition-all duration-500 transform
                ${(formData.vehicleType === 'PLANE' || formData.vehicleType === 'TAXI') ? 'bg-gradient-to-br from-sky-400 to-blue-600' : 
                  usingFallback ? 'bg-gradient-to-br from-orange-400 to-red-500' : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600'}`}>
                
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-black/10 rounded-full blur-xl"></div>
                {loading && <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin" size={32}/></div>}
                
                <div className="relative z-10">
                  {formData.vehicleType !== 'PLANE' && formData.vehicleType !== 'TAXI' && (
                    <div className="flex justify-between items-end mb-4 border-b border-white/20 pb-4">
                      <div>
                        <p className="text-blue-100 text-xs font-medium mb-1">ระยะทางรวม</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black tracking-tight">{distance.toFixed(2)}</span>
                          <span className="text-sm font-medium opacity-80">กม.</span>
                        </div>
                      </div>
                      <div className="text-right">
                         <span className={`text-xs font-bold px-2 py-1 rounded-lg bg-white/20 backdrop-blur-md border border-white/20 flex items-center gap-1
                          ${usingFallback ? 'text-orange-50' : 'text-blue-50'}`}>
                          {usingFallback ? '⚠️ เส้นตรง' : '✅ เส้นทางจริง'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                        {(formData.vehicleType === 'PLANE' || formData.vehicleType === 'TAXI') ? <Plane size={24} className="text-white"/> : <FileText size={24} className="text-white"/>}
                      </div>
                      <div>
                        <p className="text-blue-100 text-xs font-medium">ยอดเงินสุทธิ</p>
                        <p className="text-sm opacity-80">
                          {(formData.vehicleType === 'PLANE' || formData.vehicleType === 'TAXI') ? 'Actual Cost' : `Rate: ${rates[formData.vehicleType as 'CAR' | 'MOTORCYCLE']} THB/km`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-4xl font-black text-white drop-shadow-sm tracking-tight">
                        {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                      <span className="text-sm font-medium ml-1">฿</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleExportPDF} disabled={totalAmount === 0}
                  className="group w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative flex items-center gap-2"><Download size={20} /> ดาวน์โหลด PDF (เอกสารเบิก)</span>
          </button>
        </div>

        {/* Right: Map */}
        <div className="lg:col-span-7 h-[500px] lg:h-auto bg-white p-3 rounded-[2.5rem] shadow-2xl border-4 border-white relative z-0">
          <div className="w-full h-full rounded-[2rem] overflow-hidden relative shadow-inner bg-slate-100">
            <MapContainer center={[13.7367, 100.5232]} zoom={10} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <MapController points={routePolyline} start={startPoint} end={endPoint} />
              <MapEvents />
              {startPoint && <DraggableMarker position={startPoint} setPos={setStartPoint} label="จุดเริ่มต้น" />}
              {endPoint && <DraggableMarker position={endPoint} setPos={setEndPoint} label="จุดปลายทาง" />}
              {routePolyline.length > 0 && <Polyline positions={routePolyline} color={usingFallback ? '#f97316' : '#2563eb'} weight={6} opacity={0.8} />}
            </MapContainer>
          </div>
        </div>

      </div>
    </div>
  );
}