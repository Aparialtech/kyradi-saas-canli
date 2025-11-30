import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto as Crypto;
}

if (typeof globalThis.crypto.randomUUID !== "function") {
  globalThis.crypto.randomUUID = () => "00000000-0000-4000-8000-000000000000";
}

if (typeof window.URL.createObjectURL !== "function") {
  window.URL.createObjectURL = () => "blob:mock";
}

if (typeof window.HTMLElement.prototype.scrollIntoView !== "function") {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
