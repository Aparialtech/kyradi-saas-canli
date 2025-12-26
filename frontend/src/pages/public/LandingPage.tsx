import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  CheckCircle2,
  QrCode,
  Calendar,
  MapPin,
  CreditCard,
  BarChart3,
  MessageSquare,
  Zap,
  Package,
  TrendingUp,
  ChevronDown,
  ArrowRight,
} from "../../lib/lucide";
import styles from "./LandingPage.module.css";

export function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [activeUseCase, setActiveUseCase] = useState<"hotels" | "depots" | "events">("hotels");

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileMenuOpen(false);
    }
  };

  const handleDemoRequest = () => {
    // Navigate to contact or open demo request modal
    window.location.href = "mailto:info@kyradi.com?subject=Demo Talep";
  };

  return (
    <div className={styles.landingPage}>
      {/* Top Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navbarContainer}>
          <Link to="/" className={styles.logo}>
            <img src="/logo.png" alt="Kyradi" className={styles.logoImage} />
            <span className={styles.logoText}>Kyradi</span>
          </Link>

          {/* Desktop Navigation */}
          <div className={styles.navLinks}>
            <button onClick={() => scrollToSection("features")} className={styles.navLink}>
              Özellikler
            </button>
            <button onClick={() => scrollToSection("how-it-works")} className={styles.navLink}>
              Nasıl Çalışır
            </button>
            <button onClick={() => scrollToSection("pricing")} className={styles.navLink}>
              Fiyatlandırma
            </button>
            <button onClick={() => scrollToSection("faq")} className={styles.navLink}>
              SSS
            </button>
          </div>

          {/* Desktop CTAs */}
          <div className={styles.navActions}>
            <button onClick={handleDemoRequest} className={styles.btnSecondary}>
              Demo Talep Et
            </button>
            <button onClick={() => navigate("/login")} className={styles.btnPrimary}>
              Panel Girişi
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className={styles.mobileMenuButton}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={styles.mobileMenu}
            >
              <button onClick={() => scrollToSection("features")} className={styles.mobileNavLink}>
                Özellikler
              </button>
              <button onClick={() => scrollToSection("how-it-works")} className={styles.mobileNavLink}>
                Nasıl Çalışır
              </button>
              <button onClick={() => scrollToSection("pricing")} className={styles.mobileNavLink}>
                Fiyatlandırma
              </button>
              <button onClick={() => scrollToSection("faq")} className={styles.mobileNavLink}>
                SSS
              </button>
              <button onClick={handleDemoRequest} className={styles.mobileNavLink}>
                Demo Talep Et
              </button>
              <button onClick={() => navigate("/login")} className={styles.mobileNavLink}>
                Panel Girişi
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContainer}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className={styles.heroContent}
          >
            <h1 className={styles.heroTitle}>
              Otel Bagaj & Emanet Yönetimi
              <br />
              <span className={styles.heroTitleAccent}>Online, Güvenli, Hızlı</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Rezervasyon, QR doğrulama, ödeme ve raporlama tek platformda. Operasyonunuzu profesyonelleştirin.
            </p>
            <div className={styles.heroCTAs}>
              <button onClick={handleDemoRequest} className={styles.btnPrimaryLarge}>
                Demo Talep Et
                <ArrowRight className="h-5 w-5" />
              </button>
              <button onClick={() => navigate("/login")} className={styles.btnSecondaryLarge}>
                Panel Girişi
              </button>
            </div>
            <div className={styles.trustBadges}>
              <div className={styles.badge}>
                <QrCode className="h-5 w-5" />
                <span>QR Doğrulama</span>
              </div>
              <div className={styles.badge}>
                <Calendar className="h-5 w-5" />
                <span>Online Rezervasyon</span>
              </div>
              <div className={styles.badge}>
                <BarChart3 className="h-5 w-5" />
                <span>Gelir & Hakediş Takibi</span>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={styles.heroVisual}
          >
            <div className={styles.dashboardMock}>
              <div className={styles.mockHeader}>
                <div className={styles.mockHeaderDot}></div>
                <div className={styles.mockHeaderDot}></div>
                <div className={styles.mockHeaderDot}></div>
              </div>
              <div className={styles.mockContent}>
                <div className={styles.mockCard}>
                  <div className={styles.mockCardBar} style={{ width: "60%" }}></div>
                </div>
                <div className={styles.mockCard}>
                  <div className={styles.mockCardBar} style={{ width: "80%" }}></div>
                </div>
                <div className={styles.mockCard}>
                  <div className={styles.mockCardBar} style={{ width: "45%" }}></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={styles.sectionHeader}
          >
            <h2 className={styles.sectionTitle}>Güçlü Özellikler</h2>
            <p className={styles.sectionSubtitle}>
              Otel bagaj yönetiminden emanet hizmetlerine kadar her şey tek platformda
            </p>
          </motion.div>

          <div className={styles.featuresGrid}>
            {[
              {
                icon: <Package className="h-6 w-6" />,
                title: "Online Rezervasyon Widget",
                description: "Web sitenize entegre edilebilen rezervasyon widget'ı ile müşterileriniz doğrudan rezervasyon yapabilir.",
              },
              {
                icon: <QrCode className="h-6 w-6" />,
                title: "QR ile Check-in / Check-out",
                description: "QR kod ile hızlı ve güvenli teslim alma ve teslim etme işlemleri. Manuel giriş de mümkün.",
              },
              {
                icon: <MapPin className="h-6 w-6" />,
                title: "Lokasyon & Depo Yönetimi",
                description: "Çoklu lokasyon ve depo yönetimi. Google Maps entegrasyonu ile kolay konum seçimi.",
              },
              {
                icon: <CreditCard className="h-6 w-6" />,
                title: "Ödeme Sistemleri",
                description: "MagicPay, POS, nakit ve diğer ödeme yöntemlerini destekler. Otomatik ödeme takibi.",
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                title: "Raporlar & Analiz",
                description: "Detaylı gelir raporları, rezervasyon istatistikleri ve depo kullanım analizleri.",
              },
              {
                icon: <MessageSquare className="h-6 w-6" />,
                title: "Ticket / Destek Sistemi",
                description: "Entegre destek sistemi ile müşteri sorularınızı yönetin ve hızlı yanıt verin.",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={styles.featureCard}
              >
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className={styles.howItWorks}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={styles.sectionHeader}
          >
            <h2 className={styles.sectionTitle}>Nasıl Çalışır?</h2>
            <p className={styles.sectionSubtitle}>3 basit adımda operasyonunuzu dijitalleştirin</p>
          </motion.div>

          <div className={styles.stepsContainer}>
            {[
              {
                number: "1",
                title: "Kurulum",
                description: "Hesabınızı oluşturun, lokasyon ve depo bilgilerinizi ekleyin. Widget kodunu web sitenize entegre edin.",
                icon: <Zap className="h-6 w-6" />,
              },
              {
                number: "2",
                title: "Rezervasyon",
                description: "Müşterileriniz web sitenizden veya doğrudan panelden rezervasyon yapabilir. QR kod otomatik oluşturulur.",
                icon: <Calendar className="h-6 w-6" />,
              },
              {
                number: "3",
                title: "Teslim & Raporlama",
                description: "QR kod ile teslim alın, ödemeleri takip edin ve detaylı raporlarla operasyonunuzu analiz edin.",
                icon: <TrendingUp className="h-6 w-6" />,
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className={styles.stepCard}
              >
                <div className={styles.stepNumber}>{step.number}</div>
                <div className={styles.stepIcon}>{step.icon}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className={styles.useCases}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={styles.sectionHeader}
          >
            <h2 className={styles.sectionTitle}>Kullanım Alanları</h2>
            <p className={styles.sectionSubtitle}>Farklı sektörler için esnek çözümler</p>
          </motion.div>

          <div className={styles.useCaseTabs}>
            {[
              { id: "hotels", label: "Oteller" },
              { id: "depots", label: "Şehir İçi Emanet Noktaları" },
              { id: "events", label: "Etkinlik Alanları" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveUseCase(tab.id as "hotels" | "depots" | "events")}
                className={`${styles.useCaseTab} ${activeUseCase === tab.id ? styles.useCaseTabActive : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeUseCase}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={styles.useCaseContent}
            >
              {activeUseCase === "hotels" && (
                <div>
                  <h3 className={styles.useCaseTitle}>Otel Bagaj Yönetimi</h3>
                  <p className={styles.useCaseDescription}>
                    Otel misafirlerinizin bagajlarını güvenle saklayın. Check-in öncesi ve check-out sonrası bagaj
                    hizmetlerinizi profesyonelleştirin. QR kod ile hızlı teslim alın ve verin.
                  </p>
                  <ul className={styles.useCaseList}>
                    <li>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Misafir rezervasyon sistemi</span>
                    </li>
                    <li>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Otomatik QR kod oluşturma</span>
                    </li>
                    <li>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Gelir takibi ve raporlama</span>
                    </li>
                  </ul>
                </div>
              )}
              {activeUseCase === "depots" && (
                <div>
                  <h3 className={styles.useCaseTitle}>Şehir İçi Emanet Noktaları</h3>
                  <p className={styles.useCaseDescription}>
                    Şehir merkezlerinde, havaalanlarında veya turistik bölgelerde emanet hizmeti verin. Çoklu lokasyon
                    yönetimi ile tüm noktalarınızı tek panelden yönetin.
                  </p>
                  <ul className={styles.useCaseList}>
                    <li>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Çoklu lokasyon yönetimi</span>
                    </li>
                    <li>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Online rezervasyon sistemi</span>
                    </li>
                    <li>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Merkezi raporlama</span>
                    </li>
                  </ul>
                </div>
              )}
              {activeUseCase === "events" && (
                <div>
                  <h3 className={styles.useCaseTitle}>Etkinlik Alanları</h3>
                  <p className={styles.useCaseDescription}>
                    Konser, festival, konferans gibi etkinliklerde katılımcıların eşyalarını güvenle saklayın. Hızlı
                    check-in ve check-out ile yoğun trafiği yönetin.
                  </p>
                  <ul className={styles.useCaseList}>
                    <li>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Yüksek kapasiteli depo yönetimi</span>
                    </li>
                    <li>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Hızlı QR doğrulama</span>
                    </li>
                    <li>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Etkinlik bazlı raporlama</span>
                    </li>
                  </ul>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className={styles.pricing}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={styles.sectionHeader}
          >
            <h2 className={styles.sectionTitle}>Fiyatlandırma</h2>
            <p className={styles.sectionSubtitle}>İhtiyacınıza uygun plan seçin</p>
          </motion.div>

          <div className={styles.pricingGrid}>
            {[
              {
                name: "Başlangıç",
                price: "Özel Fiyat",
                features: [
                  "Temel rezervasyon yönetimi",
                  "QR kod doğrulama",
                  "Online rezervasyon widget",
                  "Temel raporlar",
                  "Email desteği",
                ],
              },
              {
                name: "Pro",
                price: "Özel Fiyat",
                features: [
                  "Tüm Başlangıç özellikleri",
                  "Çoklu lokasyon yönetimi",
                  "Gelişmiş raporlar & analiz",
                  "Ödeme entegrasyonları",
                  "Öncelikli destek",
                ],
                popular: true,
              },
              {
                name: "Kurumsal",
                price: "Özel Fiyat",
                features: [
                  "Tüm Pro özellikleri",
                  "Sınırsız lokasyon",
                  "Özel entegrasyonlar",
                  "Dedike destek",
                  "Özel eğitim",
                ],
              },
            ].map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`${styles.pricingCard} ${plan.popular ? styles.pricingCardPopular : ""}`}
              >
                {plan.popular && <div className={styles.popularBadge}>Popüler</div>}
                <h3 className={styles.pricingName}>{plan.name}</h3>
                <div className={styles.pricingPrice}>{plan.price}</div>
                <ul className={styles.pricingFeatures}>
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex}>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={handleDemoRequest} className={styles.btnPrimary}>
                  Demo Talep Et
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={styles.faq}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={styles.sectionHeader}
          >
            <h2 className={styles.sectionTitle}>Sık Sorulan Sorular</h2>
            <p className={styles.sectionSubtitle}>Merak ettikleriniz için hızlı yanıtlar</p>
          </motion.div>

          <div className={styles.faqList}>
            {[
              {
                id: "widget",
                question: "Widget entegrasyonu nasıl yapılır?",
                answer:
                  "Widget entegrasyonu çok basittir. Size verilen JavaScript kodunu web sitenize eklemeniz yeterlidir. Kod otomatik olarak rezervasyon formunu yükler ve müşterilerinizin doğrudan web sitenizden rezervasyon yapmasını sağlar.",
              },
              {
                id: "payment",
                question: "Ödeme güvenliği nasıl sağlanıyor?",
                answer:
                  "Tüm ödeme işlemleri PCI-DSS uyumlu ödeme sağlayıcıları (MagicPay, POS sistemleri) üzerinden gerçekleştirilir. Kart bilgileri sistemimizde saklanmaz. Tüm ödemeler şifrelenmiş bağlantılar üzerinden işlenir.",
              },
              {
                id: "qr",
                question: "QR kod sistemi nasıl çalışır?",
                answer:
                  "Her rezervasyon için benzersiz bir QR kod otomatik oluşturulur. Müşteriler bu QR kodu telefonlarıyla taratarak teslim alma ve teslim etme işlemlerini hızlıca gerçekleştirebilir. QR kodlar güvenli ve taklit edilemezdir.",
              },
              {
                id: "kvkk",
                question: "KVKK uyumlu mu?",
                answer:
                  "Evet, Kyradi tamamen KVKK (Kişisel Verilerin Korunması Kanunu) uyumludur. Tüm kişisel veriler güvenli şekilde saklanır ve yalnızca gerekli durumlarda işlenir. KVKK metinleri rezervasyon sırasında müşterilere sunulur.",
              },
              {
                id: "reporting",
                question: "Raporlama özellikleri nelerdir?",
                answer:
                  "Sistem, gelir raporları, rezervasyon istatistikleri, depo kullanım analizleri ve ödeme yöntemlerine göre detaylı raporlar sunar. Raporları CSV veya Excel formatında dışa aktarabilirsiniz.",
              },
              {
                id: "setup",
                question: "Kurulum süresi ne kadar?",
                answer:
                  "Temel kurulum 1-2 gün içinde tamamlanır. Hesap oluşturma, lokasyon ve depo bilgilerinin girilmesi ve widget entegrasyonu genellikle birkaç saat içinde yapılabilir. Özel entegrasyonlar için ek süre gerekebilir.",
              },
            ].map((faq) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={styles.faqItem}
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className={`${styles.faqQuestion} ${expandedFaq === faq.id ? styles.faqQuestionActive : ""}`}
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className="h-5 w-5"
                    style={{
                      transform: expandedFaq === faq.id ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.3s ease",
                    }}
                  />
                </button>
                <AnimatePresence>
                  {expandedFaq === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className={styles.faqAnswer}
                    >
                      <p>{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCTA}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={styles.finalCTAContent}
          >
            <h2 className={styles.finalCTATitle}>Kyradi ile operasyonunuzu profesyonelleştirin</h2>
            <p className={styles.finalCTASubtitle}>
              Hemen başlayın ve bagaj yönetim süreçlerinizi dijitalleştirin
            </p>
            <div className={styles.finalCTAActions}>
              <button onClick={handleDemoRequest} className={styles.btnPrimaryLarge}>
                Demo Talep Et
                <ArrowRight className="h-5 w-5" />
              </button>
              <button onClick={() => navigate("/login")} className={styles.btnSecondaryLarge}>
                Panel Girişi
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <div className={styles.footerBrand}>
              <img src="/logo.png" alt="Kyradi" className={styles.footerLogo} />
              <p className={styles.footerTagline}>Otel bagaj ve emanet yönetimi için profesyonel çözüm</p>
            </div>
            <div className={styles.footerLinks}>
              <div className={styles.footerColumn}>
                <h4 className={styles.footerTitle}>Ürün</h4>
                <button onClick={() => scrollToSection("features")} className={styles.footerLink}>
                  Özellikler
                </button>
                <button onClick={() => scrollToSection("pricing")} className={styles.footerLink}>
                  Fiyatlandırma
                </button>
                <button onClick={() => scrollToSection("how-it-works")} className={styles.footerLink}>
                  Nasıl Çalışır
                </button>
              </div>
              <div className={styles.footerColumn}>
                <h4 className={styles.footerTitle}>Destek</h4>
                <button onClick={() => scrollToSection("faq")} className={styles.footerLink}>
                  SSS
                </button>
                <button onClick={handleDemoRequest} className={styles.footerLink}>
                  Demo Talep Et
                </button>
                <button onClick={() => navigate("/login")} className={styles.footerLink}>
                  Panel Girişi
                </button>
              </div>
              <div className={styles.footerColumn}>
                <h4 className={styles.footerTitle}>İletişim</h4>
                <a href="mailto:info@kyradi.com" className={styles.footerLink}>
                  info@kyradi.com
                </a>
                <a href="tel:+905551234567" className={styles.footerLink}>
                  +90 555 123 45 67
                </a>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>&copy; {new Date().getFullYear()} Kyradi. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
