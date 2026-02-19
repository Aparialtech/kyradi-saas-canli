import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Mail, Send, Users, Building2, Loader2, CheckCircle2 } from "../../../lib/lucide";
import { adminTenantService } from "../../../services/admin/tenants";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernButton } from "../../../components/ui/ModernButton";
import { getErrorMessage } from "../../../lib/httpError";

interface User {
  id: string;
  email: string;
  full_name?: string;
  tenant_id?: string;
  is_active: boolean;
}

export function AdminEmailPage() {
  const { messages, push } = useToast();
  
  // Form state
  const [recipientType, setRecipientType] = useState<"all" | "tenant" | "custom">("custom");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [customEmails, setCustomEmails] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [sendAsHtml, setSendAsHtml] = useState<boolean>(false);

  // Fetch tenants for selection
  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  // Fetch users for preview
  const usersQuery = useQuery({
    queryKey: ["admin", "users", selectedTenantId],
    queryFn: async (): Promise<User[]> => {
      const params: Record<string, string> = { is_active: "true" };
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      const response = await http.get<User[]>("/admin/users", { params });
      return response.data;
    },
    enabled: recipientType !== "custom",
  });

  // Calculate recipient count
  const recipientCount = useMemo(() => {
    if (recipientType === "custom") {
      const emails = customEmails.split(/[,;\n]/).filter(e => e.trim().length > 0);
      return emails.length;
    }
    return usersQuery.data?.length ?? 0;
  }, [recipientType, customEmails, usersQuery.data]);

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      let recipients: string[] = [];
      
      if (recipientType === "custom") {
        recipients = customEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e.length > 0);
      } else if (recipientType === "tenant" && selectedTenantId) {
        recipients = usersQuery.data?.map(u => u.email) ?? [];
      } else if (recipientType === "all") {
        recipients = usersQuery.data?.map(u => u.email) ?? [];
      }

      if (recipients.length === 0) {
        throw new Error("En az bir alıcı gereklidir");
      }

      const response = await http.post("/admin/email/send", {
        recipients,
        subject,
        body,
        is_html: sendAsHtml,
      });
      return response.data;
    },
    onSuccess: () => {
      push({ 
        title: "E-posta gönderildi", 
        description: `${recipientCount} alıcıya e-posta başarıyla gönderildi.`,
        type: "success" 
      });
      // Reset form
      setSubject("");
      setBody("");
      setCustomEmails("");
    },
    onError: (error: unknown) => {
      push({ 
        title: "E-posta gönderilemedi", 
        description: getErrorMessage(error),
        type: "error" 
      });
    },
  });

  const handleSend = () => {
    if (!subject.trim()) {
      push({ title: "Hata", description: "Konu başlığı gereklidir", type: "error" });
      return;
    }
    if (!body.trim()) {
      push({ title: "Hata", description: "E-posta içeriği gereklidir", type: "error" });
      return;
    }
    if (recipientCount === 0) {
      push({ title: "Hata", description: "En az bir alıcı seçmelisiniz", type: "error" });
      return;
    }
    sendEmailMutation.mutate();
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: 'var(--radius-xl)', 
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Mail className="h-6 w-6" style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: 0 }}>
              E-posta Gönder
            </h1>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
              Kullanıcılara toplu veya tekli e-posta gönder
            </p>
          </div>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-6)' }}>
        {/* Main Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Recipients Section */}
          <ModernCard variant="glass" padding="lg">
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-4) 0' }}>
              📧 Alıcılar
            </h3>
            
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <button
                type="button"
                onClick={() => setRecipientType("custom")}
                style={{
                  flex: 1,
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${recipientType === "custom" ? "#6366f1" : "var(--border-primary)"}`,
                  background: recipientType === "custom" ? "rgba(99, 102, 241, 0.1)" : "var(--bg-tertiary)",
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  fontWeight: recipientType === "custom" ? 'var(--font-semibold)' : 'var(--font-normal)',
                }}
              >
                <Mail className="h-4 w-4" />
                Manuel Giriş
              </button>
              <button
                type="button"
                onClick={() => setRecipientType("tenant")}
                style={{
                  flex: 1,
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${recipientType === "tenant" ? "#6366f1" : "var(--border-primary)"}`,
                  background: recipientType === "tenant" ? "rgba(99, 102, 241, 0.1)" : "var(--bg-tertiary)",
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  fontWeight: recipientType === "tenant" ? 'var(--font-semibold)' : 'var(--font-normal)',
                }}
              >
                <Building2 className="h-4 w-4" />
                Otel Seç
              </button>
              <button
                type="button"
                onClick={() => setRecipientType("all")}
                style={{
                  flex: 1,
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${recipientType === "all" ? "#6366f1" : "var(--border-primary)"}`,
                  background: recipientType === "all" ? "rgba(99, 102, 241, 0.1)" : "var(--bg-tertiary)",
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  fontWeight: recipientType === "all" ? 'var(--font-semibold)' : 'var(--font-normal)',
                }}
              >
                <Users className="h-4 w-4" />
                Tüm Kullanıcılar
              </button>
            </div>

            {recipientType === "custom" && (
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                  E-posta Adresleri (virgül veya satır ile ayırın)
                </label>
                <textarea
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  placeholder="ornek@mail.com, diger@mail.com&#10;veya her satıra bir adres"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-primary)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            )}

            {recipientType === "tenant" && (
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                  Otel Seç
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-primary)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <option value="">Otel seçin...</option>
                  {tenantsQuery.data?.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {recipientType === "all" && (
              <div style={{ 
                padding: 'var(--space-3)', 
                background: 'rgba(245, 158, 11, 0.1)', 
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: '#b45309' }}>
                  ⚠️ Bu seçenek tüm aktif kullanıcılara e-posta gönderir. Dikkatli kullanın!
                </p>
              </div>
            )}
          </ModernCard>

          {/* Email Content */}
          <ModernCard variant="glass" padding="lg">
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-4) 0' }}>
              ✍️ E-posta İçeriği
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <ModernInput
                label="Konu"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="E-posta konu başlığı..."
                fullWidth
              />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)' }}>
                    İçerik
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={sendAsHtml}
                      onChange={(e) => setSendAsHtml(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    HTML olarak gönder
                  </label>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={sendAsHtml ? "<h1>Merhaba!</h1>\n<p>E-posta içeriğiniz...</p>" : "E-posta içeriğinizi buraya yazın..."}
                  rows={12}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-primary)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    resize: 'vertical',
                    fontFamily: sendAsHtml ? 'monospace' : 'inherit',
                  }}
                />
              </div>
            </div>
          </ModernCard>
        </div>

        {/* Sidebar - Preview & Send */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <ModernCard variant="elevated" padding="lg">
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-4) 0' }}>
              📊 Özet
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Alıcı Sayısı</span>
                <strong style={{ color: recipientCount > 0 ? '#16a34a' : 'var(--text-tertiary)' }}>
                  {recipientCount} kişi
                </strong>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Format</span>
                <strong>{sendAsHtml ? "HTML" : "Düz Metin"}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Konu</span>
                <strong style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {subject || "—"}
                </strong>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-6)' }}>
              <ModernButton
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleSend}
                disabled={sendEmailMutation.isPending || recipientCount === 0 || !subject.trim() || !body.trim()}
                leftIcon={sendEmailMutation.isPending ? <Loader2 className="h-5 w-5" style={{ animation: 'spin 1s linear infinite' }} /> : <Send className="h-5 w-5" />}
              >
                {sendEmailMutation.isPending ? "Gönderiliyor..." : "E-posta Gönder"}
              </ModernButton>
            </div>

            {sendEmailMutation.isSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-3)',
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <CheckCircle2 className="h-5 w-5" style={{ color: '#16a34a' }} />
                <span style={{ color: '#16a34a', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                  E-posta başarıyla gönderildi!
                </span>
              </motion.div>
            )}
          </ModernCard>

          {/* Recipients Preview */}
          {recipientType !== "custom" && usersQuery.data && usersQuery.data.length > 0 && (
            <ModernCard variant="glass" padding="md">
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-3) 0' }}>
                Alıcı Listesi (İlk 10)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '200px', overflowY: 'auto' }}>
                {usersQuery.data.slice(0, 10).map((user) => (
                  <div 
                    key={user.id} 
                    style={{ 
                      fontSize: 'var(--text-xs)', 
                      color: 'var(--text-tertiary)',
                      padding: 'var(--space-1) var(--space-2)',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {user.email}
                  </div>
                ))}
                {usersQuery.data.length > 10 && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
                    ... ve {usersQuery.data.length - 10} kişi daha
                  </div>
                )}
              </div>
            </ModernCard>
          )}
        </div>
      </div>
    </div>
  );
}

