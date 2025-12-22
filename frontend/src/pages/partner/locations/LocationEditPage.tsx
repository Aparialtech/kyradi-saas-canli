import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Clock, 
  Plus, 
  Trash2,
  Building2,
  Save,
  X
} from "../../../lib/lucide";

import { locationService, type LocationPayload } from "../../../services/partner/locations";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";

import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { TimeField } from "../../../components/ui/DateField";
import { GoogleMapPicker } from "../../../components/maps/GoogleMapPicker";

// Time slot schema for multiple time ranges per day
const timeSlotSchema = z.object({
  start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Geçerli saat formatı: HH:MM"),
  end: z.string().regex(/^([01]?[0-9]|2[0-4]):[0-5][0-9]$/, "Geçerli saat formatı: HH:MM"),
});

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  slots: z.array(timeSlotSchema),
});

const formSchema = z.object({
  name: z.string().min(2, "Lokasyon adı en az 2 karakter olmalı"),
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().min(5, "Adres en az 5 karakter olmalı"),
  address_details: z.string().optional(),
  phone_number: z.string().optional(),
  schedule: z.object({
    monday: dayScheduleSchema,
    tuesday: dayScheduleSchema,
    wednesday: dayScheduleSchema,
    thursday: dayScheduleSchema,
    friday: dayScheduleSchema,
    saturday: dayScheduleSchema,
    sunday: dayScheduleSchema,
  }),
});

type FormValues = z.infer<typeof formSchema>;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Pazartesi',
  tuesday: 'Salı',
  wednesday: 'Çarşamba',
  thursday: 'Perşembe',
  friday: 'Cuma',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};

export function LocationEditPage() {
  const { t: _t } = useTranslation(); // Translation hook ready for i18n
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);

  const isNew = id === 'new';

  // Fetch location data if editing
  const { data: location, isLoading } = useQuery({
    queryKey: ["location", id],
    queryFn: () => locationService.get(id!),
    enabled: !isNew && !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      city: "",
      district: "",
      address: "",
      address_details: "",
      phone_number: "",
      schedule: DAYS.reduce((acc, day) => ({
        ...acc,
        [day]: { enabled: false, slots: [{ start: "09:00", end: "18:00" }] },
      }), {} as FormValues['schedule']),
    },
  });

  // Populate form when location data loads
  useEffect(() => {
    if (location) {
      const workingHours = location.working_hours as Record<string, { open: string; close: string }> | undefined;
      
      reset({
        name: location.name,
        city: "",
        district: "",
        address: location.address || "",
        address_details: "",
        phone_number: location.phone_number || "",
        schedule: DAYS.reduce((acc, day) => {
          const dayHours = workingHours?.[day];
          return {
            ...acc,
            [day]: {
              enabled: !!dayHours?.open,
              slots: dayHours?.open
                ? [{ start: dayHours.open, end: dayHours.close }]
                : [{ start: "09:00", end: "18:00" }],
            },
          };
        }, {} as FormValues['schedule']),
      });

      if (location.lat && location.lon) {
        setMapCoords({ lat: location.lat, lng: location.lon });
      }
    }
  }, [location, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: LocationPayload) => locationService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      push({ title: "Lokasyon oluşturuldu", type: "success" });
      navigate("/app/locations");
    },
    onError: (error: unknown) => {
      push({ title: "Lokasyon oluşturulamadı", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<LocationPayload> }) =>
      locationService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      void queryClient.invalidateQueries({ queryKey: ["location", id] });
      push({ title: "Lokasyon güncellendi", type: "success" });
      navigate("/app/locations");
    },
    onError: (error: unknown) => {
      push({ title: "Lokasyon güncellenemedi", description: getErrorMessage(error), type: "error" });
    },
  });

  const onSubmit = handleSubmit((values) => {
    // Convert schedule to working_hours format
    const working_hours: Record<string, { open: string; close: string }> = {};
    DAYS.forEach((day) => {
      if (values.schedule[day].enabled && values.schedule[day].slots.length > 0) {
        const slot = values.schedule[day].slots[0];
        working_hours[day] = { open: slot.start, close: slot.end };
      }
    });

    const payload: LocationPayload = {
      name: values.name,
      address: [values.address, values.address_details].filter(Boolean).join(" - "),
      phone_number: values.phone_number?.trim() || undefined,
      working_hours: Object.keys(working_hours).length > 0 ? working_hours : undefined,
      lat: mapCoords?.lat,
      lon: mapCoords?.lng,
    };

    if (isNew) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: id!, payload });
    }
  });

  const addTimeSlot = useCallback((day: typeof DAYS[number]) => {
    const currentSlots = watch(`schedule.${day}.slots`);
    setValue(`schedule.${day}.slots`, [...currentSlots, { start: "09:00", end: "18:00" }]);
  }, [watch, setValue]);

  const removeTimeSlot = useCallback((day: typeof DAYS[number], index: number) => {
    const currentSlots = watch(`schedule.${day}.slots`);
    if (currentSlots.length > 1) {
      setValue(`schedule.${day}.slots`, currentSlots.filter((_, i) => i !== index));
    }
  }, [watch, setValue]);

  if (!isNew && isLoading) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
          <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)', margin: '0 auto' }} />
          <p style={{ marginTop: 'var(--space-4)', color: 'var(--text-tertiary)' }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <ToastContainer messages={messages} />
      
      {/* Header */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Button
            variant="ghost"
            onClick={() => navigate("/app/locations")}
            style={{ padding: 'var(--space-2)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title text-gradient">
              {isNew ? "Yeni Lokasyon Ekle" : "Lokasyonu Düzenle"}
            </h1>
            <p className="page-description">
              {isNew ? "Yeni bir lokasyon oluşturun" : `${location?.name || ''} lokasyonunu düzenleyin`}
            </p>
          </div>
        </div>
      </motion.div>

      <form onSubmit={onSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          {/* Left Column - Basic Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card variant="elevated" padding="none">
              <CardHeader
                title="Temel Bilgiler"
                description="Lokasyonun temel bilgilerini girin"
              />
              <CardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <Input
                    {...register("name")}
                    label="Lokasyon Adı *"
                    placeholder="Örn: Taksim Şube"
                    error={errors.name?.message}
                    leftIcon={<Building2 className="h-4 w-4" />}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input
                      {...register("city")}
                      label="İl"
                      placeholder="İstanbul"
                    />
                    <Input
                      {...register("district")}
                      label="İlçe"
                      placeholder="Beyoğlu"
                    />
                  </div>

                  <Input
                    {...register("address")}
                    label="Açık Adres *"
                    placeholder="Cadde, sokak, bina no"
                    error={errors.address?.message}
                    leftIcon={<MapPin className="h-4 w-4" />}
                  />

                  <Input
                    {...register("address_details")}
                    label="Adres Detayları"
                    placeholder="Kat, daire, kapı no"
                    helperText="Opsiyonel"
                  />

                  <Input
                    {...register("phone_number")}
                    label="Kurumsal Telefon"
                    placeholder="+90 (5XX) XXX XX XX"
                    leftIcon={<Phone className="h-4 w-4" />}
                    helperText="Maskelenmiş telefon numarası"
                  />
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* Right Column - Map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card variant="elevated" padding="none">
              <CardHeader
                title="Harita Konumu"
                description="Haritadan lokasyon seçin"
              />
              <CardBody>
                <GoogleMapPicker
                  initialLat={mapCoords?.lat}
                  initialLng={mapCoords?.lng}
                  onLocationSelect={(location) => {
                    setMapCoords({ lat: location.lat, lng: location.lng });
                    if (location.address) {
                      setValue('address', location.address);
                    }
                    if (location.city) {
                      setValue('city', location.city);
                    }
                    if (location.district) {
                      setValue('district', location.district);
                    }
                  }}
                />
                <p style={{ 
                  marginTop: 'var(--space-3)', 
                  fontSize: 'var(--text-sm)', 
                  color: 'var(--text-tertiary)' 
                }}>
                  Haritadan konum seçtiğinizde adres ve koordinatlar otomatik doldurulacak
                </p>
              </CardBody>
            </Card>
          </motion.div>
        </div>

        {/* Working Hours Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ marginTop: 'var(--space-6)' }}
        >
          <Card variant="elevated" padding="none">
            <CardHeader
              title="Çalışma Saatleri"
              description="Günlük müsaitlik saat aralıklarını belirleyin (birden fazla aralık ekleyebilirsiniz)"
            />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {DAYS.map((day) => {
                  const daySchedule = watch(`schedule.${day}`);
                  return (
                    <div 
                      key={day} 
                      style={{ 
                        padding: 'var(--space-4)',
                        background: daySchedule.enabled ? 'var(--bg-secondary)' : 'transparent',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-primary)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            {...register(`schedule.${day}.enabled`)}
                            style={{ width: '18px', height: '18px' }}
                          />
                          <span style={{ fontWeight: 500 }}>{DAY_LABELS[day]}</span>
                        </label>
                        {daySchedule.enabled && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addTimeSlot(day)}
                          >
                            <Plus className="h-4 w-4" style={{ marginRight: 'var(--space-1)' }} />
                            Aralık Ekle
                          </Button>
                        )}
                      </div>

                      {daySchedule.enabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                          {daySchedule.slots.map((_, slotIndex) => (
                            <div 
                              key={slotIndex}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 'var(--space-2)',
                                padding: 'var(--space-2)',
                                background: 'var(--bg-primary)',
                                borderRadius: 'var(--radius-md)'
                              }}
                            >
                              <Clock className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                              <Controller
                                name={`schedule.${day}.slots.${slotIndex}.start` as const}
                                control={control}
                                render={({ field }) => (
                                  <TimeField
                                    value={field.value}
                                    onChange={field.onChange}
                                    size="sm"
                                  />
                                )}
                              />
                              <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                              <Controller
                                name={`schedule.${day}.slots.${slotIndex}.end` as const}
                                control={control}
                                render={({ field }) => (
                                  <TimeField
                                    value={field.value}
                                    onChange={field.onChange}
                                    size="sm"
                                  />
                                )}
                              />
                              {daySchedule.slots.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeTimeSlot(day, slotIndex)}
                                  style={{ color: 'var(--danger-500)' }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Form Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
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
            onClick={() => navigate("/app/locations")}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <X className="h-4 w-4" style={{ marginRight: 'var(--space-1)' }} />
            İptal
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) ? (
              <>Kaydediliyor...</>
            ) : (
              <>
                <Save className="h-4 w-4" style={{ marginRight: 'var(--space-1)' }} />
                {isNew ? "Lokasyon Oluştur" : "Kaydet"}
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </div>
  );
}
