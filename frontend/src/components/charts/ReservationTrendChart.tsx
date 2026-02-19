import React from 'react';
import { 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface TrendData {
  date: string;
  reservations: number;
  revenue?: number;
}

interface ReservationTrendChartProps {
  data?: TrendData[];
  chartType?: "area" | "line" | "bar";
}

export const ReservationTrendChart: React.FC<ReservationTrendChartProps> = ({ 
  data = [],
  chartType = "area"
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>No data available</p>
      </div>
    );
  }

  const hasRevenue = data.some((d) => d.revenue != null);

  const commonProps = {
    data,
    margin: { top: 10, right: 30, left: 0, bottom: 0 },
  };

  const tooltipStyle = {
    contentStyle: {
      background: 'rgba(255, 255, 255, 0.98)',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '12px 16px',
    },
    labelStyle: {
      fontWeight: 600,
      marginBottom: '8px',
    },
  };

  const renderGradients = () => (
    <defs>
      <linearGradient id="colorReservations" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
      </linearGradient>
      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
        <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
      </linearGradient>
      <linearGradient id="barGradientBlue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity={1}/>
        <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.8}/>
      </linearGradient>
      <linearGradient id="barGradientGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
        <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
      </linearGradient>
    </defs>
  );

  const renderAxes = () => (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
      <XAxis 
        dataKey="date" 
        stroke="#9ca3af"
        tick={{ fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' }}
        tickLine={false}
        axisLine={{ stroke: '#e5e7eb' }}
      />
      <YAxis 
        stroke="#9ca3af"
        tick={{ fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' }}
        tickLine={false}
        axisLine={false}
      />
      <Tooltip {...tooltipStyle} />
    </>
  );

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
        <LineChart {...commonProps}>
          {renderGradients()}
          {renderAxes()}
          <Line
            type="monotone"
            dataKey="reservations"
            stroke="#3B82F6"
            strokeWidth={3}
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
            activeDot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
            animationDuration={1500}
          />
          {hasRevenue && (
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              activeDot={{ fill: '#10B981', strokeWidth: 2, r: 6 }}
              animationDuration={1500}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
        <BarChart {...commonProps}>
          {renderGradients()}
          {renderAxes()}
          <Bar
            dataKey="reservations"
            fill="url(#barGradientBlue)"
            radius={[6, 6, 0, 0]}
            animationDuration={1500}
            maxBarSize={50}
          />
          {hasRevenue && (
            <Bar
              dataKey="revenue"
              fill="url(#barGradientGreen)"
              radius={[6, 6, 0, 0]}
              animationDuration={1500}
              maxBarSize={50}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Default: Area chart
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
      <AreaChart {...commonProps}>
        {renderGradients()}
        {renderAxes()}
        <Area
          type="monotone"
          dataKey="reservations"
          stroke="#3B82F6"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorReservations)"
          animationDuration={1500}
        />
        {hasRevenue && (
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
