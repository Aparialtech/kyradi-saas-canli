import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus, MapPin, Package, User, Save, X, Search, Shield } from "../../../lib/lucide";

import { staffService, type StaffAssignmentCreate } from "../../../services/partner/staff";
import { tenantUserService } from "../../../services/partner/users";
import { locationService } from "../../../services/partner/locations";
import { storageService } from "../../../services/partner/storages";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";

import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { ModernInput } from "../../../components/ui/ModernInput";

const formSchema = z.object({
  user_id: z.string().min(1, "Kullanıcı seçin"),
  location_id: z.string().optional(),
  storage_id: z.string().optional(),
}).refine((data) => data.location_id || data.storage_id, {
  message: "Lokasyon veya depo seçmeniz gerekiyor",
  path: ["location_id"],
});

type FormValues = z.infer<typeof formSchema>;

export function StaffAssignPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [storageSearchTerm, setStorageSearchTerm] = useState("");

  // Fetch data
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
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      user_id: "",
      location_id: "",
      storage_id: "",
    },
  });

  const selectedUserId = watch("user_id");
  const selectedLocationId = watch("location_id");

  // Filtered lists for typeahead
  const filteredUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    if (!userSearchTerm.trim()) return users;
    const term = userSearchTerm.toLowerCase();
    return users.filter(u => u.email.toLowerCase().includes(term));
  }, [usersQuery.data, userSearchTerm]);

  const filteredLocations = useMemo(() => {
    const locations = locationsQuery.data ?? [];
    if (!locationSearchTerm.trim()) return locations;
    const term = locationSearchTerm.toLowerCase();
    return locations.filter(l => l.name.toLowerCase().includes(term));
  }, [locationsQuery.data, locationSearchTerm]);

  const filteredStorages = useMemo(() => {
    let storages = storagesQuery.data ?? [];
    // Filter by selected location
    if (selectedLocationId) {
      storages = storages.filter(s => s.location_id === selectedLocationId);
    }
    if (!storageSearchTerm.trim()) return storages;
    const term = storageSearchTerm.toLowerCase();
    return storages.filter(s => s.code.toLowerCase().includes(term));
  }, [storagesQuery.data, storageSearchTerm, selectedLocationId]);

  const createMutation = useMutation({
    mutationFn: (payload: StaffAssignmentCreate) => staffService.assign(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff-assignments"] });
      push({ title: "Atama başarılı", description: "Çalışan ataması kaydedildi", type: "success" });
      navigate("/app/staff");
    },
    onError: (error: unknown) => {
      push({ title: "Atama başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const onSubmit = handleSubmit((values) => {
    createMutation.mutate({
      user_id: values.user_id,
      location_id: values.location_id || undefined,
      storage_id: values.storage_id || undefined,
    });
  });

  const selectedUser = usersQuery.data?.find(u => u.id === selectedUserId);
  const selectedLocation = locationsQuery.data?.find(l => l.id === selectedLocationId);

  return (
    <div className="page-container" style={{ padding: 'var(--space-8)', maxWidth: '800px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      {/* Header */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Button
            variant="ghost"
            onClick={() => navigate("/app/staff")}
            style={{ padding: 'var(--space-2)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title text-gradient" style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>
              Yeni Çalışan Ataması
            </h1>
            <p className="page-description" style={{ margin: 0, color: 'var(--text-tertiary)' }}>
              Bir çalışanı lokasyon veya depoya atayın
            </p>
          </div>
        </div>
      </motion.div>

      {/* Security Note */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        <div style={{ 
          padding: 'var(--space-3)', 
          background: 'var(--info-50)', 
          border: '1px solid var(--info-200)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color: 'var(--info-700)',
          fontSize: 'var(--text-sm)'
        }}>
          <Shield className="h-4 w-4" />
          Bu form güvenli şekilde işlenir. Tüm girişler sunucu tarafında doğrulanır ve audit log'a kaydedilir.
        </div>
      </motion.div>

      <form onSubmit={onSubmit}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="elevated" padding="none">
            <CardHeader
              title="Atama Bilgileri"
              description="Çalışan ve atanacak lokasyon/depoyu seçin"
            />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                {/* User Selection */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 'var(--space-2)', 
                    fontWeight: 500, 
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <User className="h-4 w-4" />
                      Çalışan *
                    </div>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <ModernInput
                      placeholder="Çalışan ara (e-posta ile)..."
                      value={selectedUser ? selectedUser.email : userSearchTerm}
                      onChange={(e) => {
                        setUserSearchTerm(e.target.value);
                        setValue("user_id", "");
                      }}
                      leftIcon={<Search className="h-4 w-4" />}
                      fullWidth
                    />
                    {userSearchTerm.length >= 2 && !selectedUserId && filteredUsers.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 100,
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}>
                        {filteredUsers.slice(0, 10).map((user) => (
                          <div
                            key={user.id}
                            onClick={() => {
                              setValue("user_id", user.id);
                              setUserSearchTerm("");
                            }}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-primary)',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ fontWeight: 500 }}>{user.email}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                              {user.role}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="hidden" {...register("user_id")} />
                  {errors.user_id && (
                    <p style={{ color: 'var(--danger-500)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                      {errors.user_id.message}
                    </p>
                  )}
                </div>

                {/* Location Selection */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 'var(--space-2)', 
                    fontWeight: 500, 
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <MapPin className="h-4 w-4" />
                      Lokasyon
                    </div>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <ModernInput
                      placeholder="Lokasyon ara..."
                      value={selectedLocation ? selectedLocation.name : locationSearchTerm}
                      onChange={(e) => {
                        setLocationSearchTerm(e.target.value);
                        setValue("location_id", "");
                        setValue("storage_id", ""); // Clear storage when location changes
                      }}
                      leftIcon={<Search className="h-4 w-4" />}
                      fullWidth
                    />
                    {locationSearchTerm.length >= 2 && !selectedLocationId && filteredLocations.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 100,
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}>
                        {filteredLocations.slice(0, 10).map((location) => (
                          <div
                            key={location.id}
                            onClick={() => {
                              setValue("location_id", location.id);
                              setLocationSearchTerm("");
                            }}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-primary)',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <MapPin className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                              {location.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="hidden" {...register("location_id")} />
                </div>

                {/* Storage Selection */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 'var(--space-2)', 
                    fontWeight: 500, 
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Package className="h-4 w-4" />
                      Depo
                    </div>
                  </label>
                  <select
                    {...register("storage_id")}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <option value="">Depo Seçin (Opsiyonel)</option>
                    {filteredStorages.map((storage) => (
                      <option key={storage.id} value={storage.id}>
                        {storage.code}
                      </option>
                    ))}
                  </select>
                  <p style={{ 
                    marginTop: 'var(--space-1)', 
                    fontSize: 'var(--text-xs)', 
                    color: 'var(--text-tertiary)' 
                  }}>
                    {selectedLocationId 
                      ? `${filteredStorages.length} depo mevcut` 
                      : "Önce lokasyon seçin veya tüm depolardan seçim yapın"}
                  </p>
                </div>

                {errors.location_id && (
                  <p style={{ color: 'var(--danger-500)', fontSize: 'var(--text-sm)' }}>
                    {errors.location_id.message}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Form Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ 
            marginTop: 'var(--space-6)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)'
          }}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/app/staff")}
            disabled={createMutation.isPending}
          >
            <X className="h-4 w-4" style={{ marginRight: 'var(--space-1)' }} />
            İptal
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>Kaydediliyor...</>
            ) : (
              <>
                <Save className="h-4 w-4" style={{ marginRight: 'var(--space-1)' }} />
                Atamayı Kaydet
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </div>
  );
}
