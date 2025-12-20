import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from 'recharts';

interface RevenueData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

interface RevenueDonutChartProps {
  data?: RevenueData[];
  currencySymbol?: string;
  chartType?: "donut" | "bar";
}

export const RevenueDonutChart: React.FC<RevenueDonutChartProps> = ({ 
  data = [],
  currencySymbol = "₺",
  chartType = "donut",
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

  const tooltipStyle = {
    contentStyle: {
      background: 'rgba(255, 255, 255, 0.98)',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '14px',
      padding: '12px 16px',
    },
  };

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 40 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={true} vertical={false} />
          <XAxis 
            type="number" 
            stroke="#9ca3af"
            tick={{ fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${currencySymbol}${value.toLocaleString()}`}
          />
          <YAxis 
            dataKey="name" 
            type="category"
            stroke="#9ca3af"
            tick={{ fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={100}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Gelir']}
          />
          <Bar 
            dataKey="value" 
            radius={[0, 6, 6, 0]}
            animationDuration={1500}
            maxBarSize={35}
          >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={chartData[index].color} />
          ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Default: Donut chart
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
      <PieChart>
        <defs>
          {chartData.map((entry, index) => (
            <linearGradient key={`gradient-${index}`} id={`donutGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={entry.color} stopOpacity={1}/>
              <stop offset="100%" stopColor={entry.color} stopOpacity={0.7}/>
            </linearGradient>
          ))}
        </defs>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={3}
          dataKey="value"
          animationBegin={0}
          animationDuration={1500}
          animationEasing="ease-out"
        >
          {chartData.map((_, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={`url(#donutGradient-${index})`}
              stroke="white"
              strokeWidth={3}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
            />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Gelir']}
        />
        <Legend 
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          wrapperStyle={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            paddingTop: '16px',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};
