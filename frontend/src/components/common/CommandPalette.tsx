import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "../../hooks/useTranslation";
import { 
  Search, Command, MapPin, Package, Calendar, Users, 
  DollarSign, Settings, BarChart3, FileText, LogOut,
  Plus, Home, Building2, CreditCard, MessageSquare,
  Receipt, RefreshCw, ClipboardList, Globe
} from "../../lib/lucide";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category: 'navigation' | 'action' | 'settings';
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
  userRole?: 'partner' | 'admin';
}

/**
 * Command Palette (Cmd+K / Ctrl+K)
 * Quick navigation and actions
 */
export function CommandPalette({ 
  isOpen, 
  onClose, 
  onLogout,
  userRole = 'partner',
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Define commands based on user role
  const commands = useMemo<CommandItem[]>(() => {
    const baseCommands: CommandItem[] = [];
    
    if (userRole === 'partner') {
      baseCommands.push(
        // Navigasyon
        {
          id: 'nav-overview',
          label: t('nav.overview'),
          description: 'Partner dashboard ana sayfa',
          icon: <Home className="h-4 w-4" />,
          action: () => navigate('/app'),
          keywords: ['dashboard', 'ana', 'home', 'panel', 'genel', 'bakış'],
          category: 'navigation',
          shortcut: 'G H',
        },
        {
          id: 'nav-locations',
          label: t('nav.locations'),
          description: 'Lokasyon yönetimi',
          icon: <MapPin className="h-4 w-4" />,
          action: () => navigate('/app/locations'),
          keywords: ['location', 'yer', 'otel', 'mekan', 'konum', 'adres'],
          category: 'navigation',
          shortcut: 'G L',
        },
        {
          id: 'nav-lockers',
          label: t('nav.storages'),
          description: 'Depo/dolap yönetimi',
          icon: <Package className="h-4 w-4" />,
          action: () => navigate('/app/lockers'),
          keywords: ['locker', 'storage', 'dolap', 'depo', 'kasa'],
          category: 'navigation',
          shortcut: 'G D',
        },
        {
          id: 'nav-reservations',
          label: t('nav.reservations'),
          description: 'Rezervasyon listesi ve yönetimi',
          icon: <Calendar className="h-4 w-4" />,
          action: () => navigate('/app/reservations'),
          keywords: ['reservation', 'booking', 'randevu', 'kayıt'],
          category: 'navigation',
          shortcut: 'G R',
        },
        {
          id: 'nav-staff',
          label: t('nav.staff'),
          description: 'Personel yönetimi',
          icon: <Users className="h-4 w-4" />,
          action: () => navigate('/app/staff'),
          keywords: ['staff', 'employee', 'personel', 'çalışan', 'eleman', 'kullanıcı'],
          category: 'navigation',
          shortcut: 'G Ç',
        },
        {
          id: 'nav-pricing',
          label: t('nav.pricing'),
          description: 'Fiyatlandırma kuralları',
          icon: <DollarSign className="h-4 w-4" />,
          action: () => navigate('/app/pricing'),
          keywords: ['price', 'pricing', 'fiyat', 'ücret', 'tarife', 'kural'],
          category: 'navigation',
          shortcut: 'G P',
        },
        {
          id: 'nav-revenue',
          label: t('nav.revenue'),
          description: 'Gelir raporları ve ödemeler',
          icon: <CreditCard className="h-4 w-4" />,
          action: () => navigate('/app/revenue'),
          keywords: ['revenue', 'income', 'gelir', 'kazanç', 'ödeme'],
          category: 'navigation',
          shortcut: 'G G',
        },
        {
          id: 'nav-reports',
          label: t('nav.reports'),
          description: 'İstatistikler ve raporlar',
          icon: <BarChart3 className="h-4 w-4" />,
          action: () => navigate('/app/reports'),
          keywords: ['report', 'analytics', 'rapor', 'analiz', 'istatistik'],
          category: 'navigation',
        },
        {
          id: 'nav-tickets',
          label: t('nav.communication'),
          description: 'Destek talepleri',
          icon: <MessageSquare className="h-4 w-4" />,
          action: () => navigate('/app/tickets'),
          keywords: ['ticket', 'destek', 'iletişim', 'mesaj', 'yardım'],
          category: 'navigation',
        },
        {
          id: 'nav-settings',
          label: t('nav.settings'),
          description: 'Hesap ve sistem ayarları',
          icon: <Settings className="h-4 w-4" />,
          action: () => navigate('/app/settings'),
          keywords: ['settings', 'config', 'ayarlar', 'tercih', 'yapılandırma'],
          category: 'navigation',
          shortcut: 'G S',
        },
        // Hızlı İşlemler
        {
          id: 'action-new-reservation',
          label: 'Yeni Rezervasyon',
          description: 'Hızlı rezervasyon oluştur',
          icon: <Plus className="h-4 w-4" />,
          action: () => navigate('/app/reservations?action=new'),
          keywords: ['new', 'create', 'yeni', 'ekle', 'oluştur', 'rezervasyon'],
          category: 'action',
        },
        {
          id: 'action-new-location',
          label: 'Yeni Lokasyon',
          description: 'Lokasyon ekle',
          icon: <Plus className="h-4 w-4" />,
          action: () => navigate('/app/locations?action=new'),
          keywords: ['new', 'create', 'yeni', 'ekle', 'lokasyon'],
          category: 'action',
        },
        {
          id: 'action-new-locker',
          label: 'Yeni Depo',
          description: 'Depo ekle',
          icon: <Plus className="h-4 w-4" />,
          action: () => navigate('/app/lockers?action=new'),
          keywords: ['new', 'create', 'yeni', 'ekle', 'depo'],
          category: 'action',
        },
        {
          id: 'action-new-staff',
          label: 'Yeni Çalışan',
          description: 'Personel ekle',
          icon: <Plus className="h-4 w-4" />,
          action: () => navigate('/app/staff?action=new'),
          keywords: ['new', 'create', 'yeni', 'ekle', 'çalışan', 'personel'],
          category: 'action',
        },
      );
    }

    if (userRole === 'admin') {
      baseCommands.push(
        // Navigasyon
        {
          id: 'nav-admin',
          label: t('nav.overview'),
          description: 'Admin ana sayfası',
          icon: <Home className="h-4 w-4" />,
          action: () => navigate('/admin'),
          keywords: ['admin', 'yönetim', 'panel', 'dashboard', 'genel', 'bakış'],
          category: 'navigation',
          shortcut: 'G H',
        },
        {
          id: 'nav-admin-reports',
          label: t('nav.reports'),
          description: 'Sistem raporları ve analizler',
          icon: <BarChart3 className="h-4 w-4" />,
          action: () => navigate('/admin/reports'),
          keywords: ['rapor', 'analiz', 'istatistik', 'report', 'analytics'],
          category: 'navigation',
          shortcut: 'G R',
        },
        {
          id: 'nav-admin-invoice',
          label: t('nav.invoice'),
          description: 'Fatura oluşturma',
          icon: <Receipt className="h-4 w-4" />,
          action: () => navigate('/admin/invoice'),
          keywords: ['fatura', 'invoice', 'oluştur', 'create'],
          category: 'navigation',
        },
        {
          id: 'nav-tenants',
          label: t('nav.tenants'),
          description: 'Otel/tenant yönetimi',
          icon: <Building2 className="h-4 w-4" />,
          action: () => navigate('/admin/tenants'),
          keywords: ['tenant', 'hotel', 'otel', 'müşteri', 'partner'],
          category: 'navigation',
          shortcut: 'G O',
        },
        {
          id: 'nav-admin-revenue',
          label: t('nav.globalRevenue'),
          description: 'Tüm sistem gelir raporları',
          icon: <Globe className="h-4 w-4" />,
          action: () => navigate('/admin/revenue'),
          keywords: ['gelir', 'revenue', 'global', 'kazanç', 'income'],
          category: 'navigation',
        },
        {
          id: 'nav-admin-settlements',
          label: t('nav.globalSettlements'),
          description: 'Partner hakedişleri',
          icon: <ClipboardList className="h-4 w-4" />,
          action: () => navigate('/admin/settlements'),
          keywords: ['hakediş', 'settlement', 'ödeme', 'partner'],
          category: 'navigation',
        },
        {
          id: 'nav-admin-transfers',
          label: t('nav.transfers'),
          description: 'Ödeme transferleri',
          icon: <RefreshCw className="h-4 w-4" />,
          action: () => navigate('/admin/transfers'),
          keywords: ['transfer', 'magicpay', 'ödeme', 'payment'],
          category: 'navigation',
        },
        {
          id: 'nav-admin-users',
          label: t('nav.globalUsers'),
          description: 'Sistem kullanıcı yönetimi',
          icon: <Users className="h-4 w-4" />,
          action: () => navigate('/admin/users'),
          keywords: ['kullanıcı', 'user', 'admin', 'yönetici'],
          category: 'navigation',
          shortcut: 'G U',
        },
        {
          id: 'nav-admin-tickets',
          label: t('nav.tickets'),
          description: 'Destek talepleri',
          icon: <MessageSquare className="h-4 w-4" />,
          action: () => navigate('/admin/tickets'),
          keywords: ['ticket', 'destek', 'iletişim', 'mesaj', 'yardım'],
          category: 'navigation',
        },
        {
          id: 'nav-admin-settings',
          label: t('nav.systemSettings'),
          description: 'Genel sistem ayarları',
          icon: <Settings className="h-4 w-4" />,
          action: () => navigate('/admin/settings'),
          keywords: ['ayar', 'settings', 'sistem', 'yapılandırma', 'config'],
          category: 'navigation',
          shortcut: 'G S',
        },
        {
          id: 'nav-audit',
          label: t('nav.audit'),
          description: 'Sistem logları ve işlem geçmişi',
          icon: <FileText className="h-4 w-4" />,
          action: () => navigate('/admin/audit'),
          keywords: ['audit', 'log', 'kayıt', 'iz', 'geçmiş', 'tarihçe'],
          category: 'navigation',
        },
        // Hızlı İşlemler
        {
          id: 'action-new-tenant',
          label: 'Yeni Otel Ekle',
          description: 'Yeni otel/partner ekle',
          icon: <Plus className="h-4 w-4" />,
          action: () => navigate('/admin/tenants/new'),
          keywords: ['new', 'create', 'yeni', 'ekle', 'otel', 'tenant'],
          category: 'action',
        },
        {
          id: 'action-new-user',
          label: 'Yeni Kullanıcı Ekle',
          description: 'Yeni sistem kullanıcısı ekle',
          icon: <Plus className="h-4 w-4" />,
          action: () => navigate('/admin/users/new'),
          keywords: ['new', 'create', 'yeni', 'ekle', 'kullanıcı', 'user'],
          category: 'action',
        },
      );
    }

    // Common actions
    if (onLogout) {
      baseCommands.push({
        id: 'action-logout',
        label: 'Çıkış Yap',
        description: 'Oturumu kapat',
        icon: <LogOut className="h-4 w-4" />,
        action: onLogout,
        keywords: ['logout', 'exit', 'çıkış', 'kapat'],
        category: 'action',
      });
    }

    return baseCommands;
  }, [navigate, onLogout, userRole]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
    );
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      action: [],
      settings: [],
    };
    
    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });
    
    return groups;
  }, [filteredCommands]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigasyon',
    action: 'Hızlı İşlemler',
    settings: 'Ayarlar',
  };

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              width: '100%',
              maxWidth: '560px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              border: '1px solid var(--border-primary)',
            }}
          >
            {/* Search Input */}
            <div style={{
              padding: 'var(--space-4)',
              borderBottom: '1px solid var(--border-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}>
              <Search className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Sayfa veya işlem ara..."
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '1rem',
                  color: 'var(--text-primary)',
                }}
              />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                fontFamily: 'monospace',
              }}>
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>
            </div>

            {/* Results */}
            <div 
              ref={listRef}
              style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                padding: 'var(--space-2)',
              }}
            >
              {filteredCommands.length === 0 ? (
                <div style={{
                  padding: 'var(--space-8)',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                }}>
                  <Search className="h-8 w-8" style={{ margin: '0 auto var(--space-3) auto', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Sonuç bulunamadı</p>
                  <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: '0.8rem' }}>
                    Farklı bir arama terimi deneyin
                  </p>
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, items]) => {
                  if (items.length === 0) return null;
                  
                  return (
                    <div key={category} style={{ marginBottom: 'var(--space-2)' }}>
                      <div style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {categoryLabels[category]}
                      </div>
                      
                      {items.map((cmd) => {
                        flatIndex++;
                        const isSelected = flatIndex === selectedIndex;
                        
                        return (
                          <button
                            key={cmd.id}
                            data-index={flatIndex}
                            type="button"
                            onClick={() => {
                              cmd.action();
                              onClose();
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              padding: 'var(--space-3)',
                              borderRadius: 'var(--radius-lg)',
                              border: 'none',
                              background: isSelected ? 'var(--bg-secondary)' : 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={() => setSelectedIndex(flatIndex)}
                          >
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--radius-md)',
                              background: isSelected ? 'var(--primary-100)' : 'var(--bg-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                              transition: 'all 0.1s ease',
                            }}>
                              {cmd.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                              }}>
                                {cmd.label}
                              </div>
                              {cmd.description && (
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-tertiary)',
                                  marginTop: '2px',
                                }}>
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                            {cmd.shortcut && (
                              <kbd style={{
                                padding: '2px 6px',
                                backgroundColor: isSelected ? 'var(--primary-100)' : 'var(--bg-tertiary)',
                                color: isSelected ? 'var(--primary)' : 'var(--text-tertiary)',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                fontFamily: 'inherit',
                              }}>
                                {cmd.shortcut}
                              </kbd>
                            )}
                            {isSelected && (
                              <div style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-tertiary)',
                                padding: '2px 6px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-sm)',
                              }}>
                                Enter ↵
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--border-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
            }}>
              <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                <span>↑↓ Gezin</span>
                <span>↵ Seç</span>
                <span>Esc Kapat</span>
              </div>
              <span>KYRADI</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to handle Cmd+K / Ctrl+K shortcut
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}
