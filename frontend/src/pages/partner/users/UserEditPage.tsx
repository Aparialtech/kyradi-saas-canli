import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, User, Mail, Phone, Save, X, Shield } from "../../../lib/lucide";

import { userService, type TenantUserCreate, type TenantUserUpdate } from "../../../services/partner/users";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";

import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";

const VALID_ROLES = ["storage_operator", "hotel_manager", "accounting", "staff", "tenant_admin"] as const;

const formSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalı"),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  phone_number: z.string().optional(),
  role: z.enum(VALID_ROLES),
});

type FormValues = z.infer<typeof formSchema>;

const ROLE_LABELS: Record<string, string> = {
  storage_operator: "Depo Görevlisi",
  hotel_manager: "Otel Yöneticisi",
  accounting: "Muhasebe",
  staff: "Personel",
  tenant_admin: "Tenant Admin",
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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone_number: "",
      role: "storage_operator",
    },
  });

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      // Map role to valid role if needed
      const validRole = VALID_ROLES.includes(user.role as typeof VALID_ROLES[number]) 
        ? user.role as typeof VALID_ROLES[number]
        : "storage_operator";
      reset({
        name: user.name || "",
        email: user.email,
        phone_number: user.phone_number || "",
        role: validRole,
      });
    }
  }, [user, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: TenantUserCreate) => userService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
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
        name: values.name,
        email: values.email,
        phone_number: values.phone_number || undefined,
        role: values.role,
        is_active: true, // Default to active
      });
    } else {
      updateMutation.mutate({
        id: id!,
        payload: {
          name: values.name,
          email: values.email,
          phone_number: values.phone_number || undefined,
          role: values.role,
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
              {isNew ? "Yeni bir kullanıcı oluşturun" : `${user?.name || ''} kullanıcısını düzenleyin`}
            </p>
          </div>
        </div>
      </motion.div>

      <form onSubmit={onSubmit}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="elevated" padding="none">
            <CardHeader
              title="Kullanıcı Bilgileri"
              description="Kullanıcının temel bilgilerini girin"
            />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input
                  {...register("name")}
                  label="Ad Soyad *"
                  placeholder="Ahmet Yılmaz"
                  error={errors.name?.message}
                  leftIcon={<User className="h-4 w-4" />}
                />

                <Input
                  {...register("email")}
                  type="email"
                  label="E-posta *"
                  placeholder="ornek@email.com"
                  error={errors.email?.message}
                  leftIcon={<Mail className="h-4 w-4" />}
                />

                <Input
                  {...register("phone_number")}
                  label="Telefon Numarası"
                  placeholder="+90 555 123 4567"
                  leftIcon={<Phone className="h-4 w-4" />}
                  helperText="Opsiyonel"
                />

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 'var(--space-2)', 
                    fontWeight: 500, 
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Shield className="h-4 w-4" />
                      Rol *
                    </div>
                  </label>
                  <select
                    {...register("role")}
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
                    <option value="operator">{ROLE_LABELS.operator}</option>
                    <option value="manager">{ROLE_LABELS.manager}</option>
                    <option value="admin">{ROLE_LABELS.admin}</option>
                  </select>
                  <p style={{ 
                    marginTop: 'var(--space-1)', 
                    fontSize: 'var(--text-xs)', 
                    color: 'var(--text-tertiary)' 
                  }}>
                    Kullanıcının sistem içindeki yetki seviyesi
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
          transition={{ delay: 0.2 }}
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
