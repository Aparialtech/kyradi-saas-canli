import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ModernCard } from '../../components/ui/ModernCard';
import { ModernButton } from '../../components/ui/ModernButton';
import { ModernInput } from '../../components/ui/ModernInput';
import { HardDrive, MapPin, Package, Search, CheckCircle2, AlertTriangle } from '../../lib/lucide';
import styles from './ModernStoragesPage.module.css';

interface Storage {
  id: string;
  code: string;
  location: string;
  capacity: number;
  occupied: number;
  status: 'available' | 'full' | 'maintenance';
}

// Mock data - replace with real API
const mockStorages: Storage[] = [
  { id: '1', code: 'A-101', location: 'Terminal 1', capacity: 10, occupied: 3, status: 'available' },
  { id: '2', code: 'A-102', location: 'Terminal 1', capacity: 10, occupied: 10, status: 'full' },
  { id: '3', code: 'B-201', location: 'Terminal 2', capacity: 15, occupied: 8, status: 'available' },
  { id: '4', code: 'B-202', location: 'Terminal 2', capacity: 15, occupied: 0, status: 'maintenance' },
  { id: '5', code: 'C-301', location: 'Terminal 3', capacity: 20, occupied: 12, status: 'available' },
  { id: '6', code: 'C-302', location: 'Terminal 3', capacity: 20, occupied: 18, status: 'available' },
];

export const ModernStoragesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStorages = mockStorages.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return s.code.toLowerCase().includes(term) || s.location.toLowerCase().includes(term);
  });

  const getStatusInfo = (status: string) => {
    const variants: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
      available: {
        label: 'Müsait',
        icon: <CheckCircle2 className="h-5 w-5" />,
        class: styles.statusAvailable,
      },
      full: {
        label: 'Dolu',
        icon: <Package className="h-5 w-5" />,
        class: styles.statusFull,
      },
      maintenance: {
        label: 'Bakımda',
        icon: <AlertTriangle className="h-5 w-5" />,
        class: styles.statusMaintenance,
      },
    };
    return variants[status] || variants.available;
  };

  const getOccupancyPercent = (occupied: number, capacity: number) => {
    return Math.round((occupied / capacity) * 100);
  };

  const getOccupancyColor = (percent: number) => {
    if (percent >= 90) return 'var(--danger-500)';
    if (percent >= 70) return 'var(--warning-500)';
    return 'var(--success-500)';
  };

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className={styles.title}>Depolar</h1>
          <p className={styles.subtitle}>
            Toplam {mockStorages.length} depo - {mockStorages.filter((s) => s.status === 'available').length} müsait
          </p>
        </div>
        <ModernButton variant="primary">
          + Yeni Depo
        </ModernButton>
      </motion.div>

      {/* Toolbar */}
      <ModernCard variant="glass" padding="md">
        <ModernInput
          placeholder="Depo kodu veya lokasyon ile ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="h-5 w-5" />}
          fullWidth
        />
      </ModernCard>

      {/* Storage Grid */}
      <motion.div
        className={styles.grid}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.05,
            },
          },
        }}
      >
        {filteredStorages.map((storage, index) => {
          const statusInfo = getStatusInfo(storage.status);
          const occupancyPercent = getOccupancyPercent(storage.occupied, storage.capacity);
          const occupancyColor = getOccupancyColor(occupancyPercent);

          return (
            <motion.div
              key={storage.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <ModernCard
                variant="elevated"
                padding="lg"
                hoverable
                className={styles.storageCard}
              >
                {/* Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.iconWrapper}>
                    <HardDrive className="h-6 w-6" />
                  </div>
                  <div className={`${styles.statusBadge} ${statusInfo.class}`}>
                    {statusInfo.icon}
                    <span>{statusInfo.label}</span>
                  </div>
                </div>

                {/* Code */}
                <h3 className={styles.storageCode}>{storage.code}</h3>

                {/* Location */}
                <div className={styles.location}>
                  <MapPin className="h-4 w-4" />
                  <span>{storage.location}</span>
                </div>

                {/* Occupancy */}
                <div className={styles.occupancy}>
                  <div className={styles.occupancyText}>
                    <span>Doluluk</span>
                    <strong style={{ color: occupancyColor }}>{occupancyPercent}%</strong>
                  </div>
                  <div className={styles.progressBar}>
                    <motion.div
                      className={styles.progressFill}
                      style={{ background: occupancyColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${occupancyPercent}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                    />
                  </div>
                  <div className={styles.capacityText}>
                    {storage.occupied} / {storage.capacity} bavul
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                  <ModernButton variant="outline" fullWidth>
                    Detaylar
                  </ModernButton>
                </div>
              </ModernCard>
            </motion.div>
          );
        })}
      </motion.div>

      {filteredStorages.length === 0 && (
        <ModernCard variant="glass" padding="lg">
          <div className={styles.empty}>
            <HardDrive className="h-16 w-16" />
            <p>Depo bulunamadı</p>
          </div>
        </ModernCard>
      )}
    </div>
  );
};

