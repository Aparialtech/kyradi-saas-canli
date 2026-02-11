import { http } from "../lib/http";
import type {
  AuthUser,
  LoginPayload,
  TokenResponse,
  PartnerLoginResponse,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  VerifyResetCodePayload,
  VerifyResetCodeResponse,
  ResetPasswordPayload,
  ResetPasswordResponse,
  VerifyLoginSMSPayload,
  VerifyLoginSMSResponse,
  SignupPayload,
  SignupResponse,
  TenantOnboardingPayload,
  TenantOnboardingResponse,
} from "../types/auth";

export const authService = {
  async getTenantRedirectUrl(redirectUrl?: string): Promise<{ redirect_url: string }> {
    const response = await http.get<{ redirect_url: string }>("/auth/redirect-to-tenant", {
      params: redirectUrl ? { redirect: redirectUrl } : undefined,
    });
    return response.data;
  },
  async logout(): Promise<{ ok: boolean }> {
    const response = await http.post<{ ok: boolean }>("/auth/logout");
    return response.data;
  },
  async login(payload: LoginPayload): Promise<TokenResponse> {
    const response = await http.post<TokenResponse>("/auth/login", payload);
    return response.data;
  },
  async loginPartner(payload: LoginPayload): Promise<PartnerLoginResponse> {
    const response = await http.post<PartnerLoginResponse>("/auth/partner/login", payload);
    return response.data;
  },
  async loginAdmin(payload: LoginPayload): Promise<TokenResponse> {
    const response = await http.post<TokenResponse>("/auth/admin/login", payload);
    return response.data;
  },
  async getCurrentUser(): Promise<AuthUser> {
    const response = await http.get<AuthUser>("/auth/me");
    return response.data;
  },
  async requestPasswordReset(payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> {
    const response = await http.post<ForgotPasswordResponse>("/auth/forgot-password", payload);
    return response.data;
  },
  async verifyResetCode(payload: VerifyResetCodePayload): Promise<VerifyResetCodeResponse> {
    const response = await http.post<VerifyResetCodeResponse>("/auth/verify-reset-code", payload);
    return response.data;
  },
  async resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
    const response = await http.post<ResetPasswordResponse>("/auth/reset-password", payload);
    return response.data;
  },
  async verifyLoginSMS(payload: VerifyLoginSMSPayload): Promise<VerifyLoginSMSResponse> {
    const response = await http.post<VerifyLoginSMSResponse>("/auth/verify-login-sms", payload);
    return response.data;
  },
  async resendLoginSMS(verification_id: string): Promise<{ message: string; verification_id: string }> {
    const response = await http.post<{ message: string; verification_id: string }>(
      "/auth/resend-login-sms",
      { verification_id },
    );
    return response.data;
  },
  async signup(payload: SignupPayload): Promise<SignupResponse> {
    const response = await http.post<SignupResponse>("/auth/signup", payload);
    return response.data;
  },
  async createTenant(payload: TenantOnboardingPayload): Promise<TenantOnboardingResponse> {
    const response = await http.post<TenantOnboardingResponse>(
      "/auth/onboarding/create-tenant",
      payload,
    );
    return response.data;
  },
};
