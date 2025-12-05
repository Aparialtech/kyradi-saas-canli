import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendData {
  date: string;
  reservations: number;
  completed: number;
}

interface ReservationTrendChartProps {
  data?: TrendData[];
}

const defaultData: TrendData[] = [
  { date: '01 Ara', reservations: 12, completed: 8 },
  { date: '02 Ara', reservations: 19, completed: 15 },
  { date: '03 Ara', reservations: 15, completed: 12 },
  { date: '04 Ara', reservations: 25, completed: 18 },
  { date: '05 Ara', reservations: 22, completed: 20 },
  { date: '06 Ara', reservations: 30, completed: 25 },
  { date: '07 Ara', reservations: 28, completed: 24 },
];

export const ReservationTrendChart: React.FC<ReservationTrendChartProps> = ({ 
  data = defaultData 
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorReservations" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
        <XAxis 
          dataKey="date" 
          stroke="#9ca3af"
          style={{ fontSize: '12px', fontFamily: 'Satoshi' }}
        />
        <YAxis 
          stroke="#9ca3af"
          style={{ fontSize: '12px', fontFamily: 'Satoshi' }}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            fontFamily: 'Satoshi',
          }}
        />
        <Area
          type="monotone"
          dataKey="reservations"
          stroke="#3B82F6"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorReservations)"
          animationDuration={1500}
        />
        <Area
          type="monotone"
          dataKey="completed"
          stroke="#10B981"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorCompleted)"
          animationDuration={1500}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

