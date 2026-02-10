import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "../../hooks/useTranslation";
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
  Mail,
  Phone,
  Send,
  Shield,
  Clock,
  Users,
  Globe,
  Lock,
  Eye,
} from "../../lib/lucide";
import styles from "./LandingPage.module.css";

export function LandingPage() {
  const { t } = useTranslation();
  const panelUrl = "https://app.kyradi.com";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [activeUseCase, setActiveUseCase] = useState<"hotels" | "depots" | "events">("hotels");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

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
    scrollToSection("contact");
  };

  const handlePanelLogin = () => {
    window.location.assign(panelUrl);
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);
    
    // Simulate form submission (in production, this would call an API)
    const subject = encodeURIComponent("Landing Page İletişim Formu");
    const body = encodeURIComponent(
      `İsim: ${contactForm.name}\nE-posta: ${contactForm.email}\nTelefon: ${contactForm.phone}\nŞirket: ${contactForm.company}\n\nMesaj:\n${contactForm.message}`
    );
    
    // Open mailto link
    window.location.href = `mailto:info@kyradi.com?subject=${subject}&body=${body}`;
    
    setTimeout(() => {
      setContactSuccess(true);
      setContactSubmitting(false);
      setContactForm({ name: "", email: "", phone: "", company: "", message: "" });
      setTimeout(() => setContactSuccess(false), 5000);
    }, 500);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const { clientWidth, clientHeight } = canvas.parentElement ?? canvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor(clientHeight * dpr);
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const blobs = [
      { x: 120, y: 120, r: 180, vx: 0.18, vy: 0.12, color: "rgba(99, 102, 241, 0.35)" },
      { x: 420, y: 260, r: 220, vx: -0.14, vy: 0.1, color: "rgba(16, 185, 129, 0.28)" },
      { x: 680, y: 120, r: 160, vx: 0.12, vy: -0.16, color: "rgba(56, 189, 248, 0.25)" },
    ];

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(0, 0, width, height);

      for (const blob of blobs) {
        const gradient = ctx.createRadialGradient(blob.x, blob.y, blob.r * 0.1, blob.x, blob.y, blob.r);
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
        ctx.fill();

        if (!prefersReducedMotion) {
          blob.x += blob.vx;
          blob.y += blob.vy;
          if (blob.x < -100 || blob.x > width + 100) blob.vx *= -1;
          if (blob.y < -100 || blob.y > height + 100) blob.vy *= -1;
        }
      }

      if (!prefersReducedMotion) {
        animationId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (animationId) window.cancelAnimationFrame(animationId);
    };
  }, []);

  const imageSrc = (fileName: string) => `/landing-examples/${fileName}`;

  return (
    <div className={styles.landingPage}>
      {/* Top Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navbarContainer}>
          <Link to="/" className={styles.logo}>
            <img src="/kyradi_logo.png" alt="Kyradi" className={styles.logoImage} />
            <span className={styles.logoText}>Kyradi</span>
          </Link>

          {/* Desktop Navigation */}
          <div className={styles.navLinks}>
            <button onClick={() => scrollToSection("features")} className={styles.navLink}>
              Özellikler
            </button>
            <button onClick={() => scrollToSection("screenshots")} className={styles.navLink}>
              Örnek Sayfalar
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
            <button onClick={() => scrollToSection("contact")} className={styles.navLink}>
              İletişim
            </button>
          </div>

          {/* Desktop CTAs */}
          <div className={styles.navActions}>
            <button onClick={handleDemoRequest} className={styles.btnSecondary}>
              Demo Talep Et
            </button>
            <button onClick={handlePanelLogin} className={styles.btnPrimary}>
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
              <button onClick={() => scrollToSection("screenshots")} className={styles.mobileNavLink}>
                Örnek Sayfalar
              </button>
              <button onClick={() => scrollToSection("faq")} className={styles.mobileNavLink}>
                SSS
              </button>
              <button onClick={() => scrollToSection("contact")} className={styles.mobileNavLink}>
                İletişim
              </button>
              <button onClick={handleDemoRequest} className={styles.mobileNavLink}>
                Demo Talep Et
              </button>
              <button onClick={handlePanelLogin} className={styles.mobileNavLink}>
                Panel Girişi
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackdrop}>
          <canvas ref={canvasRef} className={styles.heroCanvas} aria-hidden="true" />
          <div className={styles.heroNoise} aria-hidden="true" />
        </div>
        <div className={styles.heroContainer}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className={styles.heroContent}
          >
            <h1 className={styles.heroTitle}>
              Bavul ve Çanta Takibinde Dijital Dönem
              <br />
              <span className={styles.heroTitleAccent}>Online, Güvenli, Hızlı</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Rezervasyon, QR doğrulama, ödeme ve raporlama tek platformda. Operasyonunuzu profesyonelleştirin ve
              müşteri memnuniyetini artırın.
            </p>
            <div className={styles.heroStats}>
              <div className={styles.statItem}>
                <a href="#screenshots" className={styles.statLink}>
                  Aktif Otelleri Gör
                </a>
                <div className={styles.statLabel}>Gerçek kullanım örnekleri</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>50K+</div>
                <div className={styles.statLabel}>Rezervasyon/Ay</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>7/24</div>
                <div className={styles.statLabel}>Kesintisiz İzleme</div>
              </div>
            </div>
            <div className={styles.heroCTAs}>
              <button onClick={handleDemoRequest} className={styles.btnPrimaryLarge}>
                Demo Talep Et
                <ArrowRight className="h-5 w-5" />
              </button>
              <button onClick={handlePanelLogin} className={styles.btnSecondaryLarge}>
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
            <div className={styles.heroImageFrame}>
              <img
                src="/landing-examples/dashboard.png"
                alt="Kyradi Dashboard"
                className={styles.heroImage}
                loading="lazy"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className={styles.statsSection}>
        <div className={styles.container}>
          <div className={styles.statsIntro}>
            <h3>Operasyon Gücü, Anlık Görünürlük</h3>
            <p>Gerçek zamanlı verilerle operasyonunuzu ölçülebilir hale getirin.</p>
          </div>
          <div className={styles.statsGrid}>
            {[
              {
                icon: <Users className="h-6 w-6" />,
                value: "Aktif Otelleri Gör",
                label: "Gerçek kullanım örnekleri",
                note: "Platformda aktif otellerin canlı akışı",
                color: "#6366f1",
              },
              {
                icon: <Package className="h-6 w-6" />,
                value: "Yüksek Rezervasyon Hacmi",
                label: "Yoğun sezonda bile stabil",
                note: "Rezervasyon → teslim akışı dakikalar içinde",
                color: "#10b981",
              },
              {
                icon: <TrendingUp className="h-6 w-6" />,
                value: "7/24 Kesintisiz İzleme",
                label: "SLA ve performans takibi",
                note: "Anlık bildirimler ve operasyon raporları",
                color: "#f59e0b",
              },
              {
                icon: <CheckCircle2 className="h-6 w-6" />,
                value: "Üst Düzey Memnuniyet",
                label: "Misafir deneyimi odaklı",
                note: "Hızlı teslim, net kayıt, güvenli süreç",
                color: "#ef4444",
              },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={styles.statCard}
              >
                <div className={styles.statHeader}>
                  <div className={styles.statIcon} style={{ color: stat.color }}>
                    {stat.icon}
                  </div>
                  <span className={styles.statLabel}>{stat.label}</span>
                </div>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statNote}>{stat.note}</div>
              </motion.div>
            ))}
          </div>
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
                title: t("nav.reports"),
                description: t("landing.features.reportsDesc"),
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

      {/* Screenshots Section */}
      <section id="screenshots" className={styles.screenshots}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={styles.sectionHeader}
          >
            <h2 className={styles.sectionTitle}>Platform Önizleme</h2>
            <p className={styles.sectionSubtitle}>
              Modern, kullanıcı dostu arayüz ile operasyonlarınızı kolayca yönetin
            </p>
          </motion.div>

          <div className={styles.screenshotsGrid}>
            {[
              {
                title: "Dashboard & Genel Bakış",
                description: "Tüm önemli metriklerinizi tek ekranda görüntüleyin",
                features: ["Gelir istatistikleri", "Rezervasyon özeti", "Depo doluluk oranı", "Komisyon takibi"],
                image: imageSrc("dashboard.png"),
              },
              {
                title: "Rezervasyon Yönetimi",
                description: "Rezervasyonları kolayca oluşturun, görüntüleyin ve yönetin",
                features: ["Hızlı rezervasyon oluşturma", "Durum takibi", "Ödeme yönetimi", "Detaylı raporlar"],
                image: imageSrc("rezervasyon-yonetimi.png"),
              },
              {
                title: "QR Kod Doğrulama",
                description: "QR kod ile hızlı ve güvenli teslim alma/etme işlemleri",
                features: ["Anlık QR tarama", "Manuel kod girişi", "Teslim işlemleri", "Geçmiş kayıtları"],
                image: imageSrc("qr-sayfasi.png"),
              },
              {
                title: t("nav.reports"),
                description: t("landing.screenshots.reportsDesc"),
                features: [
                  t("landing.screenshots.reportsFeature1"),
                  t("landing.screenshots.reportsFeature2"),
                  t("landing.screenshots.reportsFeature3"),
                  t("landing.screenshots.reportsFeature4"),
                ],
                image: imageSrc("raporlar-analiz.png"),
              },
            ].map((screenshot, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={styles.screenshotCard}
              >
                <div className={styles.screenshotMock}>
                  <div className={styles.mockBrowser}>
                    <div className={styles.mockBrowserHeader}>
                      <div className={styles.mockBrowserDots}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <div className={styles.mockBrowserContent}>
                      <img
                        src={screenshot.image}
                        alt={screenshot.title}
                        className={styles.screenshotImage}
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.screenshotInfo}>
                  <h3 className={styles.screenshotTitle}>{screenshot.title}</h3>
                  <p className={styles.screenshotDescription}>{screenshot.description}</p>
                  <ul className={styles.screenshotFeatures}>
                    {screenshot.features.map((feature, fIndex) => (
                      <li key={fIndex}>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className={styles.benefits}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={styles.sectionHeader}
          >
            <h2 className={styles.sectionTitle}>Neden Kyradi?</h2>
            <p className={styles.sectionSubtitle}>
              Operasyonunuzu dijitalleştirin, verimliliği artırın, müşteri memnuniyetini yükseltin
            </p>
          </motion.div>

          <div className={styles.benefitsGrid}>
            {[
              {
                icon: <Zap className="h-6 w-6" />,
                title: "Hızlı Kurulum",
                description: "5 dakikada kurulum, hemen kullanmaya başlayın. Teknik bilgi gerektirmez.",
                color: "#f59e0b",
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: "Güvenli & KVKK Uyumlu",
                description: "Tüm veriler şifrelenir, KVKK uyumlu saklanır. Güvenliğiniz önceliğimiz.",
                color: "#10b981",
              },
              {
                icon: <Clock className="h-6 w-6" />,
                title: "7/24 Destek",
                description: "Her zaman yanınızdayız. E-posta, telefon ve canlı destek ile hızlı çözüm.",
                color: "#6366f1",
              },
              {
                icon: <TrendingUp className="h-6 w-6" />,
                title: "Sürekli Gelişim",
                description: "Düzenli güncellemeler ve yeni özellikler. Platform sürekli gelişiyor.",
                color: "#ef4444",
              },
              {
                icon: <Globe className="h-6 w-6" />,
                title: "Çoklu Dil Desteği",
                description: "Türkçe ve İngilizce dil desteği. Müşterileriniz kendi dilinde rezervasyon yapabilir.",
                color: "#8b5cf6",
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                title: "Detaylı Analiz",
                description: "Gelir, rezervasyon ve depo kullanım analizleri ile kararlarınızı veriye dayandırın.",
                color: "#06b6d4",
              },
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={styles.benefitCard}
              >
                <div className={styles.benefitIcon} style={{ background: `${benefit.color}15`, color: benefit.color }}>
                  {benefit.icon}
                </div>
                <h3 className={styles.benefitTitle}>{benefit.title}</h3>
                <p className={styles.benefitDescription}>{benefit.description}</p>
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

      {/* Contact Section */}
      <section id="contact" className={styles.contact}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={styles.sectionHeader}
          >
            <h2 className={styles.sectionTitle}>İletişime Geçin</h2>
            <p className={styles.sectionSubtitle}>
              Sorularınız mı var? Demo talep etmek mi istiyorsunuz? Bize ulaşın, size yardımcı olalım.
            </p>
          </motion.div>

          <div className={styles.contactGrid}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className={styles.contactInfo}
            >
              <h3 className={styles.contactInfoTitle}>Bize Ulaşın</h3>
              <p className={styles.contactInfoDescription}>
                Kyradi ekibi olarak size en iyi hizmeti sunmak için buradayız. Sorularınız, önerileriniz veya demo
                talepleriniz için bizimle iletişime geçebilirsiniz.
              </p>

              <div className={styles.contactMethods}>
                <a href="mailto:info@kyradi.com" className={styles.contactMethod}>
                  <div className={styles.contactMethodIcon}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={styles.contactMethodLabel}>E-posta</div>
                    <div className={styles.contactMethodValue}>info@kyradi.com</div>
                  </div>
                </a>
                <a href="tel:+905307745555" className={styles.contactMethod}>
                  <div className={styles.contactMethodIcon}>
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={styles.contactMethodLabel}>Telefon</div>
                    <div className={styles.contactMethodValue}>+90 530 774 55 55</div>
                  </div>
                </a>
                <div className={styles.contactMethod}>
                  <div className={styles.contactMethodIcon}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={styles.contactMethodLabel}>Çalışma Saatleri</div>
                    <div className={styles.contactMethodValue}>Pazartesi - Cuma: 09:00 - 18:00</div>
                  </div>
                </div>
              </div>

              <div className={styles.contactTrust}>
                <div className={styles.trustItem}>
                  <Shield className="h-5 w-5" />
                  <span>KVKK Uyumlu</span>
                </div>
                <div className={styles.trustItem}>
                  <Lock className="h-5 w-5" />
                  <span>Güvenli Veri</span>
                </div>
                <div className={styles.trustItem}>
                  <Eye className="h-5 w-5" />
                  <span>Şeffaf Fiyatlandırma</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className={styles.contactFormWrapper}
            >
              <form onSubmit={handleContactSubmit} className={styles.contactForm}>
                {contactSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={styles.contactSuccess}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Mesajınız gönderildi! En kısa sürede size dönüş yapacağız.</span>
                  </motion.div>
                )}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="contact-name">Ad Soyad *</label>
                    <input
                      type="text"
                      id="contact-name"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="Adınız ve soyadınız"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="contact-email">E-posta *</label>
                    <input
                      type="email"
                      id="contact-email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="ornek@email.com"
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="contact-phone">Telefon</label>
                    <input
                      type="tel"
                      id="contact-phone"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      placeholder="+90 530 774 55 55"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="contact-company">Şirket</label>
                    <input
                      type="text"
                      id="contact-company"
                      value={contactForm.company}
                      onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                      placeholder="Şirket adı"
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="contact-message">Mesajınız *</label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Mesajınızı buraya yazın..."
                  />
                </div>
                <button type="submit" className={styles.btnPrimary} disabled={contactSubmitting}>
                  {contactSubmitting ? (
                    <>
                      <Clock className="h-5 w-5" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Mesaj Gönder
                    </>
                  )}
                </button>
              </form>
            </motion.div>
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
              <button onClick={handlePanelLogin} className={styles.btnSecondaryLarge}>
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
              <img src="/kyradi_logo.png" alt="Kyradi" className={styles.footerLogo} />
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
                <button onClick={handlePanelLogin} className={styles.footerLink}>
                  Panel Girişi
                </button>
              </div>
              <div className={styles.footerColumn}>
                <h4 className={styles.footerTitle}>İletişim</h4>
                <a href="mailto:info@kyradi.com" className={styles.footerLink}>
                  info@kyradi.com
                </a>
                <a href="tel:+905307745555" className={styles.footerLink}>
                  +90 530 774 55 55
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
