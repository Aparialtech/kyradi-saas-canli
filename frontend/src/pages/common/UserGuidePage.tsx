import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Users,
  MapPin,
  Calendar,
  Settings,
  BarChart3,
  HelpCircle,
  CheckCircle2,
  Building2,
  HardDrive,
  ScanLine,
  MessageSquare,
  ChevronDown,
  UserCog,
  BadgePercent,
  Wallet,
  PiggyBank,
  Send,
  Receipt,
  TrendingUp,
} from "../../lib/lucide";
import { ModernCard } from "../../components/ui/ModernCard";
import { ModernButton } from "../../components/ui/ModernButton";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  steps: Array<{
    title: string;
    description: string;
    details?: string[];
  }>;
}

export function UserGuidePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Determine panel type from path
  const isAdmin = location.pathname.startsWith("/admin");

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const partnerSections: GuideSection[] = [
    {
      id: "overview",
      title: "Genel Bakış ve Dashboard",
      icon: <BarChart3 className="h-5 w-5" />,
      steps: [
        {
          title: "Dashboard'u Anlama",
          description: "Genel bakış sayfasında sisteminizin önemli metriklerini görüntüleyebilirsiniz.",
          details: [
            "Aktif rezervasyon sayısı ve doluluk oranını takip edin",
            "Günlük ve toplam gelir bilgilerinizi görüntüleyin",
            "Depo kullanım durumunuzu kontrol edin",
            "Komisyon özetlerinizi inceleyin",
          ],
        },
        {
          title: "Hızlı İşlemler",
          description: "Dashboard üzerinden hızlıca yaygın işlemleri gerçekleştirebilirsiniz.",
          details: [
            "Yeni rezervasyon oluşturma",
            "QR kod ile doğrulama",
            "Rapor görüntüleme",
            "Ayarlara erişim",
          ],
        },
      ],
    },
    {
      id: "reservations",
      title: "Rezervasyon Yönetimi",
      icon: <Calendar className="h-5 w-5" />,
      steps: [
        {
          title: "Yeni Rezervasyon Oluşturma",
          description: "Sistemde yeni bir bavul rezervasyonu nasıl oluşturulur?",
          details: [
            "Rezervasyonlar sayfasına gidin",
            "'Yeni Rezervasyon' butonuna tıklayın",
            "Misafir bilgilerini girin (ad, soyad, e-posta, telefon)",
            "Başlangıç ve bitiş tarihlerini seçin",
            "Bavul sayısını belirleyin",
            "Depo seçimi yapın (opsiyonel)",
            "Rezervasyonu kaydedin",
          ],
        },
        {
          title: "Rezervasyon Durumları",
          description: "Rezervasyon durumlarını anlama ve yönetme.",
          details: [
            "Rezerve: Rezervasyon oluşturuldu, henüz teslim alınmadı",
            "Aktif: Bavul teslim alındı, depoda",
            "Tamamlandı: Bavul teslim edildi, rezervasyon sonlandı",
            "İptal: Rezervasyon iptal edildi",
          ],
        },
        {
          title: "Rezervasyon İşlemleri",
          description: "Rezervasyonlar üzerinde yapabileceğiniz işlemler.",
          details: [
            "Rezervasyon detaylarını görüntüleme",
            "Rezervasyonu tamamlama",
            "Rezervasyonu iptal etme",
            "Ödeme bilgilerini görüntüleme",
            "Rezervasyon geçmişini inceleme",
          ],
        },
      ],
    },
    {
      id: "storage",
      title: "Depo Yönetimi",
      icon: <HardDrive className="h-5 w-5" />,
      steps: [
        {
          title: "Yeni Depo Ekleme",
          description: "Sisteminize yeni bir depo nasıl eklenir?",
          details: [
            "Depolar sayfasına gidin",
            "'Yeni Depo Ekle' butonuna tıklayın",
            "Depo adını girin (örn: 'Depo A', 'Ana Depo')",
            "Depo kapasitesini belirleyin (toplam bavul sayısı)",
            "Lokasyon bilgilerini ekleyin",
            "Depo durumunu ayarlayın (aktif/pasif)",
            "Kaydet butonuna tıklayın",
          ],
        },
        {
          title: "Depo Durumunu Takip Etme",
          description: "Depo doluluk oranını ve kullanım durumunu izleme.",
          details: [
            "Depolar sayfasında her depo için doluluk oranını görüntüleyin",
            "Aktif rezervasyon sayısını kontrol edin",
            "Boş depo sayısını takip edin",
            "Depo bazlı raporları inceleyin",
          ],
        },
        {
          title: "Depo Düzenleme ve Silme",
          description: "Mevcut depoları düzenleme veya silme işlemleri.",
          details: [
            "Depo listesinde düzenlemek istediğiniz depoya tıklayın",
            "Depo bilgilerini güncelleyin",
            "Değişiklikleri kaydedin",
            "Not: Aktif rezervasyonu olan depolar silinemez",
          ],
        },
      ],
    },
    {
      id: "locations",
      title: "Lokasyon Yönetimi",
      icon: <MapPin className="h-5 w-5" />,
      steps: [
        {
          title: "Yeni Lokasyon Ekleme",
          description: "Sisteminize yeni bir lokasyon nasıl eklenir?",
          details: [
            "Lokasyonlar sayfasına gidin",
            "'Yeni Lokasyon' butonuna tıklayın",
            "Lokasyon adını girin",
            "Google Maps üzerinden konum seçin",
            "Adres bilgileri otomatik doldurulacaktır",
            "Çalışma saatlerini belirleyin",
            "İletişim bilgilerini ekleyin",
            "Kaydet butonuna tıklayın",
          ],
        },
        {
          title: "Lokasyon Bilgilerini Güncelleme",
          description: "Mevcut lokasyon bilgilerini düzenleme.",
          details: [
            "Lokasyon listesinde düzenlemek istediğiniz lokasyona tıklayın",
            "Konum bilgilerini haritadan güncelleyin",
            "Çalışma saatlerini düzenleyin",
            "İletişim bilgilerini güncelleyin",
            "Değişiklikleri kaydedin",
          ],
        },
      ],
    },
    {
      id: "qr",
      title: "QR Kod Doğrulama",
      icon: <ScanLine className="h-5 w-5" />,
      steps: [
        {
          title: "QR Kod ile Teslim Alma",
          description: "Bavul teslim alma işlemini QR kod ile nasıl yapılır?",
          details: [
            "QR Doğrulama sayfasına gidin",
            "QR kodu tarayın veya manuel olarak girin",
            "Rezervasyon bilgileri görüntülenecektir",
            "'Teslim Al' butonuna tıklayın",
            "Bavul sayısını ve notları ekleyin",
            "İşlemi onaylayın",
          ],
        },
        {
          title: "QR Kod ile Teslim Etme",
          description: "Bavul teslim etme işlemini QR kod ile nasıl yapılır?",
          details: [
            "QR Doğrulama sayfasına gidin",
            "QR kodu tarayın veya manuel olarak girin",
            "Rezervasyon bilgileri görüntülenecektir",
            "'Teslim Et' butonuna tıklayın",
            "Teslim bilgilerini kontrol edin",
            "İşlemi onaylayın",
          ],
        },
      ],
    },
    {
      id: "users",
      title: "Kullanıcı Yönetimi",
      icon: <Users className="h-5 w-5" />,
      steps: [
        {
          title: "Yeni Kullanıcı Ekleme",
          description: "Sisteminize yeni bir kullanıcı nasıl eklenir?",
          details: [
            "Kullanıcılar sayfasına gidin",
            "'Yeni Kullanıcı' butonuna tıklayın",
            "Kişisel bilgileri girin (ad, soyad, e-posta, telefon)",
            "Kullanıcı rolünü seçin (Yönetici, Personel, vb.)",
            "Şifre belirleyin",
            "Kullanıcıyı kaydedin",
          ],
        },
        {
          title: "Kullanıcı Rolleri",
          description: "Farklı kullanıcı rolleri ve yetkileri.",
          details: [
            "Yönetici: Tüm yetkilere sahip",
            "Otel Müdürü: Rezervasyon ve depo yönetimi",
            "Personel: Rezervasyon işlemleri",
            "Depo Operatörü: Depo ve QR doğrulama işlemleri",
            "Muhasebe: Rapor ve gelir görüntüleme",
            "Görüntüleyici: Sadece okuma yetkisi",
          ],
        },
      ],
    },
    {
      id: "reports",
      title: "Raporlar ve Analiz",
      icon: <FileText className="h-5 w-5" />,
      steps: [
        {
          title: "Rapor Görüntüleme",
          description: "Sistemdeki raporları nasıl görüntüleyebilirsiniz?",
          details: [
            "Raporlar ve Analiz sayfasına gidin",
            "Tarih aralığı seçin",
            "Rapor türünü seçin (Gelir, Rezervasyon, Depo Kullanımı)",
            "Raporu görüntüleyin",
            "İsterseniz raporu dışa aktarın (CSV, Excel)",
          ],
        },
        {
          title: "Gelir Raporları",
          description: "Gelir raporlarını anlama ve kullanma.",
          details: [
            "Toplam gelir bilgilerini görüntüleyin",
            "Tarih bazlı gelir analizlerini inceleyin",
            "Ödeme yöntemlerine göre gelir dağılımını görün",
            "Komisyon özetlerini kontrol edin",
          ],
        },
      ],
    },
    {
      id: "staff",
      title: "Çalışan Yönetimi",
      icon: <UserCog className="h-5 w-5" />,
      steps: [
        {
          title: "Yeni Çalışan Ekleme",
          description: "Sisteminize yeni bir çalışan nasıl eklenir?",
          details: [
            "Çalışanlar sayfasına gidin",
            "'Yeni Çalışan' butonuna tıklayın",
            "Çalışan bilgilerini girin (ad, soyad, e-posta, telefon)",
            "Çalışan rolünü seçin",
            "Çalışanı bir depoya atayın (opsiyonel)",
            "Çalışanı kaydedin",
          ],
        },
        {
          title: "Çalışan Atama",
          description: "Çalışanları depolara nasıl atarsınız?",
          details: [
            "Çalışanlar sayfasında 'Atama' butonuna tıklayın",
            "Çalışanı seçin",
            "Atanacak depoyu seçin",
            "Atamayı kaydedin",
          ],
        },
        {
          title: "Çalışan Düzenleme",
          description: "Mevcut çalışan bilgilerini güncelleme.",
          details: [
            "Çalışanlar listesinde düzenlemek istediğiniz çalışana tıklayın",
            "Çalışan bilgilerini güncelleyin",
            "Değişiklikleri kaydedin",
          ],
        },
      ],
    },
    {
      id: "pricing",
      title: "Ücretlendirme Yönetimi",
      icon: <BadgePercent className="h-5 w-5" />,
      steps: [
        {
          title: "Yeni Fiyat Planı Oluşturma",
          description: "Sisteminize yeni bir fiyat planı nasıl eklenir?",
          details: [
            "Ücretlendirme sayfasına gidin",
            "'Yeni Fiyat Planı' butonuna tıklayın",
            "Plan adını girin",
            "Başlangıç ve bitiş tarihlerini belirleyin",
            "Bavul sayısına göre fiyatları girin",
            "Fiyat planını kaydedin",
          ],
        },
        {
          title: "Fiyat Planı Düzenleme",
          description: "Mevcut fiyat planlarını güncelleme.",
          details: [
            "Ücretlendirme sayfasında düzenlemek istediğiniz plana tıklayın",
            "Fiyat bilgilerini güncelleyin",
            "Tarih aralığını değiştirin",
            "Değişiklikleri kaydedin",
          ],
        },
      ],
    },
    {
      id: "revenue",
      title: "Gelir Yönetimi",
      icon: <Wallet className="h-5 w-5" />,
      steps: [
        {
          title: "Gelir Görüntüleme",
          description: "Sisteminizdeki gelir bilgilerini nasıl görüntüleyebilirsiniz?",
          details: [
            "Gelir sayfasına gidin",
            "Tarih aralığı seçin",
            "Toplam gelir bilgilerini görüntüleyin",
            "Günlük, haftalık ve aylık gelir grafiklerini inceleyin",
            "Ödeme yöntemlerine göre gelir dağılımını görün",
          ],
        },
        {
          title: "Gelir Raporları",
          description: "Detaylı gelir raporlarını görüntüleme.",
          details: [
            "Gelir sayfasında rapor bölümüne gidin",
            "Filtreleme seçeneklerini kullanın",
            "Raporu CSV veya Excel formatında dışa aktarın",
          ],
        },
      ],
    },
    {
      id: "settlements",
      title: "Hakediş Yönetimi",
      icon: <PiggyBank className="h-5 w-5" />,
      steps: [
        {
          title: "Hakediş Görüntüleme",
          description: "Hakediş bilgilerini nasıl görüntüleyebilirsiniz?",
          details: [
            "Hakedişler sayfasına gidin",
            "Tarih aralığı seçin",
            "Hakediş listesini görüntüleyin",
            "Hakediş detaylarını inceleyin",
          ],
        },
        {
          title: "Hakediş Durumları",
          description: "Hakediş durumlarını anlama.",
          details: [
            "Beklemede: Henüz ödenmemiş hakedişler",
            "Tamamlandı: Ödenmiş hakedişler",
            "İptal: İptal edilmiş hakedişler",
          ],
        },
      ],
    },
    {
      id: "transfers",
      title: "Komisyon Ödemeleri",
      icon: <Send className="h-5 w-5" />,
      steps: [
        {
          title: "Komisyon Ödemelerini Görüntüleme",
          description: "Komisyon ödeme bilgilerini nasıl görüntüleyebilirsiniz?",
          details: [
            "Komisyon Ödemeleri sayfasına gidin",
            "Bekleyen ve tamamlanan ödemeleri görüntüleyin",
            "Ödeme detaylarını inceleyin",
            "Ödeme geçmişini kontrol edin",
          ],
        },
        {
          title: "Komisyon Hesaplama",
          description: "Komisyonların nasıl hesaplandığını anlama.",
          details: [
            "Komisyon oranı planınıza göre belirlenir",
            "Her rezervasyon için komisyon otomatik hesaplanır",
            "Komisyonlar belirli dönemlerde ödenir",
            "Ödeme durumunu takip edebilirsiniz",
          ],
        },
      ],
    },
    {
      id: "tickets",
      title: "İletişim / Ticket Sistemi",
      icon: <MessageSquare className="h-5 w-5" />,
      steps: [
        {
          title: "Yeni Ticket Oluşturma",
          description: "Destek talebi nasıl oluşturulur?",
          details: [
            "İletişim sayfasına gidin",
            "'Yeni Ticket' butonuna tıklayın",
            "Konu başlığını girin",
            "Mesajınızı yazın",
            "Ticket'ı gönderin",
          ],
        },
        {
          title: "Ticket Yönetimi",
          description: "Ticket'ları nasıl yönetebilirsiniz?",
          details: [
            "Gelen ve giden ticket'ları görüntüleyin",
            "Ticket detaylarını inceleyin",
            "Yanıt gönderin",
            "Ticket durumunu takip edin",
          ],
        },
      ],
    },
    {
      id: "demo-flow",
      title: "Online Rezervasyon (Demo Flow)",
      icon: <Calendar className="h-5 w-5" />,
      steps: [
        {
          title: "Online Rezervasyon Oluşturma",
          description: "Müşterilerin kendi rezervasyonlarını nasıl oluşturabileceğini anlama.",
          details: [
            "Online Rezervasyon sayfasına gidin",
            "Misafir bilgilerini girin",
            "Tarih aralığını seçin",
            "Bavul sayısını belirleyin",
            "KVKK ve kullanım şartlarını onaylayın",
            "Rezervasyonu gönderin",
          ],
        },
        {
          title: "Widget Entegrasyonu",
          description: "Rezervasyon widget'ını web sitenize nasıl entegre edersiniz?",
          details: [
            "Widget kodunu alın",
            "Web sitenize widget kodunu ekleyin",
            "Müşterileriniz artık doğrudan web sitenizden rezervasyon yapabilir",
          ],
        },
      ],
    },
    {
      id: "settings",
      title: "Sistem Ayarları",
      icon: <Settings className="h-5 w-5" />,
      steps: [
        {
          title: "Genel Ayarlar",
          description: "Sistem genel ayarlarını yönetme.",
          details: [
            "Ayarlar sayfasına gidin",
            "Otel bilgilerini güncelleyin",
            "İletişim bilgilerini düzenleyin",
            "Logo ve marka renklerini ayarlayın",
            "Değişiklikleri kaydedin",
          ],
        },
        {
          title: "Ücretlendirme Ayarları",
          description: "Rezervasyon ücretlerini yönetme.",
          details: [
            "Ücretlendirme sayfasına gidin",
            "Yeni fiyat planı oluşturun",
            "Tarih aralığı ve bavul sayısına göre fiyat belirleyin",
            "Fiyat planlarını düzenleyin veya silin",
          ],
        },
      ],
    },
  ];

  const adminSections: GuideSection[] = [
    {
      id: "overview",
      title: "Admin Dashboard",
      icon: <BarChart3 className="h-5 w-5" />,
      steps: [
        {
          title: "Genel Bakış",
          description: "Admin panelinde sistemin genel durumunu görüntüleyebilirsiniz.",
          details: [
            "Toplam otel sayısını görüntüleyin",
            "Sistem geneli rezervasyon istatistiklerini inceleyin",
            "Toplam gelir ve komisyon bilgilerini kontrol edin",
            "Bekleyen transferleri görüntüleyin",
          ],
        },
      ],
    },
    {
      id: "tenants",
      title: "Otel Yönetimi",
      icon: <Building2 className="h-5 w-5" />,
      steps: [
        {
          title: "Yeni Otel Ekleme",
          description: "Sistemde yeni bir otel/tenant nasıl eklenir?",
          details: [
            "Oteller sayfasına gidin",
            "'Yeni Otel' butonuna tıklayın",
            "Otel adını ve yasal adını girin",
            "Google Maps üzerinden konum seçin",
            "İletişim bilgilerini ekleyin (e-posta, telefon, web sitesi)",
            "Çalışma saatlerini belirleyin",
            "Plan türünü seçin",
            "Otel bilgilerini kaydedin",
          ],
        },
        {
          title: "Otel Düzenleme",
          description: "Mevcut otel bilgilerini güncelleme.",
          details: [
            "Oteller listesinde düzenlemek istediğiniz otele tıklayın",
            "Otel detay sayfasına yönlendirileceksiniz",
            "Tüm bilgileri güncelleyebilirsiniz",
            "Konum bilgilerini haritadan değiştirebilirsiniz",
            "Değişiklikleri kaydedin",
          ],
        },
        {
          title: "Otel Kota Ayarları",
          description: "Otel plan limitlerini yönetme.",
          details: [
            "Oteller listesinde kota ikonuna tıklayın",
            "Maksimum rezervasyon sayısını ayarlayın",
            "Depo kapasitesini belirleyin",
            "Self-service rezervasyon limitini ayarlayın",
            "Ayarları kaydedin",
          ],
        },
      ],
    },
    {
      id: "users",
      title: "Kullanıcı Yönetimi",
      icon: <Users className="h-5 w-5" />,
      steps: [
        {
          title: "Yeni Kullanıcı Oluşturma",
          description: "Sistem genelinde yeni kullanıcı nasıl oluşturulur?",
          details: [
            "Kullanıcılar sayfasına gidin",
            "'Yeni Kullanıcı' butonuna tıklayın",
            "Kişisel bilgileri girin (TC Kimlik, doğum tarihi, ad, soyad)",
            "İletişim bilgilerini ekleyin (e-posta, telefon)",
            "Kullanıcı rolünü seçin",
            "Şifre belirleyin",
            "Kullanıcıyı kaydedin",
          ],
        },
      ],
    },
    {
      id: "reports",
      title: "Raporlar ve Analiz",
      icon: <FileText className="h-5 w-5" />,
      steps: [
        {
          title: "Sistem Geneli Raporlar",
          description: "Tüm otellerin raporlarını görüntüleme.",
          details: [
            "Raporlar ve Analiz sayfasına gidin",
            "Otel bazlı filtreleme yapın",
            "Tarih aralığı seçin",
            "Gelir ve rezervasyon raporlarını inceleyin",
            "Raporları dışa aktarın",
          ],
        },
        {
          title: "Komisyon Raporları",
          description: "Otel komisyonlarını görüntüleme ve yönetme.",
          details: [
            "Komisyon özetlerini görüntüleyin",
            "Bekleyen komisyonları kontrol edin",
            "Komisyon faturalarını oluşturun",
            "Transfer işlemlerini yönetin",
          ],
        },
      ],
    },
    {
      id: "settlements",
      title: "Hakediş Yönetimi",
      icon: <PiggyBank className="h-5 w-5" />,
      steps: [
        {
          title: "Hakediş Görüntüleme",
          description: "Sistem geneli hakediş bilgilerini görüntüleme.",
          details: [
            "Hakedişler sayfasına gidin",
            "Otel bazlı filtreleme yapın",
            "Tarih aralığı seçin",
            "Hakediş listesini görüntüleyin",
            "Hakediş detaylarını inceleyin",
          ],
        },
        {
          title: "Hakediş Durumları",
          description: "Hakediş durumlarını anlama.",
          details: [
            "Beklemede: Henüz ödenmemiş hakedişler",
            "Tamamlandı: Ödenmiş hakedişler",
            "İptal: İptal edilmiş hakedişler",
          ],
        },
      ],
    },
    {
      id: "transfers",
      title: "Transferler (MagicPay)",
      icon: <Send className="h-5 w-5" />,
      steps: [
        {
          title: "Transfer İşlemleri",
          description: "Otel komisyonlarını transfer etme.",
          details: [
            "Transferler sayfasına gidin",
            "Bekleyen transferleri görüntüleyin",
            "Transfer işlemini onaylayın",
            "Transfer geçmişini inceleyin",
          ],
        },
        {
          title: "MagicPay Entegrasyonu",
          description: "MagicPay ile ödeme işlemleri.",
          details: [
            "Transfer işlemleri MagicPay üzerinden yapılır",
            "Transfer durumunu takip edebilirsiniz",
            "Ödeme geçmişini görüntüleyebilirsiniz",
          ],
        },
      ],
    },
    {
      id: "invoice",
      title: "Fatura Oluşturma",
      icon: <Receipt className="h-5 w-5" />,
      steps: [
        {
          title: "Fatura Oluşturma",
          description: "Sistem geneli fatura nasıl oluşturulur?",
          details: [
            "Fatura Oluştur sayfasına gidin",
            "Fatura türünü seçin (Komisyon, Gelir, vb.)",
            "Otel ve tarih aralığını belirleyin",
            "Fatura detaylarını kontrol edin",
            "Faturayı oluşturun ve indirin",
          ],
        },
      ],
    },
    {
      id: "revenue",
      title: "Sistem Geneli Gelir",
      icon: <TrendingUp className="h-5 w-5" />,
      steps: [
        {
          title: "Gelir Görüntüleme",
          description: "Tüm otellerin gelir bilgilerini görüntüleme.",
          details: [
            "Gelir sayfasına gidin",
            "Otel bazlı filtreleme yapın",
            "Tarih aralığı seçin",
            "Toplam gelir bilgilerini görüntüleyin",
            "Gelir raporlarını dışa aktarın",
          ],
        },
      ],
    },
    {
      id: "tickets",
      title: "İletişim / Ticket Yönetimi",
      icon: <MessageSquare className="h-5 w-5" />,
      steps: [
        {
          title: "Ticket Görüntüleme",
          description: "Sistem geneli ticket'ları görüntüleme.",
          details: [
            "İletişim / Ticket sayfasına gidin",
            "Gelen ve giden ticket'ları görüntüleyin",
            "Ticket detaylarını inceleyin",
            "Yanıt gönderin",
          ],
        },
      ],
    },
    {
      id: "settings",
      title: "Sistem Ayarları",
      icon: <Settings className="h-5 w-5" />,
      steps: [
        {
          title: "Genel Sistem Ayarları",
          description: "Sistem genel ayarlarını yönetme.",
          details: [
            "Sistem Ayarları sayfasına gidin",
            "Sistem genel bilgilerini güncelleyin",
            "Email ve SMS ayarlarını yapılandırın",
            "Değişiklikleri kaydedin",
          ],
        },
      ],
    },
    {
      id: "audit",
      title: "Audit Log (Denetim Kayıtları)",
      icon: <FileText className="h-5 w-5" />,
      steps: [
        {
          title: "Audit Log Görüntüleme",
          description: "Sistem aktivitelerini nasıl görüntüleyebilirsiniz?",
          details: [
            "Audit Log sayfasına gidin",
            "Tarih aralığı seçin",
            "Kullanıcı veya işlem tipine göre filtreleyin",
            "Sistem aktivitelerini inceleyin",
            "Log detaylarını görüntüleyin",
          ],
        },
      ],
    },
  ];

  const sections = isAdmin ? adminSections : partnerSections;

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <ModernButton
          variant="ghost"
          onClick={() => navigate(isAdmin ? "/admin" : "/app")}
          style={{ marginBottom: "var(--space-4)" }}
        >
          <ArrowLeft className="h-4 w-4" style={{ marginRight: "var(--space-2)", display: "inline-block" }} />
          Geri Dön
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
            <FileText className="h-6 w-6" style={{ color: "white" }} />
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
              Nasıl Kullanılır?
            </h1>
            <p style={{ fontSize: "var(--text-base)", color: "var(--text-tertiary)", margin: "var(--space-1) 0 0" }}>
              {isAdmin
                ? "Kyradi Admin Panel Kullanım Kılavuzu"
                : "Kyradi Partner Panel Kullanım Kılavuzu"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Introduction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: "var(--space-8)" }}
      >
        <ModernCard variant="glass" padding="lg">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
            <HelpCircle className="h-6 w-6" style={{ color: "var(--primary)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", margin: "0 0 var(--space-2) 0" }}>
                Hoş Geldiniz!
              </h2>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                {isAdmin
                  ? "Bu kılavuz, Kyradi Admin Panel'inin tüm özelliklerini ve nasıl kullanılacağını adım adım açıklar. Otel yönetimi, kullanıcı yönetimi, raporlar ve sistem ayarları hakkında detaylı bilgiler bulabilirsiniz."
                  : "Bu kılavuz, Kyradi Partner Panel'inin tüm özelliklerini ve nasıl kullanılacağını adım adım açıklar. Rezervasyon yönetimi, depo yönetimi, raporlar ve sistem ayarları hakkında detaylı bilgiler bulabilirsiniz."}
              </p>
            </div>
          </div>
        </ModernCard>
      </motion.div>

      {/* Guide Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {sections.map((section, sectionIndex) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + sectionIndex * 0.1 }}
          >
            <ModernCard variant="glass" padding="lg">
              <div
                onClick={() => toggleSection(section.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    flexShrink: 0,
                  }}
                >
                  {section.icon}
                </div>
                <h2
                  style={{
                    fontSize: "var(--text-xl)",
                    fontWeight: "var(--font-bold)",
                    color: "var(--text-primary)",
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {section.title}
                </h2>
                <ChevronDown 
                  className="h-5 w-5" 
                  style={{ 
                    color: "var(--text-tertiary)", 
                    flexShrink: 0,
                    transform: expandedSections.has(section.id) ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.3s ease"
                  }} 
                />
              </div>

              <AnimatePresence>
                {expandedSections.has(section.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", marginTop: "var(--space-6)" }}>
                      {section.steps.map((step, stepIndex) => (
                        <div key={stepIndex} style={{ paddingLeft: "var(--space-4)", borderLeft: "2px solid var(--border-primary)" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                            <CheckCircle2 className="h-5 w-5" style={{ color: "var(--primary)", flexShrink: 0, marginTop: "2px" }} />
                            <div style={{ flex: 1 }}>
                              <h3
                                style={{
                                  fontSize: "var(--text-lg)",
                                  fontWeight: "var(--font-semibold)",
                                  color: "var(--text-primary)",
                                  margin: "0 0 var(--space-2) 0",
                                }}
                              >
                                {step.title}
                              </h3>
                              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 var(--space-3) 0" }}>
                                {step.description}
                              </p>
                              {step.details && step.details.length > 0 && (
                                <ul
                                  style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "var(--space-2)",
                                  }}
                                >
                                  {step.details.map((detail, detailIndex) => (
                                    <li
                                      key={detailIndex}
                                      style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: "var(--space-2)",
                                        color: "var(--text-secondary)",
                                        fontSize: "var(--text-sm)",
                                        lineHeight: 1.6,
                                      }}
                                    >
                                      <span style={{ color: "var(--primary)", marginRight: "var(--space-1)" }}>•</span>
                                      <span>{detail}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </ModernCard>
          </motion.div>
        ))}
      </div>

      {/* Footer Help */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ marginTop: "var(--space-8)" }}
      >
        <ModernCard variant="glass" padding="lg">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
            <MessageSquare className="h-6 w-6" style={{ color: "var(--primary)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", margin: "0 0 var(--space-2) 0" }}>
                Daha Fazla Yardıma İhtiyacınız mı Var?
              </h3>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Ek yardım için destek ekibimizle iletişime geçebilir veya sağ alt köşedeki chatbot'u kullanabilirsiniz.
              </p>
            </div>
          </div>
        </ModernCard>
      </motion.div>
    </div>
  );
}
