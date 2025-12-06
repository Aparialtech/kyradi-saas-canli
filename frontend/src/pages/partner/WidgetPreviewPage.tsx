import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { env } from "../../config/env";
import { partnerWidgetService } from "../../services/partner/widgetConfig";
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

const buildSnippet = (cdnBase: string, apiBase: string, tenantId: string, widgetKey: string, locale: string) => `<script src="${cdnBase}/widgets/kyradi-reserve.js"
  data-api-base="${apiBase}"
  data-tenant-id="${tenantId}"
  data-widget-key="${widgetKey}"
  data-locale="${locale}"
  data-theme="light"
  defer></script>
<kyradi-reserve></kyradi-reserve>`;

export function WidgetPreviewPage() {
  const { messages, push } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [snippet, setSnippet] = useState<string>("");
  const [showStaticForm, setShowStaticForm] = useState(true);
  const { t, locale } = useTranslation();
  const tenantQuery = useQuery({
    queryKey: ["partner", "widget-config"],
    queryFn: () => partnerWidgetService.getWidgetConfig(),
  });

  useEffect(() => {
    if (!tenantQuery.data || !containerRef.current) return;
    const { tenant_id, widget_public_key } = tenantQuery.data;
    const cdnBase = env.PUBLIC_CDN_BASE || window.location.origin;
    const code = buildSnippet(cdnBase, env.API_URL, tenant_id, widget_public_key, locale);
    setSnippet(code);

    const container = containerRef.current;
    container.innerHTML = "";

    const scriptEl = document.createElement("script");
    scriptEl.src = `${cdnBase}/widgets/kyradi-reserve.js`;
    scriptEl.defer = true;
    scriptEl.dataset.apiBase = env.API_URL;
    scriptEl.dataset.tenantId = tenant_id;
    scriptEl.dataset.widgetKey = widget_public_key;
    scriptEl.dataset.locale = locale;
    scriptEl.dataset.theme = "light";

    const widgetEl = document.createElement("kyradi-reserve");
    container.appendChild(widgetEl);
    container.appendChild(scriptEl);

    scriptEl.onload = () => {
      if (window.KyradiReserve) {
        window.KyradiReserve.mount();
      }
    };
  }, [tenantQuery.data, locale]);

  useEffect(() => {
    if (tenantQuery.error) {
      push({ title: t("widget.preview.toastError"), description: getErrorMessage(tenantQuery.error), type: "error" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantQuery.isError]); // Only depend on isError boolean to avoid infinite loops from error object reference changes

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("widget.preview.title")}</h1>
          <p className="page-subtitle">{t("widget.preview.subtitle")}</p>
        </div>
        <div className="page-actions">
          <a
            href="/docs/embedding_guide.md"
            className="btn btn--outline"
            target="_blank"
            rel="noreferrer"
          >
            {t("widget.preview.docButton")}
          </a>
        </div>
      </header>

      <div className="panel">
        <div className="panel__header" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="panel__title">{t("widget.preview.liveTitle")}</h2>
            <p className="panel__subtitle">{t("widget.preview.liveSubtitle")}</p>
          </div>
          <a className="btn btn--ghost" href="/widget-demo" target="_blank" rel="noreferrer">
            {t("widget.preview.demoButton")}
          </a>
        </div>
        {tenantQuery.isLoading ? (
          <div className="empty-state">
            <p>{t("widget.preview.loading")}</p>
          </div>
        ) : (
          <div ref={containerRef} className="widget-preview"></div>
        )}
      </div>

      <div className="panel">
        <div className="panel__header" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 className="panel__title">{t("widget.preview.staticTitle")}</h3>
            <p className="panel__subtitle">{t("widget.preview.staticSubtitle")}</p>
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
        <h3 className="panel__title">{t("widget.preview.embedTitle")}</h3>
        <p className="panel__subtitle">{t("widget.preview.embedSubtitle")}</p>
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
