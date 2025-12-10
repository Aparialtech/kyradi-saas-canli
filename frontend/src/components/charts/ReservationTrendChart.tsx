import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendData {
  date: string;
  reservations: number;
  revenue?: number;
}

interface ReservationTrendChartProps {
  data?: TrendData[];
}

export const ReservationTrendChart: React.FC<ReservationTrendChartProps> = ({ 
  data = [] 
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>No data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorReservations" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
        {data.some((d) => d.revenue != null) && (
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#10B981"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorRevenue)"
            animationDuration={1500}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};
