import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "../components/auth/RequireAuth";
import {
  AdminDashboard,
  AdminTenantsPage,
  AdminReportsOverview,
  AdminReportsAnalyticsPage,
  AdminInvoicePage,
  AdminAuditPage,
  AdminRevenuePage,
  AdminSettlementsPage,
  AdminUsersPage,
  AdminSettingsPage,
  AdminTransfersPage,
} from "../pages/admin/AdminDashboard";
import { AdminTicketsPage } from "../pages/admin/tickets/AdminTicketsPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage";
import { VerifyResetCodePage } from "../pages/auth/VerifyResetCodePage";
import { ResetPasswordPage } from "../pages/auth/ResetPasswordPage";
import { SMSVerificationPage } from "../pages/auth/SMSVerificationPage";
import {
  PartnerDashboard,
  PartnerLocationsPlaceholder,
  PartnerLockersPage,
  PartnerOverview,
  PartnerReservationsPage,
  PartnerQRPage,
  PartnerUsersPage,
  PartnerReportsAnalyticsPage,
  PartnerRevenueDashboard,
  PartnerSettlementsPage,
  PartnerStaffPage,
  PartnerPricingPage,
  DemoFlowPage,
  DemoPaymentFlowPage,
  PartnerSettingsPage,
} from "../pages/partner/PartnerDashboard";
import { LocationEditPage } from "../pages/partner/locations/LocationEditPage";
import { UserEditPage } from "../pages/partner/users/UserEditPage";
import { StaffAssignPage } from "../pages/partner/staff/StaffAssignPage";
import { StorageEditPage } from "../pages/partner/storages/StorageEditPage";
import { TicketsPage } from "../pages/partner/tickets/TicketsPage";
import { TransfersPage } from "../pages/partner/transfers/TransfersPage";
import { WidgetPreviewPage } from "../pages/partner/WidgetPreviewPage";
import { MagicPayDemoPage } from "../pages/partner/magicpay/MagicPayDemoPage";
import { SelfServiceReservationPage } from "../pages/public/SelfServiceReservationPage";
import { WidgetDemoPage } from "../pages/public/WidgetDemoPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify-reset-code" element={<VerifyResetCodePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-sms" element={<SMSVerificationPage />} />
      <Route path="/self-service" element={<SelfServiceReservationPage />} />
      <Route path="/widget-demo" element={<WidgetDemoPage />} />
      <Route path="/payments/magicpay/demo/:sessionId" element={<MagicPayDemoPage />} />

      <Route element={<RequireAuth allowedRoles={["super_admin", "support"]} />}>
        <Route path="/admin" element={<AdminDashboard />}>
          <Route index element={<AdminReportsOverview />} />
          <Route path="overview" element={<AdminReportsOverview />} />
          <Route path="reports" element={<AdminReportsAnalyticsPage />} />
          <Route path="invoice" element={<AdminInvoicePage />} />
          <Route path="tenants" element={<AdminTenantsPage />} />
          <Route path="revenue" element={<AdminRevenuePage />} />
          <Route path="settlements" element={<AdminSettlementsPage />} />
          <Route path="transfers" element={<AdminTransfersPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="tickets" element={<AdminTicketsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="*" element={<Navigate to="/admin/overview" replace />} />
        </Route>
      </Route>

      <Route
        element={
          <RequireAuth allowedRoles={["tenant_admin", "staff", "viewer", "hotel_manager", "storage_operator", "accounting"]} />
        }
      >
        <Route path="/app" element={<PartnerDashboard />}>
          <Route index element={<PartnerOverview />} />
          <Route path="locations" element={<PartnerLocationsPlaceholder />} />
          <Route path="locations/:id/edit" element={<LocationEditPage />} />
          <Route path="locations/new" element={<LocationEditPage />} />
          <Route path="lockers" element={<PartnerLockersPage />} />
          <Route path="lockers/:id/edit" element={<StorageEditPage />} />
          <Route path="lockers/new" element={<StorageEditPage />} />
          <Route path="reservations" element={<PartnerReservationsPage />} />
          <Route path="widget-preview" element={<WidgetPreviewPage />} />
          <Route path="qr" element={<PartnerQRPage />} />
          <Route
            element={<RequireAuth allowedRoles={["accounting", "hotel_manager", "tenant_admin"]} redirectTo="/app" />}
          >
            <Route path="reports" element={<PartnerReportsAnalyticsPage />} />
            <Route path="revenue" element={<PartnerRevenueDashboard />} />
            <Route path="settlements" element={<PartnerSettlementsPage />} />
            <Route path="transfers" element={<TransfersPage />} />
          </Route>
          <Route
            element={<RequireAuth allowedRoles={["tenant_admin", "hotel_manager"]} redirectTo="/app" />}
          >
            <Route path="users" element={<PartnerUsersPage />} />
            <Route path="users/:id/edit" element={<UserEditPage />} />
            <Route path="users/new" element={<UserEditPage />} />
            <Route path="staff" element={<PartnerStaffPage />} />
            <Route path="staff/assign" element={<StaffAssignPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="pricing" element={<PartnerPricingPage />} />
            <Route path="demo-flow" element={<DemoFlowPage />} />
            <Route path="demo-payment-flow" element={<DemoPaymentFlowPage />} />
          </Route>
          <Route path="settings" element={<PartnerSettingsPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
