import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  User, 
  MapPin, 
  Package, 
  Save, 
  X, 
  Shield, 
  CheckCircle2,
  Loader2,
} from "../../../lib/lucide";

import { staffService, type StaffPayload } from "../../../services/partner/staff";
import { tenantUserService } from "../../../services/partner/users";
import { locationService } from "../../../services/partner/locations";
import { storageService } from "../../../services/partner/storages";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";

import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";

const formSchema = z.object({
  user_id: z.string().min(1, "Personel seçin"),
  storage_ids: z.array(z.string()),
  location_ids: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

export function StaffEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();

  const isNew = !id || id === "new";

  // Fetch all staff to get the specific one
  const allStaffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: () => staffService.list(),
    enabled: !isNew && !!id,
  });

  // Find staff from list
  const staffData = useMemo(() => {
    if (allStaffQuery.data && id) {
      return allStaffQuery.data.find(s => s.id === id);
    }
    return null;
  }, [allStaffQuery.data, id]);

  // Fetch users, locations, storages
  const usersQuery = useQuery({
    queryKey: ["tenant", "users"],
    queryFn: tenantUserService.list,
  });

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.list,
  });

  const storagesQuery = useQuery({
    queryKey: ["storages"],
    queryFn: () => storageService.list(),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      user_id: "",
      storage_ids: [],
      location_ids: [],
    },
  });

  const selectedStorageIds = watch("storage_ids");
  const selectedLocationIds = watch("location_ids");
  const selectedUserId = watch("user_id");

  // Populate form when staff data loads
  useEffect(() => {
    if (staffData) {
      reset({
        user_id: staffData.user_id,
        storage_ids: staffData.assigned_storage_ids || [],
        location_ids: staffData.assigned_location_ids || [],
      });
    }
  }, [staffData, reset]);

  // Get selected user info
  const selectedUser = useMemo(() => {
    return (Array.isArray(usersQuery.data) ? usersQuery.data : []).find(u => u.id === selectedUserId);
  }, [usersQuery.data, selectedUserId]);

  // Create maps for display
  const locationsById = useMemo(
    () => new Map((Array.isArray(locationsQuery.data) ? locationsQuery.data : []).map((l) => [l.id, l])),
    [locationsQuery.data]
  );

  const createMutation = useMutation({
    mutationFn: (payload: StaffPayload) => staffService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      push({ title: "Çalışan ataması oluşturuldu", type: "success" });
      navigate("/app/staff");
    },
    onError: (error: unknown) => {
      push({ title: "Atama oluşturulamadı", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<StaffPayload> }) =>
      staffService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      push({ title: "Çalışan ataması güncellendi", type: "success" });
      navigate("/app/staff");
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (isNew) {
      createMutation.mutate({
        user_id: values.user_id,
        storage_ids: values.storage_ids,
        location_ids: values.location_ids,
      });
    } else {
      updateMutation.mutate({
        id: id!,
        payload: {
          user_id: values.user_id,
          storage_ids: values.storage_ids,
          location_ids: values.location_ids,
        },
      });
    }
  });

  const isLoading = !isNew && allStaffQuery.isLoading;

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-8)', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
          <Loader2 
            className="h-12 w-12" 
            style={{ 
              margin: '0 auto', 
              color: 'var(--primary)', 
              animation: 'spin 1s linear infinite' 
            }} 
          />
          <p style={{ marginTop: 'var(--space-4)', color: 'var(--text-tertiary)' }}>
            Yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '900px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <ModernButton
            variant="ghost"
            size="sm"
            onClick={() => navigate("/app/staff")}
            style={{ padding: 'var(--space-2)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </ModernButton>
          <div>
            <h1 style={{ 
              fontSize: 'var(--text-2xl)', 
              fontWeight: 'var(--font-bold)', 
              color: 'var(--text-primary)', 
              margin: 0 
            }}>
              {isNew ? "Yeni Çalışan Ata" : "Çalışan Düzenle"}
            </h1>
            <p style={{ 
              fontSize: 'var(--text-sm)', 
              color: 'var(--text-tertiary)', 
              margin: 'var(--space-1) 0 0 0' 
            }}>
              {isNew 
                ? "Personeli seçin ve erişim yetkisi vereceğiniz depo/lokasyonları belirleyin" 
                : `${selectedUser?.email || ''} için erişim yetkilerini düzenleyin`
              }
            </p>
          </div>
        </div>
      </motion.div>

      {/* Security Note */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div style={{ 
          padding: 'var(--space-3) var(--space-4)', 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          <Shield className="h-5 w-5" style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Çalışan yetkilendirmesi güvenli şekilde işlenir. Tüm değişiklikler audit log'a kaydedilir.
          </span>
        </div>
      </motion.div>

      <form onSubmit={onSubmit}>
        {/* Personnel Selection Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <User className="h-5 w-5" style={{ color: 'white' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', margin: 0, color: 'var(--text-primary)' }}>
                  Personel Bilgileri
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  Yetkilendirilecek personeli seçin
                </p>
              </div>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: 'var(--space-2)', 
                fontSize: 'var(--text-sm)', 
                fontWeight: 'var(--font-medium)',
                color: 'var(--text-secondary)' 
              }}>
                Personel <span style={{ color: 'var(--danger-500)' }}>*</span>
              </label>
              
              {isNew ? (
                <select
                  {...register("user_id")}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-base)',
                  }}
                >
                  <option value="">Personel Seçin...</option>
                  {(Array.isArray(usersQuery.data) ? usersQuery.data : []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email} ({user.full_name || user.role})
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{
                  padding: 'var(--space-3)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--primary-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <User className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                        {selectedUser?.email}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {selectedUser?.full_name || selectedUser?.role}
                      </div>
                    </div>
                    <span style={{ marginLeft: 'auto' }}>
                      <Badge variant="info">
                        {selectedUser?.role}
                      </Badge>
                    </span>
                  </div>
                </div>
              )}
              
              {errors.user_id && (
                <p style={{ color: 'var(--danger-500)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                  {errors.user_id.message}
                </p>
              )}
            </div>
          </ModernCard>
        </motion.div>

        {/* Storages Selection Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Package className="h-5 w-5" style={{ color: 'white' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', margin: 0, color: 'var(--text-primary)' }}>
                  Depo Yetkileri
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  Erişim yetkisi verilecek depoları seçin
                </p>
              </div>
              {selectedStorageIds.length > 0 && (
                <span style={{ marginLeft: 'auto' }}>
                  <Badge variant="warning">
                    {selectedStorageIds.length} depo seçili
                  </Badge>
                </span>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 'var(--space-2)',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: 'var(--space-1)',
            }}>
              {(Array.isArray(storagesQuery.data) ? storagesQuery.data : []).map((storage) => {
                const isSelected = selectedStorageIds.includes(storage.id);
                const location = locationsById.get(storage.location_id);
                return (
                  <label
                    key={storage.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-primary)'}`,
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      value={storage.id}
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setValue("storage_ids", [...selectedStorageIds, storage.id]);
                        } else {
                          setValue("storage_ids", selectedStorageIds.filter(id => id !== storage.id));
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-primary)'}`,
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isSelected && <CheckCircle2 className="h-3 w-3" style={{ color: 'white' }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {storage.code}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {location?.name || '-'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {storagesQuery.data?.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-tertiary)' }}>
                Henüz depo tanımlanmamış
              </div>
            )}
          </ModernCard>
        </motion.div>

        {/* Locations Selection Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <MapPin className="h-5 w-5" style={{ color: 'white' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', margin: 0, color: 'var(--text-primary)' }}>
                  Lokasyon Yetkileri
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  Erişim yetkisi verilecek lokasyonları seçin
                </p>
              </div>
              {selectedLocationIds.length > 0 && (
                <span style={{ marginLeft: 'auto' }}>
                  <Badge variant="success">
                    {selectedLocationIds.length} lokasyon seçili
                  </Badge>
                </span>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 'var(--space-2)',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: 'var(--space-1)',
            }}>
              {(Array.isArray(locationsQuery.data) ? locationsQuery.data : []).map((location) => {
                const isSelected = selectedLocationIds.includes(location.id);
                return (
                  <label
                    key={location.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${isSelected ? '#22c55e' : 'var(--border-primary)'}`,
                      background: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      value={location.id}
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setValue("location_ids", [...selectedLocationIds, location.id]);
                        } else {
                          setValue("location_ids", selectedLocationIds.filter(id => id !== location.id));
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${isSelected ? '#22c55e' : 'var(--border-primary)'}`,
                      background: isSelected ? '#22c55e' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isSelected && <CheckCircle2 className="h-3 w-3" style={{ color: 'white' }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {location.name}
                      </div>
                      {location.address && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {location.address}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {locationsQuery.data?.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-tertiary)' }}>
                Henüz lokasyon tanımlanmamış
              </div>
            )}
          </ModernCard>
        </motion.div>

        {/* Form Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ 
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)'
          }}
        >
          <ModernButton
            type="button"
            variant="ghost"
            onClick={() => navigate("/app/staff")}
            disabled={createMutation.isPending || updateMutation.isPending}
            leftIcon={<X className="h-4 w-4" />}
          >
            İptal
          </ModernButton>
          <ModernButton
            type="submit"
            variant="primary"
            disabled={createMutation.isPending || updateMutation.isPending}
            isLoading={createMutation.isPending || updateMutation.isPending}
            loadingText={isNew ? "Kaydediliyor..." : "Güncelleniyor..."}
            leftIcon={<Save className="h-4 w-4" />}
          >
            {isNew ? "Atamayı Kaydet" : "Güncelle"}
          </ModernButton>
        </motion.div>
      </form>
    </div>
  );
}
