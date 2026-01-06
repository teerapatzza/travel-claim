export interface RouteData {
  distance: number;
  duration: number;
  geometry: any;
}

export interface TravelData {
  userName: string;
  department: string;
  purpose: string;
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'PLANE';
  originName: string;
  destinationName: string;
  distance: number;
  totalAmount: number;
}