import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OccupancyData {
  label: string;
  occupancy_rate: number;
}

interface OccupancyBarChartProps {
  data?: OccupancyData[];
}

export const OccupancyBarChart: React.FC<OccupancyBarChartProps> = ({ 
  data = [] 
}) => {
  const getColor = (percent: number) => {
    if (percent >= 90) return '#EF4444';
    if (percent >= 70) return '#F59E0B';
    return '#10B981';
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
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
