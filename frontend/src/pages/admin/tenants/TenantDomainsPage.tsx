import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Globe, Plus, RefreshCw, Trash2, ShieldCheck, ShieldAlert } from "../../../lib/lucide";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../../components/ui/Modal";
import { Badge } from "../../../components/ui/Badge";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { adminTenantService } from "../../../services/admin/tenants";
import {
  adminTenantDomainService,
  type TenantDomain,
  type TenantDomainCreatePayload,
  type TenantDomainType,
} from "../../../services/admin/tenantDomains";

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  VERIFIED: "success",
  VERIFYING: "info",
  PENDING: "warning",
  FAILED: "danger",
  DISABLED: "neutral",
};

const typeLabels: Record<string, string> = {
  SUBDOMAIN: "Subdomain",
  CUSTOM_DOMAIN: "Custom Domain",
};

const INTERNAL_BASE_DOMAIN = import.meta.env.VITE_TENANT_BASE_DOMAIN || "kyradi.app";

export function TenantDomainsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<TenantDomain | null>(null);
  const [domainType, setDomainType] = useState<TenantDomainType>("CUSTOM_DOMAIN");
  const [domainInput, setDomainInput] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [verifyDomain, setVerifyDomain] = useState<TenantDomain | null>(null);
  const [dnsRecord, setDnsRecord] = useState<{ name: string; value: string } | null>(null);

  const tenantQuery = useQuery({
    queryKey: ["admin", "tenants", tenantId],
    queryFn: async () => {
      const tenants = await adminTenantService.list();
      return tenants.find((t) => t.id === tenantId);
    },
    enabled: Boolean(tenantId),
  });

  const domainsQuery = useQuery({
    queryKey: ["admin", "tenant-domains", tenantId],
    queryFn: () => adminTenantDomainService.listDomains(tenantId!),
    enabled: Boolean(tenantId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TenantDomainCreatePayload) => adminTenantDomainService.createDomain(tenantId!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenant-domains", tenantId] });
      push({ title: "Domain eklendi", description: "Yeni domain kaydedildi.", type: "success" });
      setIsModalOpen(false);
    },
    onError: (error: unknown) => {
      push({ title: "Hata", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<TenantDomainCreatePayload> & { status?: string } }) =>
      adminTenantDomainService.updateDomain(tenantId!, payload.id, payload.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenant-domains", tenantId] });
      push({ title: "Domain güncellendi", description: "Domain bilgileri kaydedildi.", type: "success" });
      setIsModalOpen(false);
      setEditingDomain(null);
    },
    onError: (error: unknown) => {
      push({ title: "Hata", description: getErrorMessage(error), type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminTenantDomainService.deleteDomain(tenantId!, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenant-domains", tenantId] });
      push({ title: "Domain silindi", description: "Domain kaydı kaldırıldı.", type: "success" });
    },
    onError: (error: unknown) => {
      push({ title: "Hata", description: getErrorMessage(error), type: "error" });
    },
  });

  const startVerifyMutation = useMutation({
    mutationFn: (id: string) => adminTenantDomainService.startVerify(tenantId!, id),
    onSuccess: (data, id) => {
      setDnsRecord({ name: data.verification_record_name, value: data.verification_record_value });
      const domain = domainsQuery.data?.find((item) => item.id === id) || null;
      setVerifyDomain(domain);
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenant-domains", tenantId] });
    },
    onError: (error: unknown) => {
      push({ title: "Hata", description: getErrorMessage(error), type: "error" });
    },
  });

  const checkVerifyMutation = useMutation({
    mutationFn: (id: string) => adminTenantDomainService.checkVerify(tenantId!, id),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenant-domains", tenantId] });
      if (data.verified) {
        push({ title: "Domain doğrulandı", description: "DNS kaydı başarıyla doğrulandı.", type: "success" });
      } else {
        push({ title: "Doğrulama sürüyor", description: data.failure_reason || "TXT kaydı bulunamadı.", type: "warning" });
      }
    },
    onError: (error: unknown) => {
      push({ title: "Hata", description: getErrorMessage(error), type: "error" });
    },
  });

  const tableData = useMemo(() => domainsQuery.data || [], [domainsQuery.data]);

  const resetForm = () => {
    setDomainType("CUSTOM_DOMAIN");
    setDomainInput("");
    setSlugInput("");
    setIsPrimary(false);
  };

  const openCreateModal = () => {
    resetForm();
    setEditingDomain(null);
    setIsModalOpen(true);
  };

  const openEditModal = (domain: TenantDomain) => {
    setEditingDomain(domain);
    setDomainType(domain.domain_type);
    setIsPrimary(domain.is_primary);
    if (domain.domain_type === "SUBDOMAIN") {
      setSlugInput(domain.domain.replace(`.${INTERNAL_BASE_DOMAIN}`, ""));
      setDomainInput("");
    } else {
      setDomainInput(domain.domain);
      setSlugInput("");
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!tenantId) return;
    const trimmedDomain = domainInput.trim().toLowerCase();
    const trimmedSlug = slugInput.trim().toLowerCase();

    let domain = trimmedDomain;
    if (domainType === "SUBDOMAIN") {
      if (!trimmedSlug) {
        push({ title: "Hata", description: "Subdomain için slug girin.", type: "error" });
        return;
      }
      domain = `${trimmedSlug}.${INTERNAL_BASE_DOMAIN}`;
    }

    if (!domain || domain.includes("http") || domain.includes(" ")) {
      push({ title: "Hata", description: "Geçerli bir domain girin.", type: "error" });
      return;
    }

    if (editingDomain) {
      updateMutation.mutate({
        id: editingDomain.id,
        data: { domain, domain_type: domainType, is_primary: isPrimary },
      });
      return;
    }

    createMutation.mutate({
      domain,
      domain_type: domainType,
      is_primary: isPrimary,
    });
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      push({ title: "Kopyalandı", description: value, type: "success" });
    } catch {
      push({ title: "Hata", description: "Kopyalama başarısız oldu.", type: "error" });
    }
  };

  if (tenantQuery.isLoading) {
    return <div style={{ padding: "var(--space-6)" }}>Yükleniyor...</div>;
  }

  if (!tenantQuery.data) {
    return (
      <div style={{ padding: "var(--space-6)" }}>
        <ModernButton variant="ghost" onClick={() => navigate("/admin/tenants")}>
          Otellere Dön
        </ModernButton>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "1200px", margin: "0 auto" }}>
      <ToastContainer messages={messages} />
      <ModernCard style={{ marginBottom: "var(--space-5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Domain Yönetimi</h2>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--text-secondary)" }}>
              {tenantQuery.data.name} için domain ve subdomain kayıtlarını yönetin.
            </p>
          </div>
          <ModernButton variant="primary" onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
            Domain Ekle
          </ModernButton>
        </div>
      </ModernCard>

      <ModernCard>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px" }}>Domain</th>
                <th style={{ padding: "12px" }}>Tip</th>
                <th style={{ padding: "12px" }}>Durum</th>
                <th style={{ padding: "12px" }}>Primary</th>
                <th style={{ padding: "12px" }}>Son Kontrol</th>
                <th style={{ padding: "12px" }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((domain) => (
                <tr key={domain.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Globe className="h-4 w-4" />
                      {domain.domain}
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>{typeLabels[domain.domain_type]}</td>
                  <td style={{ padding: "12px" }}>
                    <Badge variant={statusVariant[domain.status] || "neutral"}>{domain.status}</Badge>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <Badge variant={domain.is_primary ? "success" : "neutral"}>
                      {domain.is_primary ? "Primary" : "-"}
                    </Badge>
                  </td>
                  <td style={{ padding: "12px" }}>{domain.last_checked_at ? new Date(domain.last_checked_at).toLocaleString("tr-TR") : "-"}</td>
                  <td style={{ padding: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <ModernButton variant="ghost" onClick={() => openEditModal(domain)}>
                      Düzenle
                    </ModernButton>
                    <ModernButton
                      variant="ghost"
                      onClick={() => startVerifyMutation.mutate(domain.id)}
                      leftIcon={<ShieldCheck className="h-4 w-4" />}
                    >
                      Verify
                    </ModernButton>
                    <ModernButton
                      variant="ghost"
                      onClick={() =>
                        updateMutation.mutate({
                          id: domain.id,
                          data: { status: domain.status === "DISABLED" ? "PENDING" : "DISABLED" },
                        })
                      }
                    >
                      {domain.status === "DISABLED" ? "Aktif Et" : "Pasif Et"}
                    </ModernButton>
                    <ModernButton variant="ghost" onClick={() => deleteMutation.mutate(domain.id)} leftIcon={<Trash2 className="h-4 w-4" />}>
                      Sil
                    </ModernButton>
                  </td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>
                    Henüz domain eklenmemiş.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ModernCard>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg">
        <ModalHeader title={editingDomain ? "Domain Güncelle" : "Yeni Domain"} />
        <ModalBody>
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label>Tip</label>
              <select
                value={domainType}
                onChange={(event) => setDomainType(event.target.value as TenantDomainType)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}
                disabled={Boolean(editingDomain)}
              >
                <option value="CUSTOM_DOMAIN">Custom Domain</option>
                <option value="SUBDOMAIN">Subdomain</option>
              </select>
            </div>
            {domainType === "SUBDOMAIN" ? (
              <ModernInput
                label="Slug"
                placeholder="otel-adi"
                value={slugInput}
                onChange={(event) => setSlugInput(event.target.value)}
                helperText={`Domain otomatik: ${slugInput || "slug"}.${INTERNAL_BASE_DOMAIN}`}
              />
            ) : (
              <ModernInput
                label="Domain"
                placeholder="panel.oteldomain.com"
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                helperText="Örn: panel.oteldomain.com"
              />
            )}
            <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
              Primary domain olarak ayarla
            </label>
          </div>
        </ModalBody>
        <ModalFooter justify="end">
          <ModernButton variant="ghost" onClick={() => setIsModalOpen(false)}>
            Vazgeç
          </ModernButton>
          <ModernButton variant="primary" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            Kaydet
          </ModernButton>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(verifyDomain)} onClose={() => setVerifyDomain(null)} size="lg">
        <ModalHeader title="DNS Doğrulama" />
        <ModalBody>
          <div style={{ display: "grid", gap: "12px" }}>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              DNS yayılımı 5-30 dk sürebilir. TXT kaydını ekledikten sonra doğrulamayı kontrol edin.
            </p>
            {dnsRecord && (
              <ModernCard>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div><strong>Record Type:</strong> TXT</div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <strong>Name:</strong> {dnsRecord.name}
                    <ModernButton variant="ghost" size="sm" onClick={() => copyValue(dnsRecord.name)} leftIcon={<Copy className="h-3 w-3" />}>
                      Kopyala
                    </ModernButton>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <strong>Value:</strong> {dnsRecord.value}
                    <ModernButton variant="ghost" size="sm" onClick={() => copyValue(dnsRecord.value)} leftIcon={<Copy className="h-3 w-3" />}>
                      Kopyala
                    </ModernButton>
                  </div>
                </div>
              </ModernCard>
            )}
            {verifyDomain?.failure_reason && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--warning)" }}>
                <ShieldAlert className="h-4 w-4" /> {verifyDomain.failure_reason}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter justify="between">
          <ModernButton variant="ghost" onClick={() => setVerifyDomain(null)}>
            Kapat
          </ModernButton>
          <ModernButton
            variant="primary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => verifyDomain && checkVerifyMutation.mutate(verifyDomain.id)}
            disabled={checkVerifyMutation.isPending}
          >
            Ben Ekledim / Kontrol Et
          </ModernButton>
        </ModalFooter>
      </Modal>
    </div>
  );
}
