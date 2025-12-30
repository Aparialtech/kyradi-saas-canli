import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation, type TranslationKey } from "../../hooks/useTranslation";
import {
  Search, Command, Home, MapPin, Package, Calendar,
  Users, DollarSign, Settings, BarChart3, FileText,
  Plus, ChevronRight, MessageSquare, CreditCard, Building2,
  Receipt, RefreshCw, ClipboardList, Globe
} from "../../lib/lucide";

interface QuickAction {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  category: string;
  keywords: string[];
  action: () => void;
  shortcut?: string;
}

interface QuickActionsProps {
  isOpen: boolean;
  onClose: () => void;
  customActions?: QuickAction[];
  panelType?: 'partner' | 'admin';
}

// Default actions for Partner Panel
const getPartnerActions = (navigate: (path: string) => void, t: (key: TranslationKey) => string): QuickAction[] => [
  // Navigasyon
  {
    id: 'dashboard',
    title: t('nav.overview'),
    description: 'Partner dashboard ana sayfa',
    icon: <Home className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['ana sayfa', 'dashboard', 'genel', 'bakış', 'home', 'panel'],
    action: () => navigate('/app'),
    shortcut: 'G H',
  },
  {
    id: 'locations',
    title: t('nav.locations'),
    description: 'Lokasyon yönetimi',
    icon: <MapPin className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['lokasyon', 'konum', 'yer', 'adres', 'otel', 'mekan'],
    action: () => navigate('/app/locations'),
    shortcut: 'G L',
  },
  {
    id: 'lockers',
    title: t('nav.storages'),
    description: 'Depo/dolap yönetimi',
    icon: <Package className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['depo', 'locker', 'dolap', 'storage', 'kasa'],
    action: () => navigate('/app/lockers'),
    shortcut: 'G D',
  },
  {
    id: 'reservations',
    title: t('nav.reservations'),
    description: 'Rezervasyon listesi ve yönetimi',
    icon: <Calendar className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['rezervasyon', 'booking', 'randevu', 'kayıt'],
    action: () => navigate('/app/reservations'),
    shortcut: 'G R',
  },
  {
    id: 'staff',
    title: t('nav.staff'),
    description: 'Personel yönetimi',
    icon: <Users className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['çalışan', 'personel', 'staff', 'employee', 'eleman', 'kullanıcı'],
    action: () => navigate('/app/staff'),
    shortcut: 'G Ç',
  },
  {
    id: 'pricing',
    title: t('nav.pricing'),
    description: 'Fiyatlandırma kuralları',
    icon: <DollarSign className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['ücret', 'fiyat', 'pricing', 'tarife', 'kural'],
    action: () => navigate('/app/pricing'),
    shortcut: 'G P',
  },
  {
    id: 'revenue',
    title: t('nav.revenue'),
    description: 'Gelir raporları ve ödemeler',
    icon: <CreditCard className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['gelir', 'revenue', 'kazanç', 'ödeme', 'income'],
    action: () => navigate('/app/revenue'),
    shortcut: 'G G',
  },
  {
    id: 'reports',
    title: t('nav.reports'),
    description: 'İstatistikler ve raporlar',
    icon: <BarChart3 className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['rapor', 'analiz', 'istatistik', 'report', 'analytics'],
    action: () => navigate('/app/reports'),
  },
  {
    id: 'tickets',
    title: t('nav.communication'),
    description: 'Destek talepleri',
    icon: <MessageSquare className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['ticket', 'destek', 'iletişim', 'mesaj', 'yardım'],
    action: () => navigate('/app/tickets'),
  },
  {
    id: 'settings',
    title: t('nav.settings'),
    description: 'Hesap ve sistem ayarları',
    icon: <Settings className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['ayar', 'settings', 'yapılandırma', 'config', 'tercih'],
    action: () => navigate('/app/settings'),
    shortcut: 'G S',
  },
  // Hızlı İşlemler
  {
    id: 'new-reservation',
    title: 'Yeni Rezervasyon',
    description: 'Hızlı rezervasyon oluştur',
    icon: <Plus className="h-4 w-4" />,
    category: 'Hızlı İşlemler',
    keywords: ['yeni', 'oluştur', 'rezervasyon', 'ekle', 'create'],
    action: () => navigate('/app/reservations?action=new'),
  },
  {
    id: 'new-location',
    title: 'Yeni Lokasyon',
    description: 'Lokasyon ekle',
    icon: <Plus className="h-4 w-4" />,
    category: 'Hızlı İşlemler',
    keywords: ['yeni', 'lokasyon', 'ekle', 'create'],
    action: () => navigate('/app/locations?action=new'),
  },
  {
    id: 'new-locker',
    title: 'Yeni Depo',
    description: 'Depo ekle',
    icon: <Plus className="h-4 w-4" />,
    category: 'Hızlı İşlemler',
    keywords: ['yeni', 'depo', 'ekle', 'create'],
    action: () => navigate('/app/lockers?action=new'),
  },
  {
    id: 'new-staff',
    title: 'Yeni Çalışan',
    description: 'Personel ekle',
    icon: <Plus className="h-4 w-4" />,
    category: 'Hızlı İşlemler',
    keywords: ['yeni', 'çalışan', 'personel', 'ekle', 'create'],
    action: () => navigate('/app/staff?action=new'),
  },
];

// Default actions for Admin Panel
const getAdminActions = (navigate: (path: string) => void, t: (key: TranslationKey) => string): QuickAction[] => [
  // Navigasyon
  {
    id: 'admin-dashboard',
    title: t('nav.overview'),
    description: 'Admin ana sayfası',
    icon: <Home className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['admin', 'yönetim', 'panel', 'dashboard', 'genel', 'bakış'],
    action: () => navigate('/admin'),
    shortcut: 'G H',
  },
  {
    id: 'admin-reports',
    title: t('nav.reports'),
    description: 'Sistem raporları ve analizler',
    icon: <BarChart3 className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['rapor', 'analiz', 'istatistik', 'report', 'analytics'],
    action: () => navigate('/admin/reports'),
    shortcut: 'G R',
  },
  {
    id: 'admin-invoice',
    title: t('nav.invoice'),
    description: 'Fatura oluşturma',
    icon: <Receipt className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['fatura', 'invoice', 'oluştur', 'create'],
    action: () => navigate('/admin/invoice'),
  },
  {
    id: 'admin-tenants',
    title: t('nav.tenants'),
    description: 'Otel/tenant yönetimi',
    icon: <Building2 className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['otel', 'tenant', 'müşteri', 'hotel', 'partner'],
    action: () => navigate('/admin/tenants'),
    shortcut: 'G O',
  },
  {
    id: 'admin-revenue',
    title: t('nav.globalRevenue'),
    description: 'Tüm sistem gelir raporları',
    icon: <Globe className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['gelir', 'revenue', 'global', 'kazanç', 'income'],
    action: () => navigate('/admin/revenue'),
  },
  {
    id: 'admin-settlements',
    title: t('nav.globalSettlements'),
    description: 'Partner hakedişleri',
    icon: <ClipboardList className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['hakediş', 'settlement', 'ödeme', 'partner'],
    action: () => navigate('/admin/settlements'),
  },
  {
    id: 'admin-transfers',
    title: t('nav.transfers'),
    description: 'Ödeme transferleri',
    icon: <RefreshCw className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['transfer', 'magicpay', 'ödeme', 'payment'],
    action: () => navigate('/admin/transfers'),
  },
  {
    id: 'admin-users',
    title: t('nav.globalUsers'),
    description: 'Sistem kullanıcı yönetimi',
    icon: <Users className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['kullanıcı', 'user', 'admin', 'yönetici'],
    action: () => navigate('/admin/users'),
    shortcut: 'G U',
  },
  {
    id: 'admin-tickets',
    title: t('nav.tickets'),
    description: 'Destek talepleri',
    icon: <MessageSquare className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['ticket', 'destek', 'iletişim', 'mesaj', 'yardım'],
    action: () => navigate('/admin/tickets'),
  },
  {
    id: 'admin-settings',
    title: t('nav.systemSettings'),
    description: 'Genel sistem ayarları',
    icon: <Settings className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['ayar', 'settings', 'sistem', 'yapılandırma', 'config'],
    action: () => navigate('/admin/settings'),
    shortcut: 'G S',
  },
  {
    id: 'admin-audit',
    title: t('nav.audit'),
    description: 'Sistem logları ve işlem geçmişi',
    icon: <FileText className="h-4 w-4" />,
    category: 'Navigasyon',
    keywords: ['audit', 'log', 'kayıt', 'geçmiş', 'iz', 'tarihçe'],
    action: () => navigate('/admin/audit'),
  },
  // Hızlı İşlemler
  {
    id: 'admin-new-tenant',
    title: 'Yeni Otel Ekle',
    description: 'Yeni otel/partner ekle',
    icon: <Plus className="h-4 w-4" />,
    category: 'Hızlı İşlemler',
    keywords: ['yeni', 'otel', 'tenant', 'ekle', 'create'],
    action: () => navigate('/admin/tenants/new'),
  },
  {
    id: 'admin-new-user',
    title: 'Yeni Kullanıcı Ekle',
    description: 'Yeni sistem kullanıcısı ekle',
    icon: <Plus className="h-4 w-4" />,
    category: 'Hızlı İşlemler',
    keywords: ['yeni', 'kullanıcı', 'user', 'ekle', 'create'],
    action: () => navigate('/admin/users/new'),
  },
];

export function QuickActions({
  isOpen,
  onClose,
  customActions = [],
  panelType = 'partner',
}: QuickActionsProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get default actions based on panel type
  const defaultActions = useMemo(() => {
    return panelType === 'admin' 
      ? getAdminActions(navigate, t) 
      : getPartnerActions(navigate, t);
  }, [panelType, navigate, t]);

  const allActions = useMemo(() => [...defaultActions, ...customActions], [defaultActions, customActions]);

  // Filter actions based on search query
  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return allActions;
    
    const query = searchQuery.toLowerCase();
    return allActions.filter(action => 
      action.title.toLowerCase().includes(query) ||
      action.description?.toLowerCase().includes(query) ||
      action.keywords.some(kw => kw.toLowerCase().includes(query))
    );
  }, [allActions, searchQuery]);

  // Group actions by category
  const groupedActions = useMemo(() => {
    const groups: Record<string, QuickAction[]> = {};
    filteredActions.forEach(action => {
      if (!groups[action.category]) {
        groups[action.category] = [];
      }
      groups[action.category].push(action);
    });
    return groups;
  }, [filteredActions]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredActions[selectedIndex]) {
            filteredActions[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleActionClick = useCallback((action: QuickAction) => {
    action.action();
    onClose();
  }, [onClose]);

  let itemIndex = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh',
            zIndex: 9999,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '70vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Search Input */}
            <div style={{
              padding: 'var(--space-4)',
              borderBottom: '1px solid var(--border-primary)',
            }}>
              <div style={{ position: 'relative' }}>
                <Search
                  className="h-5 w-5"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                  }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSelectedIndex(0); }}
                  placeholder="Sayfa veya işlem ara..."
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--bg-secondary)',
                    fontSize: '1rem',
                    outline: 'none',
                    color: 'var(--text-primary)',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.75rem',
                }}>
                  <kbd style={{
                    padding: '2px 6px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontFamily: 'inherit',
                  }}>ESC</kbd>
                  <span>kapat</span>
                </div>
              </div>
            </div>

            {/* Actions List */}
            <div
              ref={listRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--space-2)',
              }}
            >
              {filteredActions.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-8)',
                  color: 'var(--text-tertiary)',
                }}>
                  <Search className="h-8 w-8" style={{ margin: '0 auto var(--space-2) auto', opacity: 0.5 }} />
                  <p>Sonuç bulunamadı</p>
                </div>
              ) : (
                Object.entries(groupedActions).map(([category, actions]) => (
                  <div key={category} style={{ marginBottom: 'var(--space-2)' }}>
                    <div style={{
                      padding: '8px 12px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {category}
                    </div>
                    {actions.map((action) => {
                      const currentIndex = itemIndex++;
                      const isSelected = currentIndex === selectedIndex;
                      
                      return (
                        <motion.button
                          key={action.id}
                          data-index={currentIndex}
                          onClick={() => handleActionClick(action)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          whileHover={{ x: 4 }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                            width: '100%',
                            padding: '10px 12px',
                            background: isSelected ? 'var(--primary-100)' : 'none',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-secondary)',
                            color: isSelected ? 'white' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {action.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                              {action.title}
                            </div>
                            {action.description && (
                              <div style={{
                                fontSize: '0.75rem',
                                color: isSelected ? 'var(--primary-dark)' : 'var(--text-tertiary)',
                              }}>
                                {action.description}
                              </div>
                            )}
                          </div>
                          {action.shortcut && (
                            <kbd style={{
                              padding: '2px 6px',
                              backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-tertiary)',
                              color: isSelected ? 'white' : 'var(--text-tertiary)',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontFamily: 'inherit',
                            }}>
                              {action.shortcut}
                            </kbd>
                          )}
                          <ChevronRight className="h-4 w-4" style={{ 
                            color: isSelected ? 'var(--primary)' : 'var(--text-tertiary)',
                            opacity: isSelected ? 1 : 0.5,
                          }} />
                        </motion.button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
            }}>
              <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                <span><kbd style={{ padding: '2px 4px', background: 'var(--bg-tertiary)', borderRadius: '2px' }}>↑↓</kbd> gezin</span>
                <span><kbd style={{ padding: '2px 4px', background: 'var(--bg-tertiary)', borderRadius: '2px' }}>Enter</kbd> seç</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Command className="h-3 w-3" />
                <span>+ K ile aç</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Global keyboard shortcut hook
export function useQuickActionsShortcut(callback: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [callback]);
}

export default QuickActions;
