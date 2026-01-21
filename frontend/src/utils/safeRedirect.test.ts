import { describe, expect, it } from "vitest";

import { sanitizeRedirect } from "./safeRedirect";

describe("sanitizeRedirect", () => {
  it("rejects lookalike domains", () => {
    expect(sanitizeRedirect("https://evil-kyradi.com")).toBe("/app");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeRedirect("//evil.com")).toBe("/app");
  });

  it("accepts relative paths", () => {
    expect(sanitizeRedirect("/app/users")).toBe("/app/users");
  });

  it("accepts kyradi subdomains", () => {
    expect(sanitizeRedirect("https://x.kyradi.com/app")).toBe("https://x.kyradi.com/app");
  });
});
