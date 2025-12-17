import React, { useMemo } from 'react';
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
  showDetailCards?: boolean;
}

// Status configurations
const STATUS_CONFIG = {
  empty: {
    label: 'Boş',
    color: '#10B981', // Yeşil
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    range: '0-30%',
  },
  inUse: {
    label: 'İşlem Halinde',
    color: '#3B82F6', // Mavi
    bgColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    range: '30-70%',
  },
  full: {
    label: 'Dolu',
    color: '#EF4444', // Kırmızı
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    range: '70-100%',
  },
};

const getStatus = (percent: number): keyof typeof STATUS_CONFIG => {
  if (percent < 30) return 'empty';
  if (percent < 70) return 'inUse';
  return 'full';
};

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload[0]) return null;
  
  const data = payload[0].payload as OccupancyData;
  const status = getStatus(data.occupancy_rate);
  const config = STATUS_CONFIG[status];
  
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.98)',
      border: `2px solid ${config.color}`,
      borderRadius: '12px',
      padding: '12px 16px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
      fontFamily: 'Satoshi',
      minWidth: '180px',
    }}>
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937', marginBottom: '8px' }}>
        {data.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: config.color,
        }} />
        <span style={{ fontWeight: 600, color: config.color, fontSize: '16px' }}>
          %{Math.round(data.occupancy_rate)}
        </span>
        <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>
          {config.label}
        </span>
      </div>
      {data.reservations !== undefined && (
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
          <span style={{ fontWeight: 500 }}>{data.reservations}</span> rezervasyon
        </div>
      )}
      {data.location_name && (
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          📍 {data.location_name}
        </div>
      )}
    </div>
  );
};

// Custom Legend
const CustomLegend = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginTop: '16px',
    flexWrap: 'wrap',
  }}>
    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          background: config.color,
        }} />
        <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: 500 }}>
          {config.label}
        </span>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
          ({config.range})
        </span>
      </div>
    ))}
  </div>
);

export const OccupancyBarChart: React.FC<OccupancyBarChartProps> = ({ 
  data = [],
  onBarClick,
  showDetailCards = true,
}) => {
  // Calculate summary stats
  const stats = useMemo(() => {
    if (!data.length) return { empty: 0, inUse: 0, full: 0, total: 0 };
    
    return data.reduce((acc, item) => {
      const status = getStatus(item.occupancy_rate);
      acc[status]++;
      acc.total++;
      return acc;
    }, { empty: 0, inUse: 0, full: 0, total: 0 });
  }, [data]);

  // Transform data for chart - ensure empty storages are visible with minimum height
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      // Minimum %8 görünür yükseklik, böylece boş depolar da görünür
      displayRate: Math.max(item.occupancy_rate || 0, 8),
    }));
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>Depo verisi bulunamadı</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Summary Cards */}
      {showDetailCards && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '16px',
        }}>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const count = stats[key as keyof typeof stats] || 0;
            const percentage = stats.total ? Math.round((count / stats.total) * 100) : 0;
            
            return (
              <div
                key={key}
                style={{
                  background: config.bgColor,
                  border: `1px solid ${config.borderColor}`,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: config.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                }}>
                  <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>
                    {count}
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: config.color }}>
                  {config.label}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                  %{percentage} ({config.range})
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bar Chart */}
      <div style={{ flex: 1, minHeight: '200px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="emptyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
                <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
              </linearGradient>
              <linearGradient id="inUseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={1}/>
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0.8}/>
              </linearGradient>
              <linearGradient id="fullGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity={1}/>
                <stop offset="100%" stopColor="#DC2626" stopOpacity={0.8}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis 
              dataKey="label" 
              stroke="#9ca3af"
              tick={{ fontSize: 11, fontFamily: 'Satoshi' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              stroke="#9ca3af"
              tick={{ fontSize: 11, fontFamily: 'Satoshi' }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
<Bar 
          dataKey="displayRate" 
          radius={[6, 6, 0, 0]}
          animationDuration={1200}
          animationEasing="ease-out"
          maxBarSize={60}
          minPointSize={8}
          onClick={onBarClick ? (_: any, index: number) => {
            if (chartData[index]) {
              onBarClick(data[index]);
            }
          } : undefined}
          style={onBarClick ? { cursor: 'pointer' } : undefined}
        >
          {chartData.map((entry, index) => {
            const status = getStatus(entry.occupancy_rate);
            const gradientId = status === 'empty' ? 'emptyGradient' : 
                               status === 'inUse' ? 'inUseGradient' : 'fullGradient';
            return (
              <Cell 
                key={`cell-${index}`} 
                fill={`url(#${gradientId})`}
              />
            );
          })}
        </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <CustomLegend />
    </div>
  );
};
