import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Key, Mail, ArrowLeft, Copy, CheckCircle2, AlertCircle, Loader2, User, Building2 } from "../../../lib/lucide";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { errorLogger } from "../../../lib/errorLogger";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";

interface UserInfo {
  id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  tenant_id?: string;
  role: string;
  is_active: boolean;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export function AdminUserPasswordResetPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { messages, push } = useToast();
  
  const [resetMode, setResetMode] = useState<"auto" | "manual">("auto");
  const [manualPassword, setManualPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Fetch user info
  const userQuery = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: async (): Promise<UserInfo> => {
      const response = await http.get<UserInfo[]>("/admin/users", { params: { } });
      const user = response.data.find(u => u.id === userId);
      if (!user) throw new Error("Kullanıcı bulunamadı");
      return user;
    },
    enabled: !!userId,
  });

  // Fetch tenants for display
  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: async (): Promise<Tenant[]> => {
      const response = await http.get<Tenant[]>("/admin/tenants");
      return response.data;
    },
  });

  const getTenantName = (tenantId?: string) => {
    if (!tenantId) return "—";
    const tenant = tenantsQuery.data?.find(t => t.id === tenantId);
    return tenant?.name || tenantId;
  };

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        auto_generate: resetMode === "auto",
      };
      if (resetMode === "manual") {
        payload.password = manualPassword;
      }
      if (sendEmail) {
        payload.send_email = true;
      }
      
      const response = await http.post<{ message: string; new_password?: string }>(
        `/admin/users/${userId}/reset-password`,
        payload
      );
      return response.data;
    },
    onSuccess: (data) => {
      setResetSuccess(true);
      if (data.new_password) {
        setNewPassword(data.new_password);
      }
      push({ 
        title: "Parola Sıfırlandı", 
        description: sendEmail ? "Yeni parola kullanıcının e-posta adresine gönderildi" : "Parola başarıyla değiştirildi",
        type: "success" 
      });
    },
    onError: (error) => {
      errorLogger.error(error, {
        component: "AdminUserPasswordResetPage",
        action: "resetPassword",
        userId,
      });
      push({ title: "Parola sıfırlanamadı", description: getErrorMessage(error), type: "error" });
    },
  });

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password).then(() => {
      push({ title: "Kopyalandı", description: "Parola panoya kopyalandı", type: "success" });
    });
  };

  const handleReset = () => {
    if (resetMode === "manual" && manualPassword.length < 8) {
      push({ title: "Geçersiz parola", description: "Parola en az 8 karakter olmalıdır", type: "error" });
      return;
    }
    resetPasswordMutation.mutate();
  };

  const handleBack = () => {
    navigate("/admin/users");
  };

  if (!userId) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
        <p>Kullanıcı ID bulunamadı</p>
        <ModernButton variant="outline" onClick={handleBack} style={{ marginTop: 'var(--space-4)' }}>
          Geri Dön
        </ModernButton>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '800px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <ModernButton
          variant="ghost"
          onClick={handleBack}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          style={{ marginBottom: 'var(--space-4)' }}
        >
          Kullanıcılara Dön
        </ModernButton>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Key className="h-6 w-6" style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: 0 }}>
              Parola Sıfırlama
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              Kullanıcının parolasını sıfırlayın ve e-posta ile bildirin
            </p>
          </div>
        </div>
      </motion.div>

      {/* User Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-4) 0', color: 'var(--text-primary)' }}>
            Kullanıcı Bilgileri
          </h3>
          
          {userQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
              <Loader2 className="h-8 w-8" style={{ margin: '0 auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : userQuery.isError ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: '#dc2626' }}>
              <AlertCircle className="h-8 w-8" style={{ margin: '0 auto var(--space-2) auto' }} />
              <p>Kullanıcı bilgileri alınamadı</p>
            </div>
          ) : userQuery.data && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <User className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>Ad Soyad</p>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }}>
                    {userQuery.data.full_name || "—"}
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Mail className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>E-posta</p>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }}>
                    {userQuery.data.email}
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Building2 className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>Otel</p>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }}>
                    {getTenantName(userQuery.data.tenant_id)}
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Key className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>Rol</p>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }}>
                    {userQuery.data.role}
                  </p>
                </div>
              </div>
            </div>
          )}
        </ModernCard>
      </motion.div>

      {/* Reset Password Form */}
      {!resetSuccess ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ModernCard variant="glass" padding="lg">
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-4) 0', color: 'var(--text-primary)' }}>
              Parola Sıfırlama Seçenekleri
            </h3>
            
            {/* Reset Mode Selection */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                Parola Oluşturma Yöntemi
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setResetMode("auto")}
                  style={{
                    flex: '1 1 200px',
                    padding: 'var(--space-4)',
                    border: `2px solid ${resetMode === "auto" ? 'var(--primary)' : 'var(--border-primary)'}`,
                    borderRadius: 'var(--radius-lg)',
                    background: resetMode === "auto" ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <CheckCircle2 className="h-5 w-5" style={{ color: resetMode === "auto" ? 'var(--primary)' : 'var(--text-tertiary)' }} />
                    <strong style={{ color: 'var(--text-primary)' }}>Otomatik Oluştur</strong>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                    Güvenli, rastgele bir parola otomatik oluşturulur
                  </p>
                </button>
                
                <button
                  type="button"
                  onClick={() => setResetMode("manual")}
                  style={{
                    flex: '1 1 200px',
                    padding: 'var(--space-4)',
                    border: `2px solid ${resetMode === "manual" ? 'var(--primary)' : 'var(--border-primary)'}`,
                    borderRadius: 'var(--radius-lg)',
                    background: resetMode === "manual" ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <Key className="h-5 w-5" style={{ color: resetMode === "manual" ? 'var(--primary)' : 'var(--text-tertiary)' }} />
                    <strong style={{ color: 'var(--text-primary)' }}>Manuel Belirle</strong>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                    Parolayı kendiniz belirleyin
                  </p>
                </button>
              </div>
            </div>

            {/* Manual Password Input */}
            {resetMode === "manual" && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <ModernInput
                  label="Yeni Parola"
                  type="password"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  placeholder="En az 8 karakter"
                  fullWidth
                />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                  Minimum 8 karakter olmalıdır
                </p>
              </div>
            )}

            {/* Email Notification */}
            <div style={{ 
              padding: 'var(--space-4)', 
              background: 'var(--bg-secondary)', 
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-4)'
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  style={{ width: '20px', height: '20px', marginTop: '2px' }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Mail className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                    <strong style={{ color: 'var(--text-primary)' }}>E-posta ile Bildir</strong>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 'var(--space-1) 0 0 0' }}>
                    Yeni parola kullanıcının kayıtlı e-posta adresine gönderilecek
                  </p>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <ModernButton variant="outline" onClick={handleBack}>
                İptal
              </ModernButton>
              <ModernButton
                variant="primary"
                onClick={handleReset}
                disabled={resetPasswordMutation.isPending || (resetMode === "manual" && manualPassword.length < 8)}
                isLoading={resetPasswordMutation.isPending}
                loadingText="Sıfırlanıyor..."
                leftIcon={<Key className="h-4 w-4" />}
              >
                Parolayı Sıfırla
              </ModernButton>
            </div>
          </ModernCard>
        </motion.div>
      ) : (
        /* Success State */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <ModernCard variant="glass" padding="lg">
            <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-4) auto',
              }}>
                <CheckCircle2 className="h-8 w-8" style={{ color: '#16a34a' }} />
              </div>
              
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0', color: '#16a34a' }}>
                Parola Başarıyla Sıfırlandı!
              </h3>
              
              <p style={{ color: 'var(--text-tertiary)', margin: '0 0 var(--space-4) 0' }}>
                {sendEmail 
                  ? `Yeni parola ${userQuery.data?.email} adresine gönderildi`
                  : "Parola başarıyla değiştirildi"
                }
              </p>

              {/* Show new password if auto-generated */}
              {newPassword && (
                <div style={{ 
                  padding: 'var(--space-4)', 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: 'var(--radius-lg)', 
                  border: '1px solid var(--border-primary)',
                  marginBottom: 'var(--space-4)',
                  textAlign: 'left'
                }}>
                  <p style={{ margin: '0 0 var(--space-2) 0', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>
                    Yeni Parola:
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <code style={{ 
                      flex: 1, 
                      padding: 'var(--space-3)', 
                      background: 'var(--bg-primary)', 
                      borderRadius: 'var(--radius-md)', 
                      fontFamily: 'monospace',
                      fontSize: 'var(--text-lg)',
                      letterSpacing: '0.1em'
                    }}>
                      {newPassword}
                    </code>
                    <ModernButton
                      variant="outline"
                      onClick={() => copyPassword(newPassword)}
                      leftIcon={<Copy className="h-4 w-4" />}
                    >
                      Kopyala
                    </ModernButton>
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-2) 0 0 0' }}>
                    Bu parolayı güvenli bir yerde saklayın
                  </p>
                </div>
              )}

              <ModernButton variant="primary" onClick={handleBack}>
                Kullanıcılara Dön
              </ModernButton>
            </div>
          </ModernCard>
        </motion.div>
      )}
    </div>
  );
}
