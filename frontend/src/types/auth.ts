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

export interface ForgotPasswordPayload {
  email: string;
  tenant_slug?: string | null;
}

export interface ForgotPasswordResponse {
  message: string;
  reset_token?: string | null; // Only in development mode
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
