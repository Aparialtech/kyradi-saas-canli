import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, CheckCircle2 } from "../../lib/lucide";

import { env } from "../../config/env";
import { partnerWidgetService } from "../../services/partner/widgetConfig";
import { demoService, type Storage } from "../../services/partner/demo";
import { magicpayService } from "../../services/partner/magicpay";
import { locationService } from "../../services/partner/locations";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/common/ToastContainer";
import { getErrorMessage } from "../../lib/httpError";
import { useTranslation } from "../../hooks/useTranslation";

declare global {
  interface Window {
    KyradiReserve?: {
      config: Record<string, string>;
      mount: () => void;
    };
  }
}

export function DemoFlowPage() {
  const { messages, push } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useTranslation();
  const [lastReservationId, setLastReservationId] = useState<number | null>(null);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [convertedReservationId, setConvertedReservationId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [currentStep, setCurrentStep] = useState<"form" | "conversion" | "payment" | "complete">("form");
  const [magicpayCheckoutUrl, setMagicpayCheckoutUrl] = useState<string | null>(null);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [widgetReservationDates, setWidgetReservationDates] = useState<{ checkin_date?: string; checkout_date?: string } | null>(null);

  const tenantQuery = useQuery({
    queryKey: ["partner", "widget-config"],
    queryFn: () => partnerWidgetService.getWidgetConfig(),
  });

  // simulatePaymentMutation removed - using MagicPay flow instead

  const convertReservationMutation = useMutation({
    mutationFn: ({ widgetReservationId, storageId }: { widgetReservationId: number; storageId?: string }) =>
      demoService.convertWidgetReservation(widgetReservationId, storageId),
    onSuccess: (data) => {
      setConvertedReservationId(data.reservation_id);
      setShowStorageModal(false);
      setSelectedStorageId(null);
      push({
        title: t("demo.flow.conversionSuccess"),
        description: t("demo.flow.conversionSuccessDesc", {
          reservationId: data.reservation_id,
          storageId: data.storage_id,
        }),
        type: "success",
      });

      // Create MagicPay checkout session if payment required
      if (paymentRequired) {
        setCurrentStep("payment");
        createCheckoutSessionMutation.mutate(data.reservation_id);
      } else {
        // No payment required, mark as complete
        setCurrentStep("complete");
      }
    },
    onError: (error) => {
      push({
        title: t("demo.flow.conversionError"),
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  const createCheckoutSessionMutation = useMutation({
    mutationFn: (reservationId: string) => magicpayService.createCheckoutSession(reservationId),
    onSuccess: (data) => {
      setMagicpayCheckoutUrl(data.checkout_url);
      setPaymentAmount(data.amount_minor);
      push({
        title: "MagicPay Ödeme Hazır",
        description: "MagicPay ile ödemeye yönlendiriliyorsunuz...",
        type: "success",
      });
      // Redirect to MagicPay demo page
      setTimeout(() => {
        window.location.href = data.checkout_url;
      }, 1000);
    },
    onError: (error) => {
      push({
        title: "Ödeme Oturumu Oluşturulamadı",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  useEffect(() => {
    if (tenantQuery.isLoading) return;
    if (tenantQuery.isError) {
      push({
        title: t("demo.flow.widgetError"),
        description: getErrorMessage(tenantQuery.error) || "Widget yapılandırması yüklenemedi. Lütfen sayfayı yenileyin.",
        type: "error",
      });
      return;
    }
    if (!tenantQuery.data || !containerRef.current) {
      push({
        title: t("demo.flow.widgetError"),
        description: "Demo widget yapılandırması bulunamadı. Lütfen sistem yöneticisiyle iletişime geçin.",
        type: "error",
      });
      return;
    }
    const { tenant_id, widget_public_key } = tenantQuery.data;
    const cdnBase = env.PUBLIC_CDN_BASE || window.location.origin;

    const container = containerRef.current;
    container.innerHTML = "";

    // Listen for widget success events via custom event
    const handleWidgetSuccess = (event: CustomEvent) => {
      const data = event.detail;
      setLastReservationId(data.id);
      setPaymentRequired(data.payment_required || false);
      setCurrentStep("conversion");
      // Store dates for storage selection (prefer datetime, fallback to date)
      if (data.start_datetime && data.end_datetime) {
        // Convert ISO datetime to date strings for storage selection modal
        const startDate = new Date(data.start_datetime).toISOString().split('T')[0];
        const endDate = new Date(data.end_datetime).toISOString().split('T')[0];
        setWidgetReservationDates({
          checkin_date: startDate,
          checkout_date: endDate,
        });
      } else if (data.checkin_date && data.checkout_date) {
        // Legacy compatibility
        setWidgetReservationDates({
          checkin_date: data.checkin_date,
          checkout_date: data.checkout_date,
        });
      }
      push({
        title: t("demo.flow.reservationCreated"),
        description: t("demo.flow.reservationCreatedDesc", { id: data.id }),
        type: "success",
      });
      // Don't auto-convert - show storage selection modal instead
    };

    // Check if script already exists in DOM
    const existingScript = document.querySelector(`script[src="${cdnBase}/widgets/kyradi-reserve.js"]`);
    let scriptEl: HTMLScriptElement;
    
    // Check if CSS already exists
    const existingCSS = document.querySelector(`link[href="${cdnBase}/widgets/styles.css"]`);
    if (!existingCSS) {
      const linkEl = document.createElement("link");
      linkEl.rel = "stylesheet";
      linkEl.href = `${cdnBase}/widgets/styles.css`;
      document.head.appendChild(linkEl);
    }
    
    if (existingScript) {
      scriptEl = existingScript as HTMLScriptElement;
    } else {
      scriptEl = document.createElement("script");
      scriptEl.src = `${cdnBase}/widgets/kyradi-reserve.js`;
      scriptEl.defer = true;
      scriptEl.dataset.apiBase = env.API_URL;
      scriptEl.dataset.tenantId = tenant_id;
      scriptEl.dataset.widgetKey = widget_public_key;
      scriptEl.dataset.locale = locale;
      scriptEl.dataset.theme = "light";
      scriptEl.dataset.paymentProvider = "fake";
      document.head.appendChild(scriptEl);
    }

    const initializeWidget = () => {
      console.log("[DemoFlow] Initializing widget...");
      // Mount custom element definition
      if (window.KyradiReserve) {
        console.log("[DemoFlow] KyradiReserve found, mounting...");
        window.KyradiReserve.mount();
      } else {
        console.warn("[DemoFlow] KyradiReserve not found on window object");
      }

      // Wait for custom element to be defined, then create widget element
      let attempts = 0;
      const maxAttempts = 100; // 5 seconds max wait
      const checkAndCreate = () => {
        attempts++;
        if (customElements.get("kyradi-reserve")) {
          console.log("[DemoFlow] Custom element 'kyradi-reserve' is defined");
          // Remove any existing widget elements to prevent duplicates
          const existingWidgets = container.querySelectorAll("kyradi-reserve");
          existingWidgets.forEach((el) => el.remove());
          
          // Also remove any existing forms that might be rendered
          const existingForms = container.querySelectorAll("form");
          existingForms.forEach((el) => {
            if (el.closest(".kyradi-reserve")) {
              el.closest(".kyradi-reserve")?.remove();
            }
          });
          
          // Now create and append widget element (connectedCallback will be called)
          const widgetEl = document.createElement("kyradi-reserve");
          console.log("[DemoFlow] Created widget element:", widgetEl);
          // Set data attributes for widget initialization
          widgetEl.setAttribute("data-api-base", env.API_URL);
          widgetEl.setAttribute("data-tenant-id", tenant_id);
          widgetEl.setAttribute("data-widget-key", widget_public_key);
          widgetEl.setAttribute("data-locale", locale);
          widgetEl.setAttribute("data-theme", "light");
          widgetEl.setAttribute("data-payment-provider", "fake");
          container.appendChild(widgetEl);
          console.log("[DemoFlow] Widget element appended to container");
          
          // Attach event listener
          widgetEl.addEventListener("kyradi-reservation-success", handleWidgetSuccess as EventListener);
        } else if (attempts < maxAttempts) {
          setTimeout(checkAndCreate, 50);
        } else {
          console.error("[DemoFlow] Custom element 'kyradi-reserve' not defined after", maxAttempts, "attempts");
          push({
            title: t("demo.flow.widgetError"),
            description: "Widget yüklenemedi. Lütfen sayfayı yenileyin.",
            type: "error",
          });
        }
      };

      setTimeout(checkAndCreate, 50);
    };

    if (existingScript && window.KyradiReserve) {
      // Script already loaded, initialize immediately
      console.log("[DemoFlow] Script already loaded, initializing immediately");
      initializeWidget();
    } else {
      // Wait for script to load
      console.log("[DemoFlow] Waiting for script to load:", scriptEl.src);
      scriptEl.onload = () => {
        console.log("[DemoFlow] Script loaded successfully");
        initializeWidget();
      };
      scriptEl.onerror = () => {
        console.error("[DemoFlow] Failed to load widget script:", scriptEl.src);
        push({
          title: t("demo.flow.widgetError"),
          description: `Script yüklenemedi: ${scriptEl.src}. Lütfen widget dosyasının public/widgets/ klasöründe olduğundan emin olun.`,
          type: "error",
        });
      };
    }

    // Cleanup on unmount
    return () => {
      const widgetEl = container.querySelector("kyradi-reserve");
      if (widgetEl) {
        widgetEl.removeEventListener("kyradi-reservation-success", handleWidgetSuccess as EventListener);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantQuery.data?.tenant_id, tenantQuery.data?.widget_public_key, tenantQuery.isLoading, tenantQuery.isError, locale, push, t]); // Use specific fields instead of entire data object to avoid infinite loops

  // handlePayment removed - using MagicPay flow instead

  const handleConvertReservation = () => {
    if (!lastReservationId) {
      push({
        title: t("demo.flow.noReservation"),
        type: "error",
      });
      return;
    }
    // Show storage selection modal instead of auto-converting
    setShowStorageModal(true);
  };

  const getStepStatus = (step: string) => {
    if (step === "form") {
      return currentStep === "form" ? "active" : lastReservationId ? "completed" : "pending";
    }
    if (step === "conversion") {
      if (currentStep === "conversion") return "active";
      if (convertedReservationId) return "completed";
      if (lastReservationId && !paymentRequired) return "active";
      return "pending";
    }
    if (step === "payment") {
      if (currentStep === "payment") return "active";
      if (currentStep === "complete") return "completed";
      return "pending";
    }
    return "pending";
  };

  return (
    <section className="page" style={{ paddingBottom: "2rem" }}>
      <ToastContainer messages={messages} />
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("onlineReservationForm.title")}</h1>
          <p className="page-subtitle">{t("onlineReservationForm.subtitle")}</p>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="panel" style={{ marginBottom: "2rem", padding: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          {[
            { key: "form", label: t("demo.flow.step1Title"), shortLabel: "Rezervasyon" },
            { key: "conversion", label: t("demo.flow.step2Title"), shortLabel: "Depo & Ödeme" },
            { key: "payment", label: t("demo.flow.payment.title"), shortLabel: "Ödeme" },
          ].map((step, index) => {
            const status = getStepStatus(step.key);
            return (
              <div
                key={step.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                }}
                className="demo-step"
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    minWidth: "44px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "1rem",
                    backgroundColor:
                      status === "completed"
                        ? "#16a34a"
                        : status === "active"
                          ? "#2563eb"
                          : "#e2e8f0",
                    color: status === "pending" ? "#64748b" : "#fff",
                    boxShadow: status === "active" ? "0 4px 12px rgba(37, 99, 235, 0.3)" : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  {status === "completed" ? "✓" : index + 1}
                </div>
                <div style={{ marginLeft: "0.75rem", minWidth: 0, flex: "0 1 auto" }}>
                  <div
                    style={{
                      fontWeight: status === "active" ? 600 : 500,
                      fontSize: "0.8rem",
                      color: status === "active" ? "#2563eb" : status === "pending" ? "#94a3b8" : "#0f172a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Adım {index + 1}
                  </div>
                  <div
                    style={{
                      fontWeight: status === "active" ? 600 : 400,
                      fontSize: "0.85rem",
                      color: status === "pending" ? "#94a3b8" : "#475569",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "140px",
                    }}
                    title={step.label}
                  >
                    {step.shortLabel}
                  </div>
                </div>
                {index < 2 && (
                  <div
                    style={{
                      flex: 1,
                      height: "3px",
                      backgroundColor: status === "completed" ? "#16a34a" : "#e2e8f0",
                      margin: "0 1rem",
                      borderRadius: "2px",
                      minWidth: "20px",
                      transition: "background-color 0.3s ease",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Widget Form */}
      <div className="panel" style={{ marginBottom: "2rem" }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "flex-start", 
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div>
            <h2 style={{ 
              fontSize: "1.25rem", 
              fontWeight: 700, 
              color: "#0f172a", 
              margin: "0 0 0.5rem 0" 
            }}>
              {t("onlineReservationForm.previewLabel")}
            </h2>
            <p style={{ 
              fontSize: "0.9rem", 
              color: "#64748b", 
              margin: 0 
            }}>
              {t("demo.flow.step1Desc")}
            </p>
          </div>
        </div>
        {tenantQuery.isLoading ? (
          <div className="empty-state">
            <p>{t("demo.flow.loading")}</p>
          </div>
        ) : tenantQuery.error ? (
          <div className="empty-state">
            <p style={{ color: "#ef4444" }}>
              {t("demo.flow.widgetError")}: {getErrorMessage(tenantQuery.error)}
            </p>
          </div>
        ) : !tenantQuery.data ? (
          <div className="empty-state">
            <p style={{ color: "#ef4444" }}>{t("demo.flow.widgetConfigError")}</p>
          </div>
        ) : (
          <div>
            <div
              ref={containerRef}
              className="widget-preview"
              style={{
                minHeight: "400px",
                padding: "2rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                background: "#f8fafc",
                borderRadius: "8px",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {!tenantQuery.isLoading && !tenantQuery.data && (
                <div style={{ textAlign: "center", color: "#64748b" }}>
                  <p>Widget yükleniyor...</p>
                </div>
              )}
              {tenantQuery.data && containerRef.current && containerRef.current.children.length === 0 && (
                <div style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                  <p>Widget başlatılıyor...</p>
                  <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                    Eğer widget görünmüyorsa, browser console'u kontrol edin (F12).
                  </p>
                </div>
              )}
            </div>
            <style>{`
              .widget-preview kyradi-reserve {
                width: 100%;
                max-width: 500px;
                margin: 0 auto;
                display: block;
              }
              .widget-preview .kyradi-reserve {
                width: 100%;
                max-width: 500px;
                margin: 0 auto;
              }
              .widget-preview .kyradi-reserve__fieldset {
                display: block;
                margin-bottom: 1rem;
              }
              .widget-preview .kyradi-reserve__form {
                display: grid;
                gap: 0.75rem;
              }
              .widget-preview .kyradi-reserve__form label {
                display: flex;
                flex-direction: column;
              }
              .widget-preview .kyradi-reserve__form input,
              .widget-preview .kyradi-reserve__form select,
              .widget-preview .kyradi-reserve__form textarea {
                display: block !important;
                width: 100% !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              .widget-preview .kyradi-reserve__fieldset {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                margin-bottom: 1rem !important;
              }
              .widget-preview .kyradi-reserve__legend {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              .widget-preview .kyradi-reserve__helper {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              @media (max-width: 768px) {
                .widget-preview {
                  padding: 0.5rem !important;
                }
                .widget-preview kyradi-reserve {
                  max-width: 100%;
                }
                .demo-step {
                  flex-direction: column !important;
                  align-items: center !important;
                  text-align: center !important;
                  gap: 0.25rem !important;
                }
                .demo-step > div:first-child {
                  width: 36px !important;
                  height: 36px !important;
                  min-width: 36px !important;
                  font-size: 0.85rem !important;
                }
                .demo-step > div:nth-child(2) {
                  margin-left: 0 !important;
                  margin-top: 0.25rem !important;
                }
                .demo-step > div:nth-child(2) > div:first-child {
                  font-size: 0.7rem !important;
                }
                .demo-step > div:nth-child(2) > div:last-child {
                  font-size: 0.75rem !important;
                  max-width: 80px !important;
                }
                .demo-step > div:last-child {
                  display: none !important;
                }
              }
            `}</style>
            {!lastReservationId && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  background: "#e0f2fe",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  color: "#0c4a6e",
                }}
              >
                <p style={{ margin: 0, fontWeight: 500 }}>
                  <strong>ℹ️ {t("demo.flow.widgetHint")}</strong>
                </p>
                <p style={{ margin: "0.5rem 0 0" }}>{t("demo.flow.widgetHintDesc")}</p>
              </div>
            )}
          </div>
        )}
        {lastReservationId && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: "#f0fdf4",
              borderRadius: "8px",
              border: "1px solid #86efac",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem" }}>✓</span>
              <strong style={{ color: "#16a34a" }}>{t("demo.flow.reservationCreated")}</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#166534" }}>
              {t("demo.flow.reservationId")}: #{lastReservationId}
            </p>
          </div>
        )}
      </div>

      {/* Step 2: Conversion */}
      {lastReservationId && !convertedReservationId && (
        <div className="panel" style={{ marginBottom: "2rem" }}>
          <div className="panel__header">
            <h2 className="panel__title">{t("demo.flow.step2Title")}</h2>
            <p className="panel__subtitle">{t("demo.flow.step2Desc")}</p>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleConvertReservation}
              disabled={convertReservationMutation.isPending}
              style={{ fontSize: "1rem", padding: "0.75rem 1.5rem" }}
            >
              {convertReservationMutation.isPending
                ? t("demo.flow.converting")
                : t("demo.flow.convertButton")}
            </button>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
              {t("demo.flow.conversionHint")}
            </p>
          </div>
        </div>
      )}

      {convertedReservationId && (
        <div className="panel" style={{ marginBottom: "2rem" }}>
          <div
            style={{
              padding: "1rem",
              background: "#f0fdf4",
              borderRadius: "8px",
              border: "1px solid #86efac",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem" }}>✓</span>
              <strong style={{ color: "#16a34a" }}>{t("demo.flow.converted")}</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#166534" }}>
              {t("demo.flow.reservationId")}: {convertedReservationId}
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Payment */}
      {convertedReservationId && paymentRequired && (
        <div className="panel" style={{ marginBottom: "2rem" }}>
          <div className="panel__header">
            <h2 className="panel__title">MagicPay ile Ödeme</h2>
            <p className="panel__subtitle">
              MagicPay hosted ödeme sayfasına yönlendirileceksiniz. Kart bilgileri MagicPay tarafından güvenli şekilde alınacaktır.
            </p>
          </div>
          <div
            style={{
              padding: "1.5rem",
              background: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "1rem", color: "#64748b" }}>Toplam Tutar</span>
              <span style={{ fontSize: "2rem", fontWeight: 700, color: "#0f172a" }}>
                {(paymentAmount / 100).toFixed(2)} ₺
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              if (convertedReservationId) {
                createCheckoutSessionMutation.mutate(convertedReservationId);
              }
            }}
            disabled={createCheckoutSessionMutation.isPending}
            style={{ fontSize: "1rem", padding: "0.75rem 1.5rem", width: "100%" }}
          >
            {createCheckoutSessionMutation.isPending ? (
              "Yönlendiriliyor..."
            ) : (
              <>
                <Lock className="h-4 w-4" style={{ marginRight: "0.5rem", display: "inline-block" }} />
                MagicPay ile Ödemeye Git
              </>
            )}
          </button>
          {magicpayCheckoutUrl && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "#f0fdf4",
                borderRadius: "8px",
                border: "1px solid #86efac",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#166534", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle2 className="h-4 w-4" />
                MagicPay ödeme sayfasına yönlendiriliyorsunuz...
              </p>
            </div>
          )}
        </div>
      )}

      {convertedReservationId && !paymentRequired && (
        <div className="panel" style={{ marginBottom: "2rem" }}>
          <div
            style={{
              padding: "1rem",
              background: "#fef3c7",
              borderRadius: "8px",
              border: "1px solid #fde047",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#92400e" }}>
              ℹ️ {t("demo.flow.noPaymentRequired")}
            </p>
          </div>
        </div>
      )}

      {/* Step 4: View Results */}
      {currentStep === "complete" && (
        <div className="panel" style={{ marginBottom: "2rem" }}>
          <div className="panel__header">
            <h2 className="panel__title">{t("demo.flow.step3Title")}</h2>
            <p className="panel__subtitle">{t("demo.flow.step3Desc")}</p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            <Link
              to="/app/reservations"
              className="btn btn--outline"
              style={{ textDecoration: "none", textAlign: "center", padding: "1rem" }}
            >
              {t("demo.flow.viewReservations")}
            </Link>
            <Link
              to="/app/lockers"
              className="btn btn--outline"
              style={{ textDecoration: "none", textAlign: "center", padding: "1rem" }}
            >
              {t("demo.flow.viewStorages")}
            </Link>
            <Link
              to="/app/revenue"
              className="btn btn--outline"
              style={{ textDecoration: "none", textAlign: "center", padding: "1rem" }}
            >
              {t("demo.flow.viewRevenue")}
            </Link>
            <Link
              to="/app/settlements"
              className="btn btn--outline"
              style={{ textDecoration: "none", textAlign: "center", padding: "1rem" }}
            >
              {t("demo.flow.viewSettlements")}
            </Link>
          </div>
        </div>
      )}

      {/* Storage Selection Modal */}
      {showStorageModal && lastReservationId && widgetReservationDates && (
        <StorageSelectionModal
          widgetReservationId={lastReservationId}
          checkinDate={widgetReservationDates.checkin_date}
          checkoutDate={widgetReservationDates.checkout_date}
          selectedStorageId={selectedStorageId}
          onSelectStorage={setSelectedStorageId}
          onConfirm={() => {
            if (selectedStorageId && lastReservationId) {
              convertReservationMutation.mutate({
                widgetReservationId: lastReservationId,
                storageId: selectedStorageId,
              });
            } else if (lastReservationId) {
              // Convert without selecting storage (auto-assign)
              convertReservationMutation.mutate({
                widgetReservationId: lastReservationId,
              });
            }
          }}
          onCancel={() => {
            setShowStorageModal(false);
            setSelectedStorageId(null);
          }}
          isLoading={convertReservationMutation.isPending}
        />
      )}
    </section>
  );
}

// Storage Selection Modal Component
interface StorageSelectionModalProps {
  widgetReservationId: number;
  checkinDate?: string;
  checkoutDate?: string;
  selectedStorageId: string | null;
  onSelectStorage: (storageId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function StorageSelectionModal({
  checkinDate,
  checkoutDate,
  selectedStorageId,
  onSelectStorage,
  onConfirm,
  onCancel,
  isLoading,
}: StorageSelectionModalProps) {

  // Calculate start_at and end_at from dates (use start of day for checkin, end of day for checkout)
  const startAt = checkinDate ? new Date(checkinDate + "T00:00:00").toISOString() : new Date().toISOString();
  const endAt = checkoutDate ? new Date(checkoutDate + "T23:59:59").toISOString() : new Date(Date.now() + 86400000).toISOString();

  const availableStoragesQuery = useQuery({
    queryKey: ["available-storages", startAt, endAt],
    queryFn: () => demoService.getAvailableStorages(startAt, endAt),
    enabled: !!checkinDate && !!checkoutDate,
  });

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list(),
  });

  const getLocationName = (locationId: string) => {
    const location = locationsQuery.data?.find((loc) => loc.id === locationId);
    return location?.name || locationId;
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onCancel}
    >
      <div
        className="panel"
        style={{
          maxWidth: "600px",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          backgroundColor: "white",
          zIndex: 1001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel__header">
          <h2 className="panel__title">Depo Seçimi</h2>
          <p className="panel__subtitle">
            Rezervasyon için uygun depo seçin ({checkinDate} - {checkoutDate})
          </p>
        </div>

        {availableStoragesQuery.isLoading ? (
          <div className="empty-state">Yükleniyor...</div>
        ) : availableStoragesQuery.isError ? (
          <div className="empty-state" style={{ color: "#dc2626" }}>
            Depolar yüklenemedi: {getErrorMessage(availableStoragesQuery.error)}
          </div>
        ) : availableStoragesQuery.data && availableStoragesQuery.data.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {availableStoragesQuery.data.map((storage: Storage) => (
              <div
                key={storage.id}
                onClick={() => onSelectStorage(storage.id)}
                style={{
                  padding: "1rem",
                  border: selectedStorageId === storage.id ? "2px solid #16a34a" : "1px solid #e2e8f0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  backgroundColor: selectedStorageId === storage.id ? "#f0fdf4" : "white",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "0.25rem" }}>
                      Depo {storage.code}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                      {getLocationName(storage.location_id)}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      backgroundColor: storage.status === "idle" ? "#dcfce7" : "#fef3c7",
                      color: storage.status === "idle" ? "#166534" : "#92400e",
                    }}
                  >
                    {storage.status === "idle" ? "Boş" : "Müsait"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Bu tarih aralığı için uygun depo bulunamadı</p>
            <p style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "0.5rem" }}>
              Farklı tarihler deneyin veya otomatik atama yapın.
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={isLoading}>
            İptal
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onConfirm}
            disabled={isLoading || (availableStoragesQuery.data && availableStoragesQuery.data.length > 0 && !selectedStorageId)}
          >
            {isLoading ? "İşleniyor..." : selectedStorageId ? "Seçili Depoyu Ata" : "Otomatik Ata"}
          </button>
        </div>
      </div>
    </div>
  );
}
