import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ModernCard } from '../../components/ui/ModernCard';
import { ModernButton } from '../../components/ui/ModernButton';
import { ModernTable, type ModernTableColumn } from '../../components/ui/ModernTable';
import { ModernInput } from '../../components/ui/ModernInput';
import { ModernModal } from '../../components/ui/ModernModal';
import { reservationService, type Reservation } from '../../services/partner/reservations';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { useTranslation } from '../../hooks/useTranslation';
import { getErrorMessage } from '../../lib/httpError';
import { errorLogger } from '../../lib/errorLogger';
import { Eye, CheckCircle2, XOctagon, Search } from '../../lib/lucide';
import styles from './ModernReservationsPage.module.css';

export const ModernReservationsPage: React.FC = () => {
  const { push } = useToast();
  const { locale } = useTranslation();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch reservations
  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['widget-reservations'],
    queryFn: () => reservationService.list({}),
  });

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: (id: string | number) => reservationService.completeReservation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['widget-reservations'] });
      push({ title: 'Rezervasyon tamamlandı', type: 'success' });
    },
    onError: (error: unknown) =>
      push({ title: 'Hata', description: getErrorMessage(error), type: 'error' }),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string | number) => reservationService.cancelReservation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['widget-reservations'] });
      push({ title: 'Rezervasyon iptal edildi', type: 'info' });
    },
    onError: (error: unknown) =>
      push({ title: 'Hata', description: getErrorMessage(error), type: 'error' }),
  });

  // Filter reservations
  const filteredReservations = reservations.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const guestName = (r.full_name || r.guest_name || '').toLowerCase();
    const email = (r.guest_email || '').toLowerCase();
    return guestName.includes(term) || email.includes(term);
  });

  // Date formatter
  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; class: string }> = {
      reserved: { label: 'Rezerve', class: styles.badgeWarning },
      active: { label: 'Aktif', class: styles.badgeSuccess },
      completed: { label: 'Tamamlandı', class: styles.badgeInfo },
      cancelled: { label: 'İptal', class: styles.badgeDanger },
    };
    const variant = variants[status] || { label: status, class: '' };
    return <span className={`${styles.badge} ${variant.class}`}>{variant.label}</span>;
  };

  // Table columns
  const columns: ModernTableColumn<Reservation>[] = [
    {
      key: 'guest',
      label: 'Misafir',
      render: (_, row) => (
        <div>
          <div className={styles.guestName}>
            {row.full_name || row.guest_name || 'Bilinmiyor'}
          </div>
          <div className={styles.guestEmail}>{row.guest_email || '—'}</div>
        </div>
      ),
    },
    {
      key: 'start_at',
      label: 'Giriş',
      render: (value) => formatDate(value),
    },
    {
      key: 'end_at',
      label: 'Çıkış',
      render: (value) => formatDate(value),
    },
    {
      key: 'baggage_count',
      label: 'Bavul',
      render: (value) => `${value || 0} adet`,
      align: 'center',
    },
    {
      key: 'status',
      label: 'Durum',
      render: (value) => getStatusBadge(value),
      align: 'center',
    },
    {
      key: 'actions',
      label: 'İşlemler',
      align: 'center',
      render: (_, row) => (
        <div className={styles.actions}>
          <ModernButton
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedReservation(row);
              setShowDetailModal(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </ModernButton>
          
          <ModernButton
            variant="primary"
            size="sm"
            disabled={row.status === 'completed' || row.status === 'cancelled'}
            onClick={async () => {
              const confirmed = await confirm({
                title: 'Teslim Onayı',
                message: 'Bu rezervasyonu teslim edildi olarak işaretlemek istediğinize emin misiniz?',
                confirmText: 'Teslim Edildi',
                cancelText: 'İptal',
                variant: 'success',
              });
              if (confirmed) {
                completeMutation.mutate(row.id);
              }
            }}
          >
            <CheckCircle2 className="h-4 w-4" />
          </ModernButton>
          
          <ModernButton
            variant="danger"
            size="sm"
            disabled={row.status === 'completed' || row.status === 'cancelled'}
            onClick={async () => {
              const confirmed = await confirm({
                title: 'Rezervasyon İptali',
                message: 'Bu rezervasyonu iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
                confirmText: 'İptal Et',
                cancelText: 'Vazgeç',
                variant: 'danger',
              });
              if (confirmed) {
                cancelMutation.mutate(row.id);
              }
            }}
          >
            <XOctagon className="h-4 w-4" />
          </ModernButton>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className={styles.title}>Rezervasyonlar</h1>
          <p className={styles.subtitle}>
            Toplam {reservations.length} rezervasyon
          </p>
        </div>
      </motion.div>

      <ModernCard variant="glass" padding="lg" className={styles.card}>
        {/* Search */}
        <div className={styles.toolbar}>
          <ModernInput
            placeholder="İsim veya e-posta ile ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="h-5 w-5" />}
            fullWidth
          />
        </div>

        {/* Table */}
        <ModernTable
          columns={columns}
          data={filteredReservations}
          loading={isLoading}
          striped
          hoverable
          stickyHeader
          emptyText="Rezervasyon bulunamadı"
        />
      </ModernCard>

      {/* Detail Modal */}
      <ModernModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedReservation(null);
        }}
        title="Rezervasyon Detayları"
        size="lg"
      >
        {selectedReservation && (
          <div className={styles.detailGrid}>
            <div>
              <strong>Misafir:</strong> {selectedReservation.full_name || 'Bilinmiyor'}
            </div>
            <div>
              <strong>E-posta:</strong> {selectedReservation.guest_email || '—'}
            </div>
            <div>
              <strong>Telefon:</strong> {selectedReservation.guest_phone || '—'}
            </div>
            <div>
              <strong>Bavul:</strong> {selectedReservation.baggage_count || 0} adet
            </div>
            <div>
              <strong>Giriş:</strong> {formatDate(selectedReservation.start_at)}
            </div>
            <div>
              <strong>Çıkış:</strong> {formatDate(selectedReservation.end_at)}
            </div>
            <div>
              <strong>Durum:</strong> {getStatusBadge(selectedReservation.status)}
            </div>
          </div>
        )}
      </ModernModal>
    </div>
  );
};

