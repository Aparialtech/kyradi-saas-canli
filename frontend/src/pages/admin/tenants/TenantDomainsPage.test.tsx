import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { TenantDomainsPage } from "./TenantDomainsPage";

vi.mock("../../../services/admin/tenants", () => ({
  adminTenantService: {
    list: vi.fn().mockResolvedValue([{ id: "tenant-1", name: "Demo Hotel" }]),
  },
}));

vi.mock("../../../services/admin/tenantDomains", () => ({
  adminTenantDomainService: {
    listDomains: vi.fn().mockResolvedValue([
      {
        id: "domain-1",
        domain: "panel.demo.com",
        domain_type: "CUSTOM_DOMAIN",
        status: "VERIFIED",
        is_primary: true,
        verification_method: "DNS_TXT",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]),
    createDomain: vi.fn(),
    updateDomain: vi.fn(),
    deleteDomain: vi.fn(),
    startVerify: vi.fn(),
    checkVerify: vi.fn(),
  },
}));

describe("TenantDomainsPage", () => {
  it("renders domain list", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin/tenants/tenant-1/domains"]}>
          <Routes>
            <Route path="/admin/tenants/:tenantId/domains" element={<TenantDomainsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("panel.demo.com")).toBeInTheDocument();
    });
  });
});
