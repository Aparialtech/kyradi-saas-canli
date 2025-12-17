import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import { ReservationsPage } from "./ReservationsPage";
import type { Reservation } from "../../../services/partner/reservations";

vi.mock("../../../services/partner/reservations", async () => {
  const actual = await vi.importActual<typeof import("../../../services/partner/reservations")>(
    "../../../services/partner/reservations",
  );
  return {
    ...actual,
    reservationService: {
      ...actual.reservationService,
      list: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
    },
  };
});

const { reservationService } = await import("../../../services/partner/reservations");

const renderWithClient = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return {
    user: userEvent.setup(),
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
};

const widgetReservation: Reservation = {
  id: 101,
  status: "pending",
  tenant_id: "tenant-1",
  checkin_date: "2025-01-01",
  checkout_date: "2025-01-02",
  baggage_count: 2,
  guest_name: "Ali Veli",
  guest_email: "ali@example.com",
  guest_phone: "+905551112233",
  notes: null,
  origin: "https://booking.hotel.example",
  created_at: new Date("2025-01-01T08:00:00Z").toISOString(),
};

describe("ReservationsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders widget reservations", async () => {
    vi.mocked(reservationService.list).mockResolvedValue([widgetReservation]);
    const { user } = renderWithClient(<ReservationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Widget Rezervasyonları")).toBeInTheDocument();
    });

    expect(await screen.findByText(widgetReservation.guest_name!)).toBeInTheDocument();
    expect(screen.getByText(widgetReservation.origin!)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Durum"), "pending");
    expect(reservationService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("allows confirming and cancelling reservations", async () => {
    vi.mocked(reservationService.list).mockResolvedValue([widgetReservation]);
    vi.mocked(reservationService.confirm).mockResolvedValue({ ...widgetReservation, status: "confirmed" });
    vi.mocked(reservationService.cancel).mockResolvedValue({ ...widgetReservation, status: "cancelled" });

    renderWithClient(<ReservationsPage />);

    const confirmButton = await screen.findByRole("button", { name: /Onayla/i });
    await userEvent.click(confirmButton);
    await waitFor(() => {
      expect(reservationService.confirm).toHaveBeenCalledWith(widgetReservation.id);
    });

    const cancelButton = await screen.findByRole("button", { name: /İptal/i });
    await userEvent.click(cancelButton);
    await waitFor(() => {
      expect(reservationService.cancel).toHaveBeenCalledWith(widgetReservation.id);
    });
  });
});
