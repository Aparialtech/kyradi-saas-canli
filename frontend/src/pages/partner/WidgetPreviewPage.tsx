import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Code, Eye, Loader2, AlertCircle } from "../../lib/lucide";

import { env } from "../../config/env";
import { partnerWidgetService } from "../../services/partner/widgetConfig";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/common/ToastContainer";
import { getErrorMessage } from "../../lib/httpError";
import { useTranslation } from "../../hooks/useTranslation";
import { ModernCard } from "../../components/ui/ModernCard";
import { ModernButton } from "../../components/ui/ModernButton";

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
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <Code className="h-8 w-8" style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: 0 }}>
              {t("widget.preview.title")}
            </h1>
          </div>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("widget.preview.subtitle")}
          </p>
        </div>
        <ModernButton variant="outline" onClick={() => window.open("/docs/embedding_guide.md", "_blank")}>
          {t("widget.preview.docButton")}
        </ModernButton>
      </motion.div>

      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
              {t("widget.preview.liveTitle")}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {t("widget.preview.liveSubtitle")}
            </p>
          </div>
          <ModernButton variant="ghost" onClick={() => window.open("/widget-demo", "_blank")} leftIcon={<Eye className="h-4 w-4" />}>
            {t("widget.preview.demoButton")}
          </ModernButton>
        </div>
        {tenantQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("widget.preview.loading")}</p>
          </div>
        ) : tenantQuery.isError ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--danger-500)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("common.error")}</p>
            <p style={{ margin: 'var(--space-2) 0 0 0' }}>{getErrorMessage(tenantQuery.error)}</p>
          </div>
        ) : (
          <div ref={containerRef} style={{ minHeight: '400px', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}></div>
        )}
      </ModernCard>

      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
              {t("widget.preview.staticTitle")}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {t("widget.preview.staticSubtitle")}
            </p>
          </div>
          <ModernButton variant="ghost" onClick={() => setShowStaticForm((prev) => !prev)}>
            {showStaticForm ? t("widget.preview.toggleHide") : t("widget.preview.toggleShow")}
          </ModernButton>
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
      </ModernCard>

      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
            {t("widget.preview.embedTitle")}
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("widget.preview.embedSubtitle")}
          </p>
        </div>
        <textarea
          readOnly
          value={snippet}
          rows={8}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: 'var(--text-sm)',
            resize: 'vertical',
          }}
          onFocus={(event) => event.currentTarget.select()}
        />
      </ModernCard>
    </div>
  );
}
