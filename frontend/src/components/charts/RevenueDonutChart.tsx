import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface RevenueData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

interface RevenueDonutChartProps {
  data?: RevenueData[];
}

const defaultData: RevenueData[] = [
  { name: 'MagicPay', value: 4500, color: '#3B82F6' },
  { name: 'Nakit', value: 2800, color: '#10B981' },
  { name: 'Kredi Kartı', value: 1900, color: '#8B5CF6' },
  { name: 'Havale', value: 800, color: '#F59E0B' },
];

export const RevenueDonutChart: React.FC<RevenueDonutChartProps> = ({ 
  data = defaultData 
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
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={80}
          outerRadius={120}
          paddingAngle={5}
          dataKey="value"
          animationBegin={0}
          animationDuration={1500}
          animationEasing="ease-out"
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.color}
              stroke="white"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            fontFamily: 'Satoshi',
            fontSize: '14px',
          }}
          formatter={(value: number) => [`₺${value.toLocaleString()}`, 'Gelir']}
        />
        <Legend 
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          wrapperStyle={{
            fontFamily: 'Satoshi',
            fontSize: '13px',
            paddingTop: '20px',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

