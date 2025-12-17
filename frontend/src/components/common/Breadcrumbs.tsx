import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Home } from "../../lib/lucide";

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}
interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  homeLabel?: string;
  homePath?: string;
  className?: string;
  separator?: React.ReactNode;
  showHome?: boolean;
}

// Route to label mapping for auto-generation
const ROUTE_LABELS: Record<string, string> = {
  // Partner routes
  'app': 'Partner Panel',
  'dashboard': 'Genel Bakış',
  'overview': 'Genel Bakış',
  'locations': 'Lokasyonlar',
  'lockers': 'Depolar',
  'reservations': 'Rezervasyonlar',
  'users': 'Kullanıcılar',
  'staff': 'Elemanlar',
  'pricing': 'Ücretlendirme',
  'revenue': 'Gelir',
  'reports': 'Raporlar',
  'settlements': 'Hakedişler',
  'settings': 'Ayarlar',
  'widget-preview': 'Widget Önizleme',
  'demo-flow': 'Online Rezervasyon',
  'qr': 'QR Doğrulama',
  
  // Admin routes
  'admin': 'Admin Panel',
  'tenants': 'Oteller',
  'audit': 'Audit Log',
  'system': 'Sistem',
  
  // Common
  'new': 'Yeni',
  'edit': 'Düzenle',
  'details': 'Detaylar',
};

/**
 * Breadcrumbs navigation component
 * Auto-generates breadcrumbs from current route or uses provided items
 */
export function Breadcrumbs({
  items,
  homeLabel = "Ana Sayfa",
  homePath = "/app",
  className = "",
  separator,
  showHome = true,
}: BreadcrumbsProps) {
  const location = useLocation();

  // Auto-generate breadcrumbs from current path
  const autoItems = useMemo(() => {
    if (items) return items;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];
    let currentPath = '';

    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;
      
      // Skip if it's a UUID or ID
      if (segment.match(/^[0-9a-f-]{36}$/i) || segment.match(/^\d+$/)) {
        breadcrumbs.push({
          label: 'Detay',
          path: isLast ? undefined : currentPath,
        });
        return;
      }

      const label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      
      breadcrumbs.push({
        label,
        path: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbs;
  }, [items, location.pathname]);

  // Filter out first item if it matches home
  const displayItems = useMemo(() => {
    if (showHome && autoItems.length > 0 && autoItems[0].path === homePath) {
      return autoItems.slice(1);
    }
    return autoItems;
  }, [autoItems, showHome, homePath]);

  const defaultSeparator = (
    <ChevronRight className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
  );

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`breadcrumbs ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontSize: '0.875rem',
        color: 'var(--text-tertiary)',
        flexWrap: 'wrap',
      }}
    >
      {showHome && (
        <>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to={homePath}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              <Home className="h-4 w-4" />
              <span>{homeLabel}</span>
            </Link>
          </motion.div>
          {displayItems.length > 0 && (separator || defaultSeparator)}
        </>
      )}

      {displayItems.map((item, index) => (
        <motion.div
          key={item.path || item.label}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {item.path ? (
            <Link
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ) : (
            <span style={{ 
              color: 'var(--text-primary)', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}>
              {item.icon}
              {item.label}
            </span>
          )}
          
          {index < displayItems.length - 1 && (separator || defaultSeparator)}
        </motion.div>
      ))}
    </nav>
  );
}

