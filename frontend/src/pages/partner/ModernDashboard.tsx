import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ModernSidebar, type ModernSidebarNavItem } from '../../components/layout/ModernSidebar';
import { ModernNavbar } from '../../components/layout/ModernNavbar';
import { StatCard } from '../../components/ui/ModernCard';
import { ModernCard } from '../../components/ui/ModernCard';
import { ModernButton } from '../../components/ui/ModernButton';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import {
  Briefcase,
  MapPin,
  PiggyBank,
  FileText,
  HardDrive,
  ScanLine,
  LineChart,
  Wallet,
  Users as UsersIcon,
  UserCog,
  BadgePercent,
  Settings2,
} from '../../lib/lucide';
import styles from './ModernDashboard.module.css';

export const ModernDashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Navigation items
  const navigationItems: ModernSidebarNavItem[] = [
    { to: '/app', label: t('nav.overview'), icon: <Briefcase className="h-5 w-5" />, end: true },
    { to: '/app/locations', label: t('nav.locations'), icon: <MapPin className="h-5 w-5" /> },
    { to: '/app/lockers', label: t('nav.storages'), icon: <HardDrive className="h-5 w-5" /> },
    { to: '/app/reservations', label: t('nav.reservations'), icon: <FileText className="h-5 w-5" />, badge: 5 },
    { to: '/app/qr', label: t('nav.qr'), icon: <ScanLine className="h-5 w-5" /> },
    { to: '/app/revenue', label: t('nav.revenue'), icon: <Wallet className="h-5 w-5" /> },
    { to: '/app/settlements', label: t('nav.settlements'), icon: <PiggyBank className="h-5 w-5" /> },
    { to: '/app/users', label: t('nav.users'), icon: <UsersIcon className="h-5 w-5" /> },
    { to: '/app/staff', label: t('nav.staff'), icon: <UserCog className="h-5 w-5" /> },
    { to: '/app/pricing', label: t('nav.pricing'), icon: <BadgePercent className="h-5 w-5" /> },
    { to: '/app/settings', label: t('nav.settings'), icon: <Settings2 className="h-5 w-5" /> },
  ];

  // Mock data - replace with real data from API
  const stats = [
    {
      label: 'Aktif Rezervasyonlar',
      value: '24',
      subtitle: 'Son 24 saat',
      icon: <Briefcase className="h-6 w-6" />,
      trend: { value: 12.5, isPositive: true },
      variant: 'primary' as const,
    },
    {
      label: 'Doluluk Oranı',
      value: '78%',
      subtitle: 'Toplam kapasite',
      icon: <MapPin className="h-6 w-6" />,
      trend: { value: 5.2, isPositive: true },
      variant: 'secondary' as const,
    },
    {
      label: 'Bugünkü Gelir',
      value: '₺3,240',
      subtitle: 'Net gelir',
      icon: <PiggyBank className="h-6 w-6" />,
      trend: { value: 8.1, isPositive: true },
      variant: 'success' as const,
    },
    {
      label: 'Toplam Depo',
      value: '12',
      subtitle: 'Aktif lokasyonlar',
      icon: <HardDrive className="h-6 w-6" />,
      variant: 'warning' as const,
    },
  ];

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <ModernSidebar
        items={navigationItems}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        brandName="KYRADI"
      />

      {/* Main Content */}
      <div className={styles.main}>
        {/* Navbar */}
        <ModernNavbar
          title="Dashboard"
          subtitle="Partner Panel"
          userName={user?.email ?? 'Partner'}
          userRole="Partner"
          onLogout={logout}
          sidebarToggle={
            <button 
              className={styles.mobileMenuButton}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          }
        />

        {/* Page Content */}
        <div className={styles.content}>
          {/* Welcome Section */}
          <motion.div
            className={styles.welcomeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div>
              <h1 className={styles.welcomeTitle}>
                Hoş geldiniz, <span className="gradient-text">{user?.email?.split('@')[0]}</span>
              </h1>
              <p className={styles.welcomeSubtitle}>
                İşte bugünkü özet raporunuz ve önemli metrikler
              </p>
            </div>
            <ModernButton variant="primary" leftIcon={<LineChart className="h-4 w-4" />}>
              Detaylı Rapor
            </ModernButton>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            className={styles.statsGrid}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <StatCard {...stat} />
              </motion.div>
            ))}
          </motion.div>

          {/* Charts Section */}
          <div className={styles.chartsGrid}>
            <ModernCard variant="glass" padding="lg" hoverable className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Rezervasyon Trendi</h3>
              <div className={styles.chartPlaceholder}>
                <div className={styles.chartPlaceholderIcon}>
                  <LineChart className="h-16 w-16" />
                </div>
                <p className={styles.chartPlaceholderText}>
                  Grafik entegrasyonu için hazır
                </p>
                <p className={styles.chartPlaceholderHint}>
                  Chart.js, Recharts veya ApexCharts eklenebilir
                </p>
              </div>
            </ModernCard>

            <ModernCard variant="glass" padding="lg" hoverable className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Gelir Dağılımı</h3>
              <div className={styles.chartPlaceholder}>
                <div className={styles.chartPlaceholderIcon}>
                  <PiggyBank className="h-16 w-16" />
                </div>
                <p className={styles.chartPlaceholderText}>
                  Donut chart hazır
                </p>
                <p className={styles.chartPlaceholderHint}>
                  Ödeme metodlarına göre dağılım
                </p>
              </div>
            </ModernCard>
          </div>

          {/* Recent Activity */}
          <ModernCard variant="elevated" padding="lg" className={styles.activityCard}>
            <h3 className={styles.sectionTitle}>Son Aktiviteler</h3>
            <div className={styles.activityList}>
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className={styles.activityItem}
                  whileHover={{ x: 4 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <div className={styles.activityIcon}>
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div className={styles.activityContent}>
                    <p className={styles.activityTitle}>Yeni rezervasyon oluşturuldu</p>
                    <p className={styles.activityTime}>2 dakika önce</p>
                  </div>
                  <div className={styles.activityBadge}>Yeni</div>
                </motion.div>
              ))}
            </div>
          </ModernCard>
        </div>
      </div>
    </div>
  );
};

