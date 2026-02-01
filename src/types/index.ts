// 1. ส่วนสำหรับ API แผนที่ (ที่หายไป)
export interface RouteData {
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
    type: string;
  };
}

// 2. ส่วนสำหรับข้อมูลการเบิก (ที่เพิ่ม Taxi/Plane)
export interface TravelData {
  userName: string;
  department: string;
  purpose: string;
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'PLANE' | 'TAXI'; 
  originName: string;
  destinationName: string;
  distance: number;
  totalAmount: number;
}