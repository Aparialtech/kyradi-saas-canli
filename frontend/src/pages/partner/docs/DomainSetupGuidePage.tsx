import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  Server,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  HelpCircle,
  ExternalLink,
  Copy,
  Info,
} from "../../../lib/lucide";
import { detectHostType, hostConfig, isDevelopment } from "../../../lib/hostDetection";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { partnerSettingsService } from "../../../services/partner/settings";

/**
 * Domain Setup Guide Page
 * 
 * SECURITY: This page is ONLY accessible on tenant hosts ({slug}.kyradi.com)
 * It will redirect to 404 on admin.kyradi.com and app.kyradi.com
 */
export function DomainSetupGuidePage() {
  const navigate = useNavigate();
  const { messages, push } = useToast();
  const hostType = detectHostType();
  const isTenantHost = isDevelopment() || hostType === "tenant";
  const tenantSettingsQuery = useQuery({
    queryKey: ["partner", "settings"],
    queryFn: partnerSettingsService.getSettings,
  });

  // SECURITY: Only allow access on tenant hosts
  useEffect(() => {
    if (!isTenantHost) {
      // Not a tenant host - redirect to 404
      navigate("/404", { replace: true });
      return;
    }
  }, [isTenantHost, navigate]);

  if (!isTenantHost) {
    return null;
  }

  // Tenant data (fallbacks should keep the guide readable even if data is missing)
  const tenantSlug = tenantSettingsQuery.data?.tenant_slug ?? "";
  const customDomain = tenantSettingsQuery.data?.custom_domain ?? "";
  const exampleSlug = tenantSlug || "oteliniz";
  const subdomainUrl = tenantSlug ? `https://${tenantSlug}.${hostConfig.ROOT_DOMAIN}/app` : "";
  const customPanelUrl = customDomain ? `https://${customDomain}/app` : "";
  const defaultPanelUrl = tenantSlug ? `https://${tenantSlug}.${hostConfig.ROOT_DOMAIN}` : "";
  const dnsHostLabel = customDomain ? customDomain.split(".")[0] : "panel";

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      push({ title: "Kopyalandı!", type: "success" });
    } catch {
      push({ title: "Kopyalama başarısız", type: "error" });
    }
  };

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "900px", margin: "0 auto" }}>
      <ToastContainer messages={messages} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-8)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Globe style={{ width: "24px", height: "24px", color: "white" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-black)", margin: 0, color: "var(--text-primary)" }}>
              Kyradi – Domain & Panel Kurulumu (Nasıl Kullanılır)
            </h1>
          </div>
        </div>
      </motion.div>

      {/* Sizin Panel Adresiniz */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <Globe className="h-5 w-5" style={{ color: "#6366f1" }} />
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", margin: 0 }}>
              Sizin Panel Adresiniz
            </h2>
          </div>

          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <div style={{
              padding: "var(--space-3)",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
            }}>
              <div>
                <p style={{ margin: "0 0 var(--space-1) 0", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                  Kyradi Subdomain
                </p>
                <code style={{ fontSize: "var(--text-sm)", color: "#6366f1", fontWeight: "var(--font-semibold)" }}>
                  {subdomainUrl}
                </code>
              </div>
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(subdomainUrl)}
                disabled={!subdomainUrl}
                leftIcon={<Copy className="h-4 w-4" />}
              >
                Kopyala
              </ModernButton>
            </div>

            {customPanelUrl && (
              <div style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
              }}>
                <div>
                  <p style={{ margin: "0 0 var(--space-1) 0", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                    Custom Domain Panel
                  </p>
                  <code style={{ fontSize: "var(--text-sm)", color: "#6366f1", fontWeight: "var(--font-semibold)" }}>
                    {customPanelUrl}
                  </code>
                </div>
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(customPanelUrl)}
                  leftIcon={<Copy className="h-4 w-4" />}
                >
                  Kopyala
                </ModernButton>
              </div>
            )}
          </div>
        </ModernCard>
      </motion.div>

      {/* Section 1: Genel Bakış */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <Info className="h-5 w-5" style={{ color: "#6366f1" }} />
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", margin: 0 }}>
              1. Genel Bakış
            </h2>
          </div>
          
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)", lineHeight: 1.7 }}>
            Kyradi paneliniz varsayılan olarak aşağıdaki adresten erişilebilir:
          </p>

          <div style={{
            background: "var(--bg-tertiary)",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-4)",
          }}>
            <code style={{ fontSize: "var(--text-base)", color: "#6366f1", fontWeight: "var(--font-semibold)" }}>
              {defaultPanelUrl}
            </code>
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(defaultPanelUrl)}
              disabled={!defaultPanelUrl}
              leftIcon={<Copy className="h-4 w-4" />}
            >
              Kopyala
            </ModernButton>
          </div>

          <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
            İsterseniz kendi domaininizi (örn: <code style={{ color: "#6366f1" }}>panel.oteliniz.com</code>) bağlayarak 
            müşterilerinize özel bir deneyim sunabilirsiniz.
          </p>
        </ModernCard>
      </motion.div>

      {/* Section 2: Seçenekler */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <Server className="h-5 w-5" style={{ color: "#6366f1" }} />
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", margin: 0 }}>
              2. Domain Seçenekleri
            </h2>
          </div>

          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            {/* Option 1 */}
            <div style={{
              padding: "var(--space-4)",
              borderRadius: "var(--radius-lg)",
              border: "2px solid #22c55e",
              background: "rgba(34, 197, 94, 0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: "#22c55e" }} />
                <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", margin: 0, color: "#22c55e" }}>
                  Seçenek 1: Kyradi Subdomain (Önerilen)
                </h3>
              </div>
              <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "var(--text-sm)" }}>
                Varsayılan <code>{exampleSlug}.kyradi.com</code> adresini kullanın. 
                Ekstra kurulum gerektirmez, SSL otomatik, hemen aktif.
              </p>
            </div>

            {/* Option 2 */}
            <div style={{
              padding: "var(--space-4)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-primary)",
              background: "var(--bg-tertiary)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                <Globe className="h-5 w-5" style={{ color: "#6366f1" }} />
                <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", margin: 0 }}>
                  Seçenek 2: Kendi Domaininiz (Custom Domain)
                </h3>
              </div>
              <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "var(--text-sm)" }}>
                Kendi domain veya subdomain'inizi bağlayın (örn: <code>panel.oteliniz.com</code>).
                DNS ayarı gerektirir.
              </p>
            </div>
          </div>
        </ModernCard>
      </motion.div>

      {/* Section 3: Adım Adım Kurulum */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <CheckCircle2 className="h-5 w-5" style={{ color: "#6366f1" }} />
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", margin: 0 }}>
              3. Adım Adım Custom Domain Kurulumu
            </h2>
          </div>

          {/* Step 1 */}
          <div style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)" 
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#6366f1",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "var(--font-bold)",
                fontSize: "var(--text-sm)",
              }}>1</div>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>
                Kyradi Panelde Domain Ekleyin
              </h3>
            </div>
              <p style={{ color: "var(--text-secondary)", marginLeft: "44px", lineHeight: 1.7 }}>
                <strong>Ayarlar → Genel</strong> sayfasında "Özel Domain" alanına kullanmak istediğiniz 
                adresi girin (örn: <code style={{ color: "#6366f1" }}>panel.oteliniz.com</code>).
              </p>
          </div>

          {/* Step 2 */}
          <div style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)" 
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#6366f1",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "var(--font-bold)",
                fontSize: "var(--text-sm)",
              }}>2</div>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>
                DNS'e CNAME Kaydı Ekleyin
              </h3>
            </div>
            <p style={{ color: "var(--text-secondary)", marginLeft: "44px", marginBottom: "var(--space-3)", lineHeight: 1.7 }}>
              Domain sağlayıcınızın (GoDaddy, Cloudflare, Google Domains vb.) DNS yönetim paneline gidin 
              ve aşağıdaki kaydı ekleyin:
            </p>
            
            {/* DNS Table */}
            <div style={{ marginLeft: "44px", overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "var(--bg-tertiary)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                fontSize: "var(--text-sm)",
              }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)" }}>
                    <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: "var(--font-semibold)", borderBottom: "1px solid var(--border-primary)" }}>Tür</th>
                    <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: "var(--font-semibold)", borderBottom: "1px solid var(--border-primary)" }}>Host/Ad</th>
                    <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: "var(--font-semibold)", borderBottom: "1px solid var(--border-primary)" }}>Değer/Hedef</th>
                    <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: "var(--font-semibold)", borderBottom: "1px solid var(--border-primary)" }}>TTL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "var(--space-3)", borderBottom: "1px solid var(--border-primary)" }}>
                      <code style={{ background: "#6366f1", color: "white", padding: "2px 8px", borderRadius: "4px" }}>CNAME</code>
                    </td>
                    <td style={{ padding: "var(--space-3)", borderBottom: "1px solid var(--border-primary)" }}>
                      <code>{dnsHostLabel}</code>
                    </td>
                    <td style={{ padding: "var(--space-3)", borderBottom: "1px solid var(--border-primary)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <code style={{ color: "#6366f1" }}>kyradi.com</code>
                        <button
                          onClick={() => copyToClipboard("kyradi.com")}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Copy className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "var(--space-3)", borderBottom: "1px solid var(--border-primary)" }}>
                      Auto / 3600
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DNS Code Block */}
            <div style={{
              marginLeft: "44px",
              marginTop: "var(--space-3)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3)",
              fontSize: "var(--text-sm)",
            }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                <code>
{`Type: CNAME
Host: ${dnsHostLabel}
Target: kyradi.com
TTL: Auto`}
                </code>
              </pre>
            </div>

            {/* Info box */}
            <div style={{
              marginLeft: "44px",
              marginTop: "var(--space-3)",
              padding: "var(--space-3)",
              background: "rgba(99, 102, 241, 0.1)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-2)",
            }}>
              <Info className="h-4 w-4" style={{ color: "#6366f1", marginTop: "2px", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                Eğer <code>oteliniz.com</code> ana domainini (subdomain olmadan) bağlamak istiyorsanız, 
                CNAME yerine <strong>A kaydı</strong> eklemeniz gerekebilir. Bu durumda destek ekibiyle iletişime geçin.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)" 
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#6366f1",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "var(--font-bold)",
                fontSize: "var(--text-sm)",
              }}>3</div>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>
                DNS Yayılımını Bekleyin
              </h3>
            </div>
            <div style={{ 
              marginLeft: "44px", 
              display: "flex", 
              alignItems: "center", 
              gap: "var(--space-2)",
              color: "var(--text-secondary)" 
            }}>
              <Clock className="h-4 w-4" style={{ color: "#f59e0b" }} />
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                DNS değişiklikleri genellikle <strong>5 dakika – 24 saat</strong> içinde yayılır. 
                Çoğu durumda 15-30 dakika yeterlidir.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)" 
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#22c55e",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "var(--font-bold)",
                fontSize: "var(--text-sm)",
              }}>4</div>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>
                Kyradi Otomatik Doğrulama
              </h3>
            </div>
            <p style={{ color: "var(--text-secondary)", marginLeft: "44px", lineHeight: 1.7 }}>
              DNS yayıldıktan sonra Kyradi domaininizi otomatik olarak doğrular ve SSL sertifikası oluşturur. 
              Domaininiz aktif olduğunda <strong>Ayarlar</strong> sayfasında "Doğrulandı" etiketi görünecektir.
            </p>
          </div>
        </ModernCard>
      </motion.div>

      {/* Section 4: FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <HelpCircle className="h-5 w-5" style={{ color: "#6366f1" }} />
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", margin: 0 }}>
              4. Sıkça Sorulan Sorular
            </h2>
          </div>

          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div>
              <h4 style={{ margin: "0 0 var(--space-2) 0", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
                Domain çalışmazsa ne yapmalıyım?
              </h4>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
                DNS kayıtlarınızı kontrol edin, CNAME değerinin doğru olduğundan emin olun. 
                24 saat bekledikten sonra hâlâ çalışmıyorsa destek ekibiyle iletişime geçin.
              </p>
            </div>

            <div>
              <h4 style={{ margin: "0 0 var(--space-2) 0", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
                Aynı domain birden fazla otelde kullanılabilir mi?
              </h4>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
                Hayır, her domain yalnızca tek bir otele bağlanabilir. Zaten kullanımda olan bir domain 
                girmeye çalışırsanız hata mesajı alırsınız.
              </p>
            </div>

            <div>
              <h4 style={{ margin: "0 0 var(--space-2) 0", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
                Hem subdomain hem custom domain kullanabilir miyim?
              </h4>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
                Evet! Kyradi subdomain'iniz (<code>{exampleSlug}.kyradi.com</code>) her zaman aktif kalır. 
                Custom domain ek bir erişim noktası olarak çalışır.
              </p>
            </div>

            <div>
              <h4 style={{ margin: "0 0 var(--space-2) 0", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
                SSL/HTTPS otomatik mi?
              </h4>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
                Evet, tüm domainler için SSL sertifikası otomatik olarak oluşturulur ve yenilenir. 
                Ekstra bir işlem yapmanıza gerek yoktur.
              </p>
            </div>

            <div>
              <h4 style={{ margin: "0 0 var(--space-2) 0", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
                Domaini kaldırırsam ne olur?
              </h4>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
                Custom domain'i kaldırdığınızda eski adres çalışmayı durdurur. 
                Kyradi subdomain'iniz (<code>{exampleSlug}.kyradi.com</code>) her zaman aktif kalır.
              </p>
            </div>
          </div>
        </ModernCard>
      </motion.div>

      {/* Section 5: Uyarılar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <ModernCard variant="glass" padding="lg">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <AlertTriangle className="h-5 w-5" style={{ color: "#f59e0b" }} />
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", margin: 0 }}>
              5. Önemli Uyarılar
            </h2>
          </div>

          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <div style={{
              padding: "var(--space-3)",
              background: "rgba(245, 158, 11, 0.1)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-2)",
            }}>
              <AlertTriangle className="h-4 w-4" style={{ color: "#f59e0b", marginTop: "2px", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                <strong>Domain tekil olmalı:</strong> Her domain sadece bir otel tarafından kullanılabilir.
              </p>
            </div>

            <div style={{
              padding: "var(--space-3)",
              background: "rgba(220, 38, 38, 0.1)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-2)",
            }}>
              <AlertTriangle className="h-4 w-4" style={{ color: "#dc2626", marginTop: "2px", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                <strong>Yanlış DNS ayarı paneli bozabilir:</strong> DNS değişikliklerini dikkatli yapın. 
                Mevcut CNAME/A kayıtlarını silmeyin, yenisini ekleyin.
              </p>
            </div>

            <div style={{
              padding: "var(--space-3)",
              background: "rgba(99, 102, 241, 0.1)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-2)",
            }}>
              <Shield className="h-4 w-4" style={{ color: "#6366f1", marginTop: "2px", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                <strong>Yardım mı lazım?</strong> Herhangi bir sorunuz varsa destek ekibimizle iletişime geçmekten çekinmeyin.
              </p>
            </div>
          </div>

          {/* Support CTA */}
          <div style={{ marginTop: "var(--space-6)", textAlign: "center" }}>
            <ModernButton
              variant="outline"
              onClick={() => window.open("mailto:support@kyradi.com?subject=Domain%20Kurulum%20Desteği", "_blank")}
              leftIcon={<ExternalLink className="h-4 w-4" />}
            >
              Destek ile İletişime Geç
            </ModernButton>
          </div>
        </ModernCard>
      </motion.div>
    </div>
  );
}
