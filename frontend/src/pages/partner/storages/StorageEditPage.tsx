import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, HardDrive, MapPin, Search, Save, Loader2, Calendar, CheckCircle, XCircle } from "../../../lib/lucide";

import { storageService, type StoragePayload, type StorageCalendarDay } from "../../../services/partner/storages";
import { locationService } from "../../../services/partner/locations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";

export function StorageEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Calendar date range (next 14 days)
  const calendarRange = useMemo(() => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 13);
    return {
      start: today.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    };
  }, []);

  // Fetch existing storage if editing
  const storageQuery = useQuery({
    queryKey: ["storage", id],
    queryFn: () => storageService.get(id!),
    enabled: !isNew && !!id,
  });

  // Fetch storage calendar (availability)
  const calendarQuery = useQuery({
    queryKey: ["storage-calendar", id, calendarRange.start, calendarRange.end],
    queryFn: () => storageService.getCalendar(id!, calendarRange.start, calendarRange.end),
    enabled: !isNew && !!id,
  });

  // Fetch locations
  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.list,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<StoragePayload>({
    defaultValues: {
      location_id: "",
      code: "",
      status: "idle",
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (storageQuery.data) {
      reset({
        location_id: storageQuery.data.location_id,
        code: storageQuery.data.code,
        status: storageQuery.data.status,
      });
      // Set location search term
      const location = locationsQuery.data?.find(l => l.id === storageQuery.data?.location_id);
      if (location) {
        setLocationSearchTerm(location.name);
      }
    }
  }, [storageQuery.data, locationsQuery.data, reset]);

  const locationOptions = useMemo(() => {
    return (locationsQuery.data ?? []).map((location) => ({ 
      value: location.id, 
      label: location.name 
    }));
  }, [locationsQuery.data]);

  const filteredLocationOptions = useMemo(() => {
    if (!locationSearchTerm.trim()) return locationOptions;
    const term = locationSearchTerm.toLowerCase();
    return locationOptions.filter(opt => opt.label.toLowerCase().includes(term));
  }, [locationOptions, locationSearchTerm]);

  const createMutation = useMutation({
    mutationFn: (payload: StoragePayload) => storageService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storages"] });
      void queryClient.invalidateQueries({ queryKey: ["lockers"] });
      push({ title: t("storages.created"), type: "success" });
      navigate("/app/lockers");
    },
    onError: (error: unknown) => {
      push({ title: t("storages.createError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: StoragePayload) => storageService.update(id!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storages"] });
      void queryClient.invalidateQueries({ queryKey: ["lockers"] });
      void queryClient.invalidateQueries({ queryKey: ["storage", id] });
      push({ title: t("storages.updated"), type: "success" });
      navigate("/app/lockers");
    },
    onError: (error: unknown) => {
      push({ title: t("common.saveError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const submit = handleSubmit(async (values) => {
    if (!values.location_id) {
      push({ title: t("storages.locationRequired"), type: "error" });
      return;
    }
    if (isNew) {
      await createMutation.mutateAsync(values);
    } else {
      await updateMutation.mutateAsync(values);
    }
  });

  const handleLocationSelect = useCallback((option: { value: string; label: string }) => {
    setValue("location_id", option.value, { shouldDirty: true });
    setLocationSearchTerm(option.label);
    setShowLocationDropdown(false);
  }, [setValue]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && storageQuery.isLoading) {
    return (
      <div style={{ padding: "var(--space-8)", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "var(--space-16)" }}>
          <Loader2 className="h-12 w-12" style={{ margin: "0 auto", animation: "spin 1s linear infinite", color: "var(--primary)" }} />
          <p style={{ marginTop: "var(--space-4)", color: "var(--text-tertiary)" }}>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-8)", maxWidth: "800px", margin: "0 auto" }}>
      <ToastContainer messages={messages} />
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <ModernButton
          variant="ghost"
          onClick={() => navigate("/app/lockers")}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          style={{ marginBottom: "var(--space-4)" }}
        >
          {t("common.back")}
        </ModernButton>
        
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "var(--radius-xl)",
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-600) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <HardDrive className="h-7 w-7" style={{ color: "white" }} />
          </div>
          <div>
            <h1 style={{ 
              fontSize: "var(--text-2xl)", 
              fontWeight: "var(--font-bold)", 
              color: "var(--text-primary)", 
              margin: 0 
            }}>
              {isNew ? t("storages.newStorage") : t("storages.editStorage")}
            </h1>
            <p style={{ 
              fontSize: "var(--text-sm)", 
              color: "var(--text-tertiary)", 
              margin: "var(--space-1) 0 0 0" 
            }}>
              {isNew ? t("storages.newStorageDesc") : t("storages.editStorageDesc")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Availability Calendar - Show only when editing */}
      {!isNew && calendarQuery.data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{ marginBottom: "var(--space-6)" }}
        >
          <ModernCard variant="elevated" padding="lg">
            <div style={{ marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                <Calendar className="h-5 w-5" style={{ color: "var(--primary)" }} />
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                  Müsaitlik Takvimi
                </h3>
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                Önümüzdeki 14 günlük müsaitlik durumu
              </p>
            </div>
            
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(7, 1fr)", 
              gap: "var(--space-2)",
            }}>
              {/* Week day headers */}
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => (
                <div key={day} style={{ 
                  textAlign: "center", 
                  fontSize: "var(--text-xs)", 
                  fontWeight: "var(--font-semibold)", 
                  color: "var(--text-tertiary)",
                  padding: "var(--space-1) 0",
                }}>
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarQuery.data.days.map((day: StorageCalendarDay) => {
                const date = new Date(day.date);
                const dayNum = date.getDate();
                const isOccupied = day.status === "occupied";
                
                return (
                  <div
                    key={day.date}
                    title={isOccupied ? `${day.reservation_ids.length} rezervasyon` : "Müsait"}
                    style={{
                      aspectRatio: "1",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--radius-md)",
                      background: isOccupied 
                        ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.08) 100%)"
                        : "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.08) 100%)",
                      border: `1px solid ${isOccupied ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
                      cursor: "default",
                    }}
                  >
                    <span style={{ 
                      fontSize: "var(--text-sm)", 
                      fontWeight: "var(--font-semibold)",
                      color: isOccupied ? "#dc2626" : "#16a34a",
                    }}>
                      {dayNum}
                    </span>
                    {isOccupied ? (
                      <XCircle className="h-3 w-3" style={{ color: "#dc2626", marginTop: "2px" }} />
                    ) : (
                      <CheckCircle className="h-3 w-3" style={{ color: "#16a34a", marginTop: "2px" }} />
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div style={{ 
              display: "flex", 
              gap: "var(--space-6)", 
              marginTop: "var(--space-4)",
              paddingTop: "var(--space-4)",
              borderTop: "1px solid var(--border-secondary)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <div style={{ 
                  width: "12px", 
                  height: "12px", 
                  borderRadius: "var(--radius-sm)", 
                  background: "rgba(34, 197, 94, 0.3)",
                  border: "1px solid rgba(34, 197, 94, 0.5)",
                }} />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Müsait</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <div style={{ 
                  width: "12px", 
                  height: "12px", 
                  borderRadius: "var(--radius-sm)", 
                  background: "rgba(239, 68, 68, 0.3)",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                }} />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Dolu</span>
              </div>
            </div>
          </ModernCard>
        </motion.div>
      )}

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ModernCard variant="elevated" padding="lg">
          <form onSubmit={submit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              
              {/* Location Search */}
              <div>
                <label style={{ 
                  display: "block", 
                  fontSize: "var(--text-sm)", 
                  fontWeight: 600, 
                  color: "var(--text-secondary)",
                  marginBottom: "var(--space-2)"
                }}>
                  {t("storages.location")} *
                </label>
                <div style={{ position: "relative" }}>
                  <ModernInput
                    placeholder={t("storages.searchLocation")}
                    value={locationSearchTerm}
                    onChange={(e) => {
                      setLocationSearchTerm(e.target.value);
                      setShowLocationDropdown(true);
                    }}
                    onFocus={() => setShowLocationDropdown(true)}
                    leftIcon={<Search className="h-4 w-4" />}
                    fullWidth
                  />
                  {showLocationDropdown && filteredLocationOptions.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "var(--radius-lg)",
                      boxShadow: "var(--shadow-lg)",
                      zIndex: 100,
                      maxHeight: "240px",
                      overflowY: "auto",
                      marginTop: "var(--space-1)",
                    }}>
                      {filteredLocationOptions.map((option) => (
                        <div
                          key={option.value}
                          onClick={() => handleLocationSelect(option)}
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            cursor: "pointer",
                            borderBottom: "1px solid var(--border-secondary)",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <MapPin className="h-4 w-4" style={{ color: "var(--primary)" }} />
                            <span style={{ fontWeight: 500 }}>{option.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input type="hidden" {...register("location_id", { required: true })} />
                {errors.location_id && (
                  <span style={{ color: "var(--danger-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)", display: "block" }}>
                    {t("common.required")}
                  </span>
                )}
              </div>

              {/* Code */}
              <div>
                <label style={{ 
                  display: "block", 
                  fontSize: "var(--text-sm)", 
                  fontWeight: 600, 
                  color: "var(--text-secondary)",
                  marginBottom: "var(--space-2)"
                }}>
                  {t("storages.code")} *
                </label>
                <ModernInput
                  {...register("code", { required: t("common.required") })}
                  placeholder="DEPO-001"
                  fullWidth
                />
                {errors.code && (
                  <span style={{ color: "var(--danger-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)", display: "block" }}>
                    {errors.code.message}
                  </span>
                )}
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-1)" }}>
                  {t("storages.codeHint")}
                </p>
              </div>

              {/* Status */}
              <div>
                <label style={{ 
                  display: "block", 
                  fontSize: "var(--text-sm)", 
                  fontWeight: 600, 
                  color: "var(--text-secondary)",
                  marginBottom: "var(--space-2)"
                }}>
                  {t("storages.status")}
                </label>
                <select
                  {...register("status")}
                  style={{
                    width: "100%",
                    padding: "var(--space-3) var(--space-4)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-base)",
                  }}
                >
                  <option value="idle">{t("storages.status.idle")}</option>
                  <option value="occupied">{t("storages.status.occupied")}</option>
                  <option value="reserved">{t("storages.status.reserved")}</option>
                  <option value="faulty">{t("storages.status.faulty")}</option>
                </select>
              </div>

              {/* Actions */}
              <div style={{ 
                display: "flex", 
                gap: "var(--space-3)", 
                justifyContent: "flex-end",
                paddingTop: "var(--space-4)",
                borderTop: "1px solid var(--border-secondary)",
                marginTop: "var(--space-2)"
              }}>
                <ModernButton
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("/app/lockers")}
                  disabled={isSaving}
                >
                  {t("common.cancel")}
                </ModernButton>
                <ModernButton
                  type="submit"
                  variant="primary"
                  disabled={isSaving}
                  isLoading={isSaving}
                  loadingText={t("common.saving")}
                  leftIcon={!isSaving && <Save className="h-4 w-4" />}
                >
                  {isNew ? t("common.create") : t("common.save")}
                </ModernButton>
              </div>
            </div>
          </form>
        </ModernCard>
      </motion.div>
    </div>
  );
}
