import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OccupancyData {
  label: string;
  occupancy_rate: number;
  storage_id?: string;
  storage_code?: string;
  location_name?: string;
  tenant_name?: string;
  reservations?: number;
  total_revenue_minor?: number;
}

interface OccupancyBarChartProps {
  data?: OccupancyData[];
  onBarClick?: (data: OccupancyData) => void;
}

export const OccupancyBarChart: React.FC<OccupancyBarChartProps> = ({ 
  data = [],
  onBarClick
}) => {
  const getColor = (percent: number) => {
    // Dolu depolar kırmızı, boş depolar yeşil
    // Eşik değeri %50: >= 50 dolu (kırmızı), < 50 boş (yeşil)
    if (percent >= 50) return '#EF4444'; // Kırmızı - Dolu
    return '#10B981'; // Yeşil - Boş
  };

  if (!data || data.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>No data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.9}/>
            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.9}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
        <XAxis 
          dataKey="label" 
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
          formatter={(value: number) => {
            const percent = Math.round(value);
            return [`%${percent}`, 'Doluluk'];
          }}
        />
        <Bar 
          dataKey="occupancy_rate" 
          radius={[8, 8, 0, 0]}
          animationDuration={1500}
          animationEasing="ease-out"
          onClick={onBarClick ? (data: any) => {
            if (data && data.activePayload && data.activePayload[0]) {
              const payload = data.activePayload[0].payload as OccupancyData;
              onBarClick(payload);
            }
          } : undefined}
          style={onBarClick ? { cursor: 'pointer' } : undefined}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={getColor(entry.occupancy_rate)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
