import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import { QRVerificationPage } from "./QRVerificationPage";

vi.mock("../../../services/partner/qr", async () => {
  const actual = await vi.importActual<typeof import("../../../services/partner/qr")>("../../../services/partner/qr");
  return {
    ...actual,
    qrService: {
      ...actual.qrService,
      verify: vi.fn(),
    },
  };
});

vi.mock("../../../services/partner/reservations", async () => {
  const actual = await vi.importActual<typeof import("../../../services/partner/reservations")>(
    "../../../services/partner/reservations",
  );
  return {
    ...actual,
    reservationService: {
      ...actual.reservationService,
      handover: vi.fn(),
      markReturned: vi.fn(),
    },
  };
});

const { qrService } = await import("../../../services/partner/qr");
const { reservationService } = await import("../../../services/partner/reservations");

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    user: userEvent.setup(),
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <QRVerificationPage />
      </QueryClientProvider>,
    ),
  };
};

describe("QRVerificationPage actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("verifies reservation and handles handover and return flows", async () => {
    const verificationResponses = [
      {
        valid: true,
        reservation_id: "res-1",
        locker_id: "locker-1",
        status: "active",
        customer_name: "Misafir",
        customer_phone: "05550000000",
        baggage_count: 1,
        baggage_type: "Bavul",
        handover_at: null,
        returned_at: null,
      },
      {
        valid: true,
        reservation_id: "res-1",
        locker_id: "locker-1",
        status: "active",
        customer_name: "Misafir",
        customer_phone: "05550000000",
        baggage_count: 1,
        baggage_type: "Bavul",
        handover_at: new Date("2025-01-01T10:05:00Z").toISOString(),
        handover_by: "Depo",
        returned_at: null,
      },
      {
        valid: true,
        reservation_id: "res-1",
        locker_id: "locker-1",
        status: "completed",
        customer_name: "Misafir",
        customer_phone: "05550000000",
        baggage_count: 1,
        baggage_type: "Bavul",
        handover_at: new Date("2025-01-01T10:05:00Z").toISOString(),
        returned_at: new Date("2025-01-01T12:00:00Z").toISOString(),
        returned_by: "Misafir",
      },
    ];

    vi.mocked(qrService.verify)
      .mockResolvedValueOnce(verificationResponses[0])
      .mockResolvedValueOnce(verificationResponses[1])
      .mockResolvedValueOnce(verificationResponses[2]);

    vi.mocked(reservationService.handover).mockResolvedValue({
      id: "res-1",
    } as never);
    vi.mocked(reservationService.markReturned).mockResolvedValue({
      id: "res-1",
    } as never);

    const { user } = renderPage();

    const input = screen.getByLabelText(/QR Kodu/i);
    await user.type(input, "QR-123456");

    await user.click(screen.getByRole("button", { name: /Doğrula/i }));

    await waitFor(() => {
      expect(qrService.verify).toHaveBeenCalledWith("QR-123456");
    });
    expect(await screen.findByText(/QR doğrulandı/i)).toBeInTheDocument();

    const handoverButton = await screen.findByRole("button", { name: "Depoya Teslim Alındı" });
    await user.click(handoverButton);

    const handoverModal = await screen.findByRole("dialog");
    const noteField = within(handoverModal).getByLabelText("Not");
    await user.type(noteField, "Depoya teslim edildi");

    await user.click(within(handoverModal).getByRole("button", { name: "Teslimi Kaydet" }));

    await waitFor(() => {
      expect(reservationService.handover).toHaveBeenCalledWith("res-1", {
        evidence_url: undefined,
        notes: "Depoya teslim edildi",
      });
    });
    await waitFor(() => {
      expect(qrService.verify).toHaveBeenCalledTimes(2);
    });

    const returnButton = await screen.findByRole("button", { name: "Misafire Teslim Edildi" });
    await user.click(returnButton);

    const returnModal = await screen.findByRole("dialog");
    const returnNote = within(returnModal).getByLabelText("Not");
    await user.type(returnNote, "Misafir teslim aldı");

    await user.click(within(returnModal).getByRole("button", { name: "İadeyi Kaydet" }));

    await waitFor(() => {
      expect(reservationService.markReturned).toHaveBeenCalledWith("res-1", {
        evidence_url: undefined,
        notes: "Misafir teslim aldı",
      });
    });
    await waitFor(() => {
      expect(qrService.verify).toHaveBeenCalledTimes(3);
    });
  });
});
