import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileText, Calendar, Filter, CheckCircle2 } from "../../lib/lucide";
import { ModernCard } from "../../components/ui/ModernCard";
import { ModernButton } from "../../components/ui/ModernButton";
import { useTranslation } from "../../hooks/useTranslation";

export function ExportGuidePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <ModernButton
          variant="ghost"
          onClick={() => navigate("/app")}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          style={{ marginBottom: "var(--space-4)" }}
        >
          {t("common.back")}
        </ModernButton>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Download className="h-6 w-6" style={{ color: "white" }} />
          </div>
          <div>
            <h1
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--font-bold)",
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Export Rehberi
            </h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
              Rapor export işlemleri ve kullanım kılavuzu
            </p>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Overview */}
        <ModernCard>
          <h2
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--font-semibold)",
              color: "var(--text-primary)",
              marginTop: 0,
              marginBottom: "var(--space-4)",
            }}
          >
            Export Nedir?
          </h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "var(--space-4)" }}>
            Kyradi sisteminde rezervasyon ve gelir verilerinizi çeşitli formatlarda dışa aktarabilirsiniz. 
            Bu özellik sayesinde verilerinizi Excel, CSV veya PDF formatında indirebilir, muhasebe sistemlerinize aktarabilir veya analiz için kullanabilirsiniz.
          </p>
        </ModernCard>

        {/* Export Formats */}
        <ModernCard>
          <h2
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--font-semibold)",
              color: "var(--text-primary)",
              marginTop: 0,
              marginBottom: "var(--space-4)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <FileText className="h-5 w-5" />
            Export Formatları
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ padding: "var(--space-4)", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginTop: 0, marginBottom: "var(--space-2)" }}>
                CSV Formatı
              </h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)", marginTop: 0 }}>
                Virgülle ayrılmış değerler formatı. Excel, Google Sheets ve diğer tablo programları tarafından açılabilir.
              </p>
              <ul style={{ color: "var(--text-secondary)", paddingLeft: "var(--space-5)", margin: 0 }}>
                <li>Tüm rezervasyon detayları</li>
                <li>Müşteri bilgileri</li>
                <li>Ödeme bilgileri</li>
                <li>Tarih ve saat bilgileri</li>
              </ul>
            </div>

            <div style={{ padding: "var(--space-4)", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginTop: 0, marginBottom: "var(--space-2)" }}>
                Excel (XLSX) Formatı
              </h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)", marginTop: 0 }}>
                Microsoft Excel ve benzeri programlarda doğrudan açılabilen format. Formatlanmış hücreler ve renkli başlıklar içerir.
              </p>
              <ul style={{ color: "var(--text-secondary)", paddingLeft: "var(--space-5)", margin: 0 }}>
                <li>Profesyonel görünüm</li>
                <li>Formatlanmış hücreler</li>
                <li>Otomatik sütun genişlikleri</li>
                <li>Filtreleme özellikleri</li>
              </ul>
            </div>

            <div style={{ padding: "var(--space-4)", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginTop: 0, marginBottom: "var(--space-2)" }}>
                Template (HTML/PDF) Formatı
              </h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)", marginTop: 0 }}>
                Kyradi markalı profesyonel rapor şablonu. HTML veya PDF formatında indirilebilir.
              </p>
              <ul style={{ color: "var(--text-secondary)", paddingLeft: "var(--space-5)", margin: 0 }}>
                <li>Markalı rapor tasarımı</li>
                <li>Yazdırma için optimize edilmiş</li>
                <li>Müşterilere gönderilebilir format</li>
                <li>Profesyonel görünüm</li>
              </ul>
            </div>
          </div>
        </ModernCard>

        {/* How to Export */}
        <ModernCard>
          <h2
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--font-semibold)",
              color: "var(--text-primary)",
              marginTop: 0,
              marginBottom: "var(--space-4)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <Download className="h-5 w-5" />
            Export Nasıl Yapılır?
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "var(--font-semibold)",
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginTop: 0, marginBottom: "var(--space-2)" }}>
                  {t("exportGuide.goToReports")}
                </h3>
                <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                  {t("exportGuide.goToReportsDesc")}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "var(--font-semibold)",
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginTop: 0, marginBottom: "var(--space-2)" }}>
                  Filtreleri Ayarlayın
                </h3>
                <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)", margin: 0 }}>
                  Export etmek istediğiniz veriler için filtreleri ayarlayın:
                </p>
                <ul style={{ color: "var(--text-secondary)", paddingLeft: "var(--space-5)", margin: 0 }}>
                  <li><strong>Tarih Aralığı:</strong> Başlangıç ve bitiş tarihlerini seçin</li>
                  <li><strong>Lokasyon:</strong> Belirli bir lokasyon seçebilir veya tüm lokasyonları seçebilirsiniz</li>
                  <li><strong>Durum:</strong> Rezervasyon durumuna göre filtreleme yapabilirsiniz</li>
                </ul>
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "var(--font-semibold)",
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginTop: 0, marginBottom: "var(--space-2)" }}>
                  Export Formatını Seçin
                </h3>
                <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)", margin: 0 }}>
                  Export butonuna tıklayın ve istediğiniz formatı seçin:
                </p>
                <ul style={{ color: "var(--text-secondary)", paddingLeft: "var(--space-5)", margin: 0 }}>
                  <li><strong>CSV:</strong> Genel kullanım için</li>
                  <li><strong>Excel:</strong> Detaylı analiz için</li>
                  <li><strong>Template:</strong> Profesyonel raporlar için</li>
                </ul>
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "var(--font-semibold)",
                  flexShrink: 0,
                }}
              >
                4
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginTop: 0, marginBottom: "var(--space-2)" }}>
                  Dosyayı İndirin
                </h3>
                <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                  Export işlemi tamamlandıktan sonra dosya otomatik olarak indirilecektir. Dosyayı bilgisayarınıza kaydedebilir veya doğrudan açabilirsiniz.
                </p>
              </div>
            </div>
          </div>
        </ModernCard>

        {/* Limits */}
        <ModernCard>
          <h2
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--font-semibold)",
              color: "var(--text-primary)",
              marginTop: 0,
              marginBottom: "var(--space-4)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <Calendar className="h-5 w-5" />
            Günlük Export Limitleri
          </h2>
          <div style={{ padding: "var(--space-4)", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-3)", marginTop: 0 }}>
              Planınıza göre günlük export limitleriniz:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} />
                <span style={{ color: "var(--text-secondary)" }}>
                  <strong>Free Plan:</strong> Günde 5 export
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} />
                <span style={{ color: "var(--text-secondary)" }}>
                  <strong>Standard Plan:</strong> Günde 20 export
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} />
                <span style={{ color: "var(--text-secondary)" }}>
                  <strong>Premium Plan:</strong> Günde 50 export
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} />
                <span style={{ color: "var(--text-secondary)" }}>
                  <strong>Enterprise Plan:</strong> Sınırsız export
                </span>
              </div>
            </div>
            <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: "var(--space-3)", marginBottom: 0 }}>
              Limit aşıldığında, yeni bir export yapmak için planınızı yükseltebilir veya ertesi günü bekleyebilirsiniz.
            </p>
          </div>
        </ModernCard>

        {/* Tips */}
        <ModernCard>
          <h2
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--font-semibold)",
              color: "var(--text-primary)",
              marginTop: 0,
              marginBottom: "var(--space-4)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <Filter className="h-5 w-5" />
            İpuçları
          </h2>
          <ul style={{ color: "var(--text-secondary)", paddingLeft: "var(--space-5)", margin: 0, lineHeight: 1.8 }}>
            <li>Büyük veri setleri için CSV formatını kullanın - daha hızlı export edilir</li>
            <li>Müşterilere göndermek için Template formatını tercih edin</li>
            <li>Excel'de analiz yapmak için XLSX formatını kullanın</li>
            <li>Gizlilik gerektiren durumlarda "Anonim Export" seçeneğini kullanabilirsiniz</li>
            <li>Export işlemi sırasında sayfayı kapatmayın</li>
            <li>Büyük tarih aralıkları için export işlemi biraz zaman alabilir</li>
          </ul>
        </ModernCard>

        {/* CTA */}
        <ModernCard style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)" }}>
          <div style={{ textAlign: "center", color: "white" }}>
            <h2
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--font-semibold)",
                marginTop: 0,
                marginBottom: "var(--space-2)",
              }}
            >
              Hemen Export Yapmaya Başlayın
            </h2>
            <p style={{ marginBottom: "var(--space-4)", opacity: 0.9 }}>
              {t("exportGuide.exportDescription")}
            </p>
            <ModernButton
              variant="secondary"
              onClick={() => navigate("/app/reports")}
              style={{ background: "white", color: "var(--primary)" }}
            >
              {t("exportGuide.goToReportsButton")}
            </ModernButton>
          </div>
        </ModernCard>
      </div>
    </div>
  );
}
