import { motion } from "framer-motion";
import { 
  Package, Calendar, MapPin, Users, DollarSign, FileText, 
  Search, Inbox, AlertCircle, CheckCircle2, Clock,
  Plus, ArrowRight, RefreshCw
} from "../../lib/lucide";

type EmptyStateVariant = 
  | 'no-data' 
  | 'no-results' 
  | 'error' 
  | 'success' 
  | 'pending'
  | 'reservations'
  | 'locations'
  | 'lockers'
  | 'users'
  | 'revenue'
  | 'reports';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: React.ReactNode;
}

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: EmptyStateAction[];
  // Custom illustrations
  customIllustration?: React.ReactNode;
  // Size
  size?: 'sm' | 'md' | 'lg';
  // Style
  className?: string;
  style?: React.CSSProperties;
}

// Variant configurations
const VARIANT_CONFIG: Record<EmptyStateVariant, {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  'no-data': {
    icon: <Inbox className="h-12 w-12" />,
    title: 'Henüz veri yok',
    description: 'Bu bölümde henüz kayıt bulunmuyor. Yeni bir kayıt ekleyerek başlayabilirsiniz.',
    color: 'var(--text-tertiary)',
    bgColor: 'var(--bg-secondary)',
  },
  'no-results': {
    icon: <Search className="h-12 w-12" />,
    title: 'Sonuç bulunamadı',
    description: 'Arama kriterlerinize uygun kayıt bulunamadı. Farklı anahtar kelimeler deneyin.',
    color: 'var(--text-tertiary)',
    bgColor: 'var(--bg-secondary)',
  },
  'error': {
    icon: <AlertCircle className="h-12 w-12" />,
    title: 'Bir hata oluştu',
    description: 'Veriler yüklenirken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.',
    color: 'var(--danger-500)',
    bgColor: 'rgba(239, 68, 68, 0.1)',
  },
  'success': {
    icon: <CheckCircle2 className="h-12 w-12" />,
    title: 'İşlem tamamlandı',
    description: 'İşlem başarıyla gerçekleştirildi.',
    color: 'var(--success-500)',
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  'pending': {
    icon: <Clock className="h-12 w-12" />,
    title: 'Beklemede',
    description: 'Bu işlem henüz tamamlanmadı. Lütfen bekleyin.',
    color: 'var(--warning-500)',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  'reservations': {
    icon: <Calendar className="h-12 w-12" />,
    title: 'Rezervasyon bulunamadı',
    description: 'Henüz hiç rezervasyon oluşturulmamış. Yeni bir rezervasyon oluşturarak başlayın.',
    color: 'var(--primary)',
    bgColor: 'var(--primary-100)',
  },
  'locations': {
    icon: <MapPin className="h-12 w-12" />,
    title: 'Lokasyon bulunamadı',
    description: 'Henüz hiç lokasyon eklenmemiş. İlk lokasyonunuzu ekleyerek başlayın.',
    color: 'var(--success-500)',
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  'lockers': {
    icon: <Package className="h-12 w-12" />,
    title: 'Depo bulunamadı',
    description: 'Bu lokasyonda henüz depo tanımlanmamış. Yeni bir depo ekleyin.',
    color: 'var(--warning-500)',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  'users': {
    icon: <Users className="h-12 w-12" />,
    title: 'Kullanıcı bulunamadı',
    description: 'Henüz hiç kullanıcı eklenmemiş. Yeni bir kullanıcı davet edin.',
    color: 'var(--info-500)',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  'revenue': {
    icon: <DollarSign className="h-12 w-12" />,
    title: 'Gelir verisi yok',
    description: 'Seçili dönem için gelir kaydı bulunmuyor.',
    color: 'var(--success-500)',
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  'reports': {
    icon: <FileText className="h-12 w-12" />,
    title: 'Rapor verisi yok',
    description: 'Seçili kriterlere uygun rapor verisi bulunamadı.',
    color: 'var(--text-tertiary)',
    bgColor: 'var(--bg-secondary)',
  },
};

// SVG Illustrations
const Illustrations: Record<string, React.ReactNode> = {
  'empty-box': (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="40" width="80" height="60" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <path d="M20 55L60 75L100 55" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <path d="M60 75V100" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <rect x="35" y="20" width="50" height="30" rx="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M35 35L60 50L85 35" stroke="currentColor" strokeWidth="2"/>
      <path d="M60 50V20" stroke="currentColor" strokeWidth="2"/>
      <circle cx="60" cy="30" r="5" fill="currentColor" opacity="0.2"/>
    </svg>
  ),
  'search': (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="3"/>
      <path d="M72 72L95 95" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <path d="M35 50H65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      <path d="M50 35V65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      <circle cx="90" cy="30" r="8" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <circle cx="25" cy="85" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
    </svg>
  ),
  'calendar': (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="25" width="90" height="80" rx="8" stroke="currentColor" strokeWidth="2"/>
      <path d="M15 45H105" stroke="currentColor" strokeWidth="2"/>
      <rect x="35" y="15" width="4" height="20" rx="2" fill="currentColor"/>
      <rect x="81" y="15" width="4" height="20" rx="2" fill="currentColor"/>
      <circle cx="40" cy="65" r="8" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
      <circle cx="60" cy="65" r="8" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
      <circle cx="80" cy="65" r="8" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
      <circle cx="40" cy="85" r="8" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <circle cx="60" cy="85" r="8" fill="currentColor" opacity="0.2"/>
    </svg>
  ),
  'location': (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 10C40.67 10 25 25.67 25 45C25 70 60 110 60 110C60 110 95 70 95 45C95 25.67 79.33 10 60 10Z" stroke="currentColor" strokeWidth="2"/>
      <circle cx="60" cy="45" r="15" stroke="currentColor" strokeWidth="2"/>
      <circle cx="60" cy="45" r="5" fill="currentColor" opacity="0.3"/>
      <path d="M30 95H90" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
      <path d="M40 100H80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2"/>
    </svg>
  ),
};

export function EmptyState({
  variant = 'no-data',
  title,
  description,
  icon,
  actions = [],
  customIllustration,
  size = 'md',
  className = '',
  style,
}: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  
  const sizeConfig = {
    sm: { padding: 'var(--space-4)', iconSize: 40, titleSize: '0.9rem', descSize: '0.8rem' },
    md: { padding: 'var(--space-8)', iconSize: 64, titleSize: '1.125rem', descSize: '0.875rem' },
    lg: { padding: 'var(--space-12)', iconSize: 80, titleSize: '1.25rem', descSize: '1rem' },
  };

  const currentSize = sizeConfig[size];

  const renderIcon = () => {
    if (customIllustration) return customIllustration;
    if (icon) return icon;
    
    // Use illustration based on variant
    const illustrationKey = variant === 'no-results' ? 'search' 
      : variant === 'reservations' ? 'calendar'
      : variant === 'locations' ? 'location'
      : 'empty-box';
    
    return (
      <div style={{ color: config.color, opacity: 0.7 }}>
        {Illustrations[illustrationKey] || config.icon}
      </div>
    );
  };

  const buttonStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--primary)',
      color: 'white',
      border: 'none',
    },
    secondary: {
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-primary)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--primary)',
      border: '1px solid var(--primary)',
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: currentSize.padding,
        ...style,
      }}
    >
      {/* Icon/Illustration */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        style={{
          width: currentSize.iconSize + 32,
          height: currentSize.iconSize + 32,
          borderRadius: '50%',
          backgroundColor: config.bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-4)',
        }}
      >
        {renderIcon()}
      </motion.div>

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          fontSize: currentSize.titleSize,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {title || config.title}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          fontSize: currentSize.descSize,
          color: 'var(--text-secondary)',
          maxWidth: '400px',
          lineHeight: 1.6,
          marginBottom: actions.length > 0 ? 'var(--space-6)' : 0,
        }}
      >
        {description || config.description}
      </motion.p>

      {/* Actions */}
      {actions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            justifyContent: 'center',
          }}
        >
          {actions.map((action, index) => (
            <motion.button
              key={index}
              onClick={action.onClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '10px 20px',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                ...buttonStyles[action.variant || 'primary'],
              }}
            >
              {action.icon || (action.variant === 'primary' && <Plus className="h-4 w-4" />)}
              {action.label}
              {action.variant === 'outline' && <ArrowRight className="h-4 w-4" />}
            </motion.button>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

// Pre-configured empty states for common use cases
export const ReservationsEmptyState = ({ onAdd }: { onAdd?: () => void }) => (
  <EmptyState
    variant="reservations"
    actions={onAdd ? [{ label: 'Yeni Rezervasyon', onClick: onAdd }] : []}
  />
);

export const LocationsEmptyState = ({ onAdd }: { onAdd?: () => void }) => (
  <EmptyState
    variant="locations"
    actions={onAdd ? [{ label: 'Lokasyon Ekle', onClick: onAdd }] : []}
  />
);

export const LockersEmptyState = ({ onAdd }: { onAdd?: () => void }) => (
  <EmptyState
    variant="lockers"
    actions={onAdd ? [{ label: 'Depo Ekle', onClick: onAdd }] : []}
  />
);

export const UsersEmptyState = ({ onInvite }: { onInvite?: () => void }) => (
  <EmptyState
    variant="users"
    actions={onInvite ? [{ label: 'Kullanıcı Davet Et', onClick: onInvite }] : []}
  />
);

export const SearchEmptyState = ({ onClear }: { onClear?: () => void }) => (
  <EmptyState
    variant="no-results"
    actions={onClear ? [{ label: 'Filtreleri Temizle', onClick: onClear, variant: 'outline', icon: <RefreshCw className="h-4 w-4" /> }] : []}
  />
);

export const ErrorEmptyState = ({ onRetry }: { onRetry?: () => void }) => (
  <EmptyState
    variant="error"
    actions={onRetry ? [{ label: 'Tekrar Dene', onClick: onRetry, icon: <RefreshCw className="h-4 w-4" /> }] : []}
  />
);

export default EmptyState;

