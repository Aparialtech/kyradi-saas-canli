import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Mail, Send, Inbox, Send as SendIcon, Loader2, CheckCircle2, AlertCircle } from "../../../lib/lucide";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernButton } from "../../../components/ui/ModernButton";
import { getErrorMessage } from "../../../lib/httpError";

interface ReceivedEmail {
  id: string;
  subject: string;
  body: string;
  sender_email: string;
  sender_name?: string;
  sent_at: string;
  is_html: boolean;
}

interface EmailListResponse {
  emails: ReceivedEmail[];
  total_count: number;
}

export function PartnerMailPage() {
  const { messages, push } = useToast();
  const [activeTab, setActiveTab] = useState<"compose" | "inbox" | "sent">("compose");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [sendAsHtml, setSendAsHtml] = useState<boolean>(false);

  // Fetch received emails
  const receivedEmailsQuery = useQuery<EmailListResponse>({
    queryKey: ["partner", "mail", "received"],
    queryFn: async () => {
      const response = await http.get<EmailListResponse>("/partners/mail/received", {
        params: { limit: 50, offset: 0 },
      });
      return response.data;
    },
    enabled: activeTab === "inbox",
  });

  // Fetch sent emails
  const sentEmailsQuery = useQuery<EmailListResponse>({
    queryKey: ["partner", "mail", "sent"],
    queryFn: async () => {
      const response = await http.get<EmailListResponse>("/partners/mail/sent", {
        params: { limit: 50, offset: 0 },
      });
      return response.data;
    },
    enabled: activeTab === "sent",
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await http.post("/partners/mail/send-to-admin", {
        subject,
        body,
        is_html: sendAsHtml,
      });
      return response.data;
    },
    onSuccess: () => {
      push({
        title: "E-posta gönderildi",
        description: "E-posta admin'e başarıyla gönderildi.",
        type: "success",
      });
      // Reset form
      setSubject("");
      setBody("");
      // Refresh sent emails
      sentEmailsQuery.refetch();
    },
    onError: (error: unknown) => {
      push({
        title: "E-posta gönderilemedi",
        description: getErrorMessage(error),
        type: "error",
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
    sendEmailMutation.mutate();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1400px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-xl)',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail className="h-6 w-6" style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: 0 }}>
              E-posta
            </h1>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
              Admin ile iletişim kurun ve gelen mailleri görüntüleyin
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '2px solid var(--border-primary)' }}>
        <button
          type="button"
          onClick={() => setActiveTab("compose")}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            border: 'none',
            borderBottom: `3px solid ${activeTab === "compose" ? "#6366f1" : "transparent"}`,
            background: 'transparent',
            color: activeTab === "compose" ? "#6366f1" : 'var(--text-tertiary)',
            fontWeight: activeTab === "compose" ? 'var(--font-semibold)' : 'var(--font-normal)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-base)',
          }}
        >
          <SendIcon className="h-4 w-4" />
          Yeni E-posta
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inbox")}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            border: 'none',
            borderBottom: `3px solid ${activeTab === "inbox" ? "#6366f1" : "transparent"}`,
            background: 'transparent',
            color: activeTab === "inbox" ? "#6366f1" : 'var(--text-tertiary)',
            fontWeight: activeTab === "inbox" ? 'var(--font-semibold)' : 'var(--font-normal)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-base)',
          }}
        >
          <Inbox className="h-4 w-4" />
          Gelen Kutusu ({receivedEmailsQuery.data?.total_count ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sent")}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            border: 'none',
            borderBottom: `3px solid ${activeTab === "sent" ? "#6366f1" : "transparent"}`,
            background: 'transparent',
            color: activeTab === "sent" ? "#6366f1" : 'var(--text-tertiary)',
            fontWeight: activeTab === "sent" ? 'var(--font-semibold)' : 'var(--font-normal)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-base)',
          }}
        >
          <Send className="h-4 w-4" />
          Gönderilenler ({sentEmailsQuery.data?.total_count ?? 0})
        </button>
      </div>

      {/* Compose Tab */}
      {activeTab === "compose" && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <ModernCard variant="glass" padding="lg">
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-4) 0' }}>
                Admin'e E-posta Gönder
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

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <ModernCard variant="elevated" padding="lg">
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-4) 0' }}>
                Özet
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Alıcı</span>
                  <strong>Admin</strong>
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
                  disabled={sendEmailMutation.isPending || !subject.trim() || !body.trim()}
                  leftIcon={sendEmailMutation.isPending ? <Loader2 className="h-5 w-5" style={{ animation: 'spin 1s linear infinite' }} /> : <Send className="h-5 w-5" />}
                >
                  {sendEmailMutation.isPending ? "Gönderiliyor..." : "Admin'e Gönder"}
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
          </div>
        </div>
      )}

      {/* Inbox Tab */}
      {activeTab === "inbox" && (
        <ModernCard variant="glass" padding="lg">
          {receivedEmailsQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Mailler yükleniyor...</p>
            </div>
          ) : receivedEmailsQuery.isError ? (
            <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
              <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>
                Mailler alınamadı
              </h3>
              <p style={{ margin: 0 }}>Lütfen daha sonra tekrar deneyin.</p>
            </div>
          ) : receivedEmailsQuery.data?.emails.length === 0 ? (
            <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <Inbox className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
                Gelen kutusu boş
              </h3>
              <p style={{ margin: 0 }}>Henüz admin'den gelen mail bulunmuyor.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {receivedEmailsQuery.data?.emails.map((email) => (
                <div
                  key={email.id}
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.borderColor = '#6366f1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    <div>
                      <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
                        {email.subject}
                      </h4>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                        {email.sender_name || email.sender_email}
                      </p>
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {formatDate(email.sent_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                    {email.body.substring(0, 150)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </ModernCard>
      )}

      {/* Sent Tab */}
      {activeTab === "sent" && (
        <ModernCard variant="glass" padding="lg">
          {sentEmailsQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Mailler yükleniyor...</p>
            </div>
          ) : sentEmailsQuery.isError ? (
            <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
              <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>
                Mailler alınamadı
              </h3>
              <p style={{ margin: 0 }}>Lütfen daha sonra tekrar deneyin.</p>
            </div>
          ) : sentEmailsQuery.data?.emails.length === 0 ? (
            <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <Send className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
                Gönderilen mail yok
              </h3>
              <p style={{ margin: 0 }}>Henüz admin'e gönderilen mail bulunmuyor.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {sentEmailsQuery.data?.emails.map((email) => (
                <div
                  key={email.id}
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.borderColor = '#6366f1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    <div>
                      <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
                        {email.subject}
                      </h4>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                        Alıcı: Admin
                      </p>
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {formatDate(email.sent_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                    {email.body.substring(0, 150)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </ModernCard>
      )}
    </div>
  );
}

