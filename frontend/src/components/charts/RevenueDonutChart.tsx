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
  currencySymbol?: string;
}

export const RevenueDonutChart: React.FC<RevenueDonutChartProps> = ({ 
  data = [],
  currencySymbol = "₺",
}) => {
  const chartData = (data || []).filter((item) => item.value !== undefined);
  const hasData = chartData.some((item) => item.value > 0);

  if (!hasData) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>Veri bulunamadı</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
      <PieChart>
        <Pie
          data={chartData}
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
          {chartData.map((entry, index) => (
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
          formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Gelir']}
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
