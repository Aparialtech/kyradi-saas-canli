import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, Plus, X } from "../../../lib/lucide";

import { adminTenantService } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { DateField } from "../../../components/ui/DateField";
import { http } from "../../../lib/http";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export function AdminInvoicePage() {
  const { messages, push } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState<string>("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [notes, setNotes] = useState<string>("");
  const [invoiceFormat, setInvoiceFormat] = useState<"pdf" | "html" | "docx">("pdf");

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  const selectedTenant = useMemo(() => {
    return tenantsQuery.data?.find((t) => t.id === selectedTenantId);
  }, [tenantsQuery.data, selectedTenantId]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.total, 0);
  }, [items]);

  const taxRate = 0.20; // %20 KDV
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(amount / 100);
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    if (field === "quantity" || field === "unitPrice") {
      newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].unitPrice || 0);
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedTenantId) {
      push({ title: "Tenant seçiniz", type: "error" });
      return;
    }
    if (!invoiceNumber) {
      push({ title: "Fatura numarası giriniz", type: "error" });
      return;
    }
    // Validate that at least one item has a description
    const hasValidItems = items.some(item => item.description.trim() !== "");
    if (!hasValidItems) {
      push({ title: "En az bir fatura kalemi ekleyiniz ve açıklama giriniz", type: "error" });
      return;
    }

    try {
      const payload = {
        tenant_id: selectedTenantId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate || invoiceDate,
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_minor: Math.round(item.unitPrice * 100),
          total_minor: Math.round(item.total * 100),
        })),
        subtotal_minor: Math.round(subtotal * 100),
        tax_rate: taxRate,
        tax_amount_minor: Math.round(taxAmount * 100),
        total_minor: Math.round(total * 100),
        notes: notes || undefined,
      };

      let response;
      try {
        response = await http.post(`/admin/invoices/generate?format=${invoiceFormat}`, payload, {
          responseType: "blob",
        });
      } catch (error: any) {
        // If axios throws an error, check if it's a blob response with error
        if (error?.response?.data instanceof Blob) {
          try {
            const text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(error.response.data);
            });
            const errorData = JSON.parse(text);
            throw new Error(errorData.detail || `HTTP ${error.response.status}: Fatura oluşturulamadı`);
          } catch (parseError) {
            throw new Error(`HTTP ${error.response?.status || 500}: Fatura oluşturulamadı`);
          }
        }
        throw error;
      }

      // Check content type - if JSON, it's an error
      const contentType = response.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(response.data);
        });
        const errorData = JSON.parse(text);
        throw new Error(errorData.detail || "Fatura oluşturulamadı");
      }

      // Determine file extension and MIME type
      let extension = "pdf";
      let mimeType = "application/pdf";
      if (invoiceFormat === "docx") {
        extension = "docx";
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (invoiceFormat === "html" || contentType.includes("text/html")) {
        extension = "html";
        mimeType = "text/html";
      }

      const blob = new Blob([response.data], {
        type: mimeType,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kyradi-fatura-${invoiceNumber}-${invoiceDate}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      push({ title: "Fatura oluşturuldu", type: "success" });
    } catch (error: any) {
      let errorMessage = "Fatura oluşturulamadı";
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data) {
        if (error.response.data instanceof Blob) {
          try {
            const text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(error.response.data);
            });
            const errorData = JSON.parse(text);
            errorMessage = errorData.detail || errorMessage;
          } catch {
            // Ignore parsing errors
          }
        } else if (typeof error.response.data === 'object') {
          errorMessage = error.response.data.detail || errorMessage;
        }
      }
      push({ title: "Fatura oluşturulamadı", description: errorMessage, type: "error" });
      console.error("Invoice generation error:", error);
    }
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1400px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
          Kyradi Fatura Oluşturma
        </h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
          Tenantlar için fatura oluşturun ve PDF olarak indirin
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        {/* Fatura Bilgileri */}
        <ModernCard variant="glass" padding="lg">
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-4) 0' }}>
            Fatura Bilgileri
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tenant <span style={{ color: 'var(--danger-500)' }}>*</span>
              </label>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <option value="">Tenant Seçiniz</option>
                {tenantsQuery.data?.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>

            <ModernInput
              label="Fatura Numarası"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="FAT-2025-001"
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <DateField
                label="Fatura Tarihi"
                value={invoiceDate}
                onChange={(value) => setInvoiceDate(value || new Date().toISOString().split("T")[0])}
                fullWidth
              />
              <DateField
                label="Vade Tarihi"
                value={dueDate}
                onChange={(value) => setDueDate(value || "")}
                fullWidth
              />
            </div>

            {selectedTenant && (
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: '0 0 var(--space-2) 0' }}>Fatura Edilecek</h4>
                <p style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--text-sm)' }}>{selectedTenant.name}</p>
                {selectedTenant.legal_name && (
                  <p style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{selectedTenant.legal_name}</p>
                )}
              </div>
            )}
          </div>
        </ModernCard>

        {/* Fatura Önizleme */}
        <ModernCard variant="glass" padding="lg">
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-4) 0' }}>
            Fatura Önizleme
          </h3>
          
          <div style={{ padding: 'var(--space-4)', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-4)', borderBottom: '2px solid var(--border-primary)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: 0 }}>KYRADİ</h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 'var(--space-1) 0 0 0' }}>Depolama ve Rezervasyon Yönetim Sistemi</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0 }}>FATURA</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-1) 0 0 0' }}>#{invoiceNumber || "FAT-2025-001"}</p>
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 var(--space-2) 0' }}>Fatura Edilecek:</p>
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{selectedTenant?.name || "Tenant seçiniz"}</p>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 600 }}>Açıklama</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'center', fontSize: 'var(--text-xs)', fontWeight: 600 }}>Adet</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: 600 }}>Birim Fiyat</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: 600 }}>Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td style={{ padding: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>{item.description || "-"}</td>
                      <td style={{ padding: 'var(--space-2)', textAlign: 'center', fontSize: 'var(--text-xs)' }}>{item.quantity}</td>
                      <td style={{ padding: 'var(--space-2)', textAlign: 'right', fontSize: 'var(--text-xs)' }}>{formatCurrency(item.unitPrice * 100)}</td>
                      <td style={{ padding: 'var(--space-2)', textAlign: 'right', fontSize: 'var(--text-xs)' }}>{formatCurrency(item.total * 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <div style={{ minWidth: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)' }}>Ara Toplam:</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{formatCurrency(subtotal * 100)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)' }}>KDV (%20):</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{formatCurrency(taxAmount * 100)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)', borderTop: '2px solid var(--border-primary)' }}>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Toplam:</span>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{formatCurrency(total * 100)}</span>
                </div>
              </div>
            </div>
          </div>
        </ModernCard>
      </div>

      {/* Fatura Kalemleri */}
      <ModernCard variant="glass" padding="lg" style={{ marginTop: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: 0 }}>
            Fatura Kalemleri
          </h3>
          <ModernButton variant="primary" size="sm" onClick={addItem} leftIcon={<Plus className="h-4 w-4" />}>
            Kalem Ekle
          </ModernButton>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {items.map((item, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)' }}>
              <input
                type="text"
                value={item.description}
                onChange={(e) => handleItemChange(index, "description", e.target.value)}
                placeholder="Açıklama"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 0)}
                placeholder="Adet"
                min="1"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              />
              <input
                type="number"
                value={item.unitPrice}
                onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)}
                placeholder="Birim Fiyat"
                min="0"
                step="0.01"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              />
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, textAlign: 'right' }}>
                {formatCurrency(item.total * 100)}
              </div>
              {items.length > 1 && (
                <ModernButton variant="danger" size="sm" onClick={() => removeItem(index)}>
                  <X className="h-4 w-4" />
                </ModernButton>
              )}
            </div>
          ))}
        </div>
      </ModernCard>

      {/* Notlar ve İşlemler */}
      <ModernCard variant="glass" padding="lg" style={{ marginTop: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Notlar (Opsiyonel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Fatura ile ilgili notlar..."
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Format
              </label>
              <select
                value={invoiceFormat}
                onChange={(e) => setInvoiceFormat(e.target.value as "pdf" | "html" | "docx")}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  minWidth: '120px',
                }}
              >
                <option value="pdf">PDF</option>
                <option value="docx">Word (DOCX)</option>
                <option value="html">HTML</option>
              </select>
            </div>
            <ModernButton variant="primary" onClick={handleGenerateInvoice} leftIcon={<Download className="h-4 w-4" />}>
              Fatura Oluştur ve İndir
            </ModernButton>
          </div>
        </div>
      </ModernCard>
    </div>
  );
}

