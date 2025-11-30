import { http } from "../lib/http";
import type {
  AuthUser,
  LoginPayload,
  TokenResponse,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  ResetPasswordPayload,
  ResetPasswordResponse,
  VerifyLoginSMSPayload,
  VerifyLoginSMSResponse,
} from "../types/auth";

export const authService = {
  async login(payload: LoginPayload): Promise<TokenResponse> {
    const response = await http.post<TokenResponse>("/auth/login", payload);
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
  async resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
    const response = await http.post<ResetPasswordResponse>("/auth/reset-password", payload);
    return response.data;
  },
  async verifyLoginSMS(payload: VerifyLoginSMSPayload): Promise<VerifyLoginSMSResponse> {
    const response = await http.post<VerifyLoginSMSResponse>("/auth/verify-login-sms", payload);
    return response.data;
  },
  async resendLoginSMS(verification_id: string): Promise<{ message: string; verification_id: string }> {
    const response = await http.post<{ message: string; verification_id: string }>("/auth/resend-login-sms", {
      verification_id,
    });
    return response.data;
  },
};
