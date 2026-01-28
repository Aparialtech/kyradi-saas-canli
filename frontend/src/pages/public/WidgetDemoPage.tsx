import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getApiBase } from "../../utils/apiBase";
import { useLocale, type SupportedLocale } from "../../context/LocaleContext";
import { useTranslation } from "../../hooks/useTranslation";

// Demo tenant - fixed ID that matches backend seeding
const DEMO_TENANT = "7d7417b7-17fe-4857-ab14-dd3f390ec497";
const DEMO_WIDGET_KEY = "demo-public-key";

const demoMessages: Record<SupportedLocale, { missing: string; ready: string; error: string }> = {
  "tr-TR": {
    missing: "Tenant ID ve widget key gerekli.",
    ready: "Widget yüklendi. Formu doldurup rezervasyon oluşturabilirsiniz.",
    error: "Widget scripti yüklenemedi. CDN yolunu kontrol edin.",
  },
  "en-US": {
    missing: "Tenant ID and widget key are required.",
    ready: "Widget loaded. You can submit the form to create a reservation.",
    error: "Widget script could not load. Verify the CDN path.",
  },
  "de-DE": {
    missing: "Tenant-ID und Widget-Key sind erforderlich.",
    ready: "Widget geladen. Sie können das Formular absenden, um eine Reservierung zu erstellen.",
    error: "Widget-Skript konnte nicht geladen werden. CDN-Pfad prüfen.",
  },
  "zh-CN": {
    missing: "需要 Tenant ID 和 widget key。",
    ready: "组件已加载。填写表单即可创建预订。",
    error: "组件脚本加载失败。请检查 CDN 路径。",
  },
  "es-ES": {
    missing: "Se requieren Tenant ID y clave del widget.",
    ready: "Widget cargado. Puedes enviar el formulario para crear una reserva.",
    error: "No se pudo cargar el script del widget. Verifica la ruta CDN.",
  },
};

export function WidgetDemoPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { locale, setLocale, availableLocales } = useLocale();
  const { t } = useTranslation();
  const supportedCodes = availableLocales.map((item) => item.code);

  const initialLocaleParam = searchParams.get("locale") as SupportedLocale | null;
  const resolvedInitialLocale =
    initialLocaleParam && supportedCodes.includes(initialLocaleParam) ? initialLocaleParam : locale;

  const [tenantId, setTenantId] = useState(searchParams.get("tenant_id") ?? DEMO_TENANT);
  const [widgetKey, setWidgetKey] = useState(searchParams.get("widget_key") ?? DEMO_WIDGET_KEY);
  const [apiBase, setApiBase] = useState(searchParams.get("api_base") ?? getApiBase());
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(resolvedInitialLocale);
  const [status, setStatus] = useState<string>("");
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  const [showStaticForm, setShowStaticForm] = useState(false);
  const cdnBase = env.PUBLIC_CDN_BASE || window.location.origin;

  const snippet = useMemo(
    () => `<script src="${cdnBase}/widgets/kyradi-reserve.js"
  data-api-base="${apiBase}"
  data-tenant-id="${tenantId || "TENANT_ID"}"
  data-widget-key="${widgetKey || "WIDGET_KEY"}"
  data-locale="${selectedLocale}"
  data-theme="light"
  defer></script>
<kyradi-reserve></kyradi-reserve>`,
    [apiBase, cdnBase, tenantId, widgetKey, selectedLocale],
  );

  const mountWidget = useCallback(() => {
    const copy = demoMessages[selectedLocale] ?? demoMessages["tr-TR"];
    if (!tenantId || !widgetKey || !containerRef.current) {
      setStatus(copy.missing);
      return;
    }
    const container = containerRef.current;
    container.innerHTML = "";

    const scriptEl = document.createElement("script");
    scriptEl.src = `${cdnBase}/widgets/kyradi-reserve.js`;
    scriptEl.defer = true;
    scriptEl.dataset.apiBase = apiBase;
    scriptEl.dataset.tenantId = tenantId;
    scriptEl.dataset.widgetKey = widgetKey;
    scriptEl.dataset.locale = selectedLocale;
    scriptEl.dataset.theme = "light";

    const widgetEl = document.createElement("kyradi-reserve");
    container.appendChild(widgetEl);
    container.appendChild(scriptEl);

    scriptEl.onload = () => {
      if (window.KyradiReserve) {
        window.KyradiReserve.mount();
      }
      setStatus(copy.ready);
    };
    scriptEl.onerror = () => {
      setStatus(copy.error);
    };
  }, [apiBase, cdnBase, tenantId, widgetKey, selectedLocale]);

  useEffect(() => {
    if (locale !== selectedLocale) {
      setSelectedLocale(locale);
    }
  }, [locale, selectedLocale]);

  useEffect(() => {
    mountWidget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, cdnBase, tenantId, widgetKey, selectedLocale]); // Use dependencies directly instead of mountWidget to avoid infinite loops

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSearchParams({
      tenant_id: tenantId,
      widget_key: widgetKey,
      api_base: apiBase,
      locale: selectedLocale,
    });
    setLastSubmitted(new Date().toLocaleTimeString(selectedLocale));
    mountWidget();
  };

  return (
    <section className="page" style={{ paddingTop: "2rem" }}>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("widget.demo.title")}</h1>
          <p className="page-subtitle">{t("widget.demo.subtitle")}</p>
        </div>
      </header>

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <div className="panel__header">
          <h2 className="panel__title">{t("widget.demo.form.title")}</h2>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-field__label">{t("widget.demo.form.apiBase")}</span>
            <input
              type="url"
              value={apiBase}
              onChange={(event) => setApiBase(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t("widget.demo.form.tenant")}</span>
            <input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t("widget.demo.form.widgetKey")}</span>
            <input
              value={widgetKey}
              onChange={(event) => setWidgetKey(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t("widget.demo.form.locale")}</span>
            <select
              value={selectedLocale}
              onChange={(event) => {
                const next = event.target.value as SupportedLocale;
                setSelectedLocale(next);
                setLocale(next);
              }}
            >
              {availableLocales.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
            <div className="form-actions form-grid__field--full">
              <button type="submit" className="btn btn--primary">
                {t("widget.demo.form.button")}
              </button>
            </div>
          </form>
        <p className="page-subtitle" style={{ marginTop: "0.5rem" }}>
          {status} {lastSubmitted ? `(${t("widget.demo.status")}: ${lastSubmitted})` : ""}
        </p>
      </div>

      <div className="panel">
        <h3 className="panel__title">{t("widget.demo.liveTitle")}</h3>
        <div ref={containerRef} className="widget-preview"></div>
      </div>

      <div className="panel">
        <div className="panel__header" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 className="panel__title">{t("widget.demo.staticPanelTitle")}</h3>
            <p className="panel__subtitle">{t("widget.demo.staticSubtitle")}</p>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setShowStaticForm((prev) => !prev)}
          >
            {showStaticForm ? t("widget.preview.toggleHide") : t("widget.preview.toggleShow")}
          </button>
        </div>
        {showStaticForm && (
          <div className="kyradi-reserve" style={{ maxWidth: 420 }}>
            <h4 className="kyradi-reserve__title">{t("widget.demo.staticTitle")}</h4>
            <form className="kyradi-reserve__form">
              <label>
                <span>{t("widget.demo.static.checkin")}</span>
                <input type="date" required />
              </label>
              <label>
                <span>{t("widget.demo.static.checkout")}</span>
                <input type="date" required />
              </label>
              <label>
                <span>{t("widget.demo.static.baggage")}</span>
                <input type="number" min="0" max="20" defaultValue={1} />
              </label>
              <label>
                <span>{t("widget.demo.static.name")}</span>
                <input type="text" />
              </label>
              <label>
                <span>{t("widget.demo.static.email")}</span>
                <input type="email" />
              </label>
              <label>
                <span>{t("widget.demo.static.phone")}</span>
                <input type="tel" />
              </label>
              <label>
                <span>{t("widget.demo.static.notes")}</span>
                <textarea rows={3} placeholder={t("widget.demo.static.notesPlaceholder")}></textarea>
              </label>
              <label className="kyradi-reserve__consent">
                <input type="checkbox" defaultChecked />
                <span>{t("widget.demo.static.consent")}</span>
              </label>
              <button className="kyradi-reserve__button" type="button" disabled>
                {t("widget.demo.static.button")}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="panel">
        <h3 className="panel__title">{t("widget.demo.embedTitle")}</h3>
        <textarea
          readOnly
          value={snippet}
          rows={8}
          className="code-snippet"
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
    </section>
  );
}
