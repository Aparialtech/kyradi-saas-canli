export type UserRole =
  | "super_admin"
  | "support"
  | "tenant_admin"
  | "staff"
  | "viewer"
  | "hotel_manager"
  | "storage_operator"
  | "accounting";

export interface AuthUser {
  id: string;
  tenant_id?: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login_at?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
  tenant_slug?: string | null;
}

export interface TokenResponse {
  access_token?: string | null;
  token_type: string;
  status?: string | null; // "phone_verification_required" or null
  verification_id?: string | null; // ID of PhoneLoginVerification when status is "phone_verification_required"
}

export interface PartnerLoginResponse {
  access_token: string;
  token_type: string;
  tenant_slug?: string | null; // Tenant subdomain for redirect
  tenant_id?: string | null;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  reset_token?: string | null; // Only in development mode
}

export interface VerifyResetCodePayload {
  email: string;
  code: string;
}

export interface VerifyResetCodeResponse {
  message: string;
  reset_token: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  message: string;
  success: boolean;
}

export interface VerifyLoginSMSPayload {
  verification_id: string;
  code: string;
}

export interface VerifyLoginSMSResponse {
  access_token: string;
  token_type: string;
  message: string;
}

// Signup types
export interface SignupPayload {
  email: string;
  password: string;
  full_name?: string;
  phone_number?: string;
}

export interface SignupResponse {
  message: string;
  user_id: string;
  access_token?: string | null;
}

// Onboarding (Tenant Creation) types
export interface TenantOnboardingPayload {
  name: string;
  slug: string;
  custom_domain?: string | null;
  legal_name?: string | null;
  brand_color?: string | null;
}

export interface TenantOnboardingResponse {
  message: string;
  tenant_id: string;
  tenant_slug: string;
  redirect_url: string;
}
