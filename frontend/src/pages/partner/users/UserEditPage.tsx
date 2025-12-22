import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, User, Mail, Phone, Save, X, Shield, CreditCard, MapPin, Users } from "../../../lib/lucide";

import { userService, type TenantUserCreate, type TenantUserUpdate, type Gender } from "../../../services/partner/users";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";

import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { DateField } from "../../../components/ui/DateField";

const VALID_ROLES = ["storage_operator", "hotel_manager", "accounting", "staff", "tenant_admin"] as const;
const VALID_GENDERS = ["male", "female", "other"] as const;

const formSchema = z.object({
  full_name: z.string().min(2, "İsim Soyisim en az 2 karakter olmalı"),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  phone_number: z.string().optional(),
  birth_date: z.string().optional(),
  tc_identity_number: z.string().optional().refine(
    (val) => !val || val.length === 11,
    { message: "TC Kimlik No 11 haneli olmalı" }
  ),
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  gender: z.enum(VALID_GENDERS).optional().nullable(),
  role: z.enum(VALID_ROLES),
  password: z.string().min(8, "Parola en az 8 karakter olmalı").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

const ROLE_LABELS: Record<string, string> = {
  storage_operator: "Depo Görevlisi",
  hotel_manager: "Otel Yöneticisi",
  accounting: "Muhasebe",
  staff: "Personel",
  tenant_admin: "Tenant Admin",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Erkek",
  female: "Kadın",
  other: "Diğer",
};

export function UserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();

  const isNew = id === 'new';

  // Fetch user data if editing
  const { data: user, isLoading } = useQuery({
    queryKey: ["tenant-user", id],
    queryFn: () => userService.get(id!),
    enabled: !isNew && !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone_number: "",
      birth_date: "",
      tc_identity_number: "",
      city: "",
      district: "",
      address: "",
      gender: null,
      role: "storage_operator",
      password: "",
    },
  });

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      const validRole = VALID_ROLES.includes(user.role as typeof VALID_ROLES[number]) 
        ? user.role as typeof VALID_ROLES[number]
        : "storage_operator";
      
      reset({
        full_name: user.full_name || "",
        email: user.email,
        phone_number: user.phone_number || "",
        birth_date: user.birth_date ? user.birth_date.split("T")[0] : "",
        tc_identity_number: user.tc_identity_number || "",
        city: user.city || "",
        district: user.district || "",
        address: user.address || "",
        gender: user.gender as Gender || null,
        role: validRole,
        password: "",
      });
    }
  }, [user, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: TenantUserCreate) => userService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", "users"] });
      push({ title: "Kullanıcı oluşturuldu", type: "success" });
      navigate("/app/users");
    },
    onError: (error: unknown) => {
      push({ title: "Kullanıcı oluşturulamadı", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TenantUserUpdate }) =>
      userService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant-user", id] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", "users"] });
      push({ title: "Kullanıcı güncellendi", type: "success" });
      navigate("/app/users");
    },
    onError: (error: unknown) => {
      push({ title: "Kullanıcı güncellenemedi", description: getErrorMessage(error), type: "error" });
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (isNew) {
      createMutation.mutate({
        email: values.email,
        password: values.password || undefined,
        role: values.role as any,
        is_active: true,
        full_name: values.full_name || undefined,
        phone_number: values.phone_number || undefined,
        birth_date: values.birth_date || undefined,
        tc_identity_number: values.tc_identity_number || undefined,
        city: values.city || undefined,
        district: values.district || undefined,
        address: values.address || undefined,
        gender: values.gender || undefined,
        auto_generate_password: !values.password,
      });
    } else {
      updateMutation.mutate({
        id: id!,
        payload: {
          full_name: values.full_name || null,
          phone_number: values.phone_number || null,
          birth_date: values.birth_date || null,
          tc_identity_number: values.tc_identity_number || null,
          city: values.city || null,
          district: values.district || null,
          address: values.address || null,
          gender: values.gender || null,
          role: values.role as any,
          password: values.password || undefined,
        },
      });
    }
  });

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

  const inputStyle = {
    width: '100%',
    padding: 'var(--space-3)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 'var(--space-2)',
    fontWeight: 500,
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  };

  return (
    <div className="page-container" style={{ padding: 'var(--space-8)', maxWidth: '900px', margin: '0 auto' }}>
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
            onClick={() => navigate("/app/users")}
            style={{ padding: 'var(--space-2)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title text-gradient" style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>
              {isNew ? "Yeni Kullanıcı Ekle" : "Kullanıcıyı Düzenle"}
            </h1>
            <p className="page-description" style={{ margin: 0, color: 'var(--text-tertiary)' }}>
              {isNew ? "Yeni bir kullanıcı oluşturun" : `${user?.full_name || user?.email || ''} kullanıcısını düzenleyin`}
            </p>
          </div>
        </div>
      </motion.div>

      <form onSubmit={onSubmit}>
        {/* Personal Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="elevated" padding="none">
            <CardHeader
              title="Kişisel Bilgiler"
              description="Kullanıcının kişisel bilgilerini girin"
            />
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
                <Input
                  {...register("full_name")}
                  label="İsim Soyisim *"
                  placeholder="Ahmet Yılmaz"
                  error={errors.full_name?.message}
                  leftIcon={<User className="h-4 w-4" />}
                />

                <Input
                  {...register("email")}
                  type="email"
                  label="E-posta *"
                  placeholder="ornek@email.com"
                  error={errors.email?.message}
                  leftIcon={<Mail className="h-4 w-4" />}
                  disabled={!isNew}
                />

                <Input
                  {...register("phone_number")}
                  label="Telefon Numarası"
                  placeholder="5551234567"
                  leftIcon={<Phone className="h-4 w-4" />}
                />

                <Controller
                  name="birth_date"
                  control={control}
                  render={({ field }) => (
                    <DateField
                      label="Doğum Tarihi"
                      value={field.value || ""}
                      onChange={(value) => field.onChange(value || "")}
                      fullWidth
                    />
                  )}
                />

                <Input
                  {...register("tc_identity_number")}
                  label="TC Kimlik No"
                  placeholder="12345678901"
                  error={errors.tc_identity_number?.message}
                  leftIcon={<CreditCard className="h-4 w-4" />}
                  maxLength={11}
                />

                <div>
                  <label style={labelStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Users className="h-4 w-4" />
                      Cinsiyet
                    </div>
                  </label>
                  <Controller
                    name="gender"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        style={inputStyle}
                      >
                        <option value="">Seçiniz</option>
                        {VALID_GENDERS.map((g) => (
                          <option key={g} value={g}>{GENDER_LABELS[g]}</option>
                        ))}
                      </select>
                    )}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Address Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ marginTop: 'var(--space-4)' }}
        >
          <Card variant="elevated" padding="none">
            <CardHeader
              title="Adres Bilgileri"
              description="Kullanıcının adres bilgilerini girin"
            />
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                <Input
                  {...register("city")}
                  label="İl"
                  placeholder="İstanbul"
                  leftIcon={<MapPin className="h-4 w-4" />}
                />

                <Input
                  {...register("district")}
                  label="İlçe"
                  placeholder="Kadıköy"
                  leftIcon={<MapPin className="h-4 w-4" />}
                />

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <MapPin className="h-4 w-4" />
                      Açık Adres
                    </div>
                  </label>
                  <textarea
                    {...register("address")}
                    placeholder="Mahalle, Sokak, Bina No, Daire No..."
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Account Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ marginTop: 'var(--space-4)' }}
        >
          <Card variant="elevated" padding="none">
            <CardHeader
              title="Hesap Bilgileri"
              description="Kullanıcının yetki ve şifre bilgilerini ayarlayın"
            />
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
                <div>
                  <label style={labelStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Shield className="h-4 w-4" />
                      Rol *
                    </div>
                  </label>
                  <select
                    {...register("role")}
                    style={inputStyle}
                  >
                    {VALID_ROLES.map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                  <p style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    Kullanıcının sistem içindeki yetki seviyesi
                  </p>
                </div>

                <div>
                  <Input
                    {...register("password")}
                    type="password"
                    label={isNew ? "Parola (opsiyonel)" : "Yeni Parola (opsiyonel)"}
                    placeholder="••••••••"
                    error={errors.password?.message}
                  />
                  <p style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    {isNew 
                      ? "Boş bırakırsanız otomatik parola oluşturulur" 
                      : "Değiştirmek istemiyorsanız boş bırakın"}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Form Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
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
            onClick={() => navigate("/app/users")}
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
                {isNew ? "Kullanıcı Oluştur" : "Kaydet"}
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </div>
  );
}
