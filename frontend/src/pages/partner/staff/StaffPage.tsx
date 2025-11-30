import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffService, type Staff, type StaffPayload } from "../../../services/partner/staff";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useToast } from "../../../hooks/useToast";
import { getErrorMessage } from "../../../lib/httpError";
import { http } from "../../../lib/http";

interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface Storage {
  id: string;
  code: string;
  location_id: string;
}

interface Location {
  id: string;
  name: string;
}


export function StaffPage() {
  const { messages, push } = useToast();
  const queryClient = useQueryClient();
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: () => staffService.list(),
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await http.get<User[]>("/users");
      return response.data;
    },
  });

  const storagesQuery = useQuery({
    queryKey: ["storages"],
    queryFn: async () => {
      const response = await http.get<Storage[]>("/storages");
      return response.data;
    },
  });

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await http.get<Location[]>("/locations");
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: StaffPayload) => staffService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      push({ title: "Eleman ataması eklendi", type: "success" });
    },
    onError: (error: unknown) => {
      push({ title: "Kayıt başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<StaffPayload> }) =>
      staffService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      push({ title: "Eleman ataması güncellendi", type: "success" });
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      push({ title: "Eleman ataması silindi", type: "info" });
    },
    onError: (error: unknown) => {
      push({ title: "Silme işlemi başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffPayload>({
    defaultValues: {
      user_id: "",
      storage_ids: [],
      location_ids: [],
    },
  });

  const submit = handleSubmit(async (values) => {
    if (!values.user_id) {
      push({ title: "Kullanıcı seçin", type: "error" });
      return;
    }
    if (editingStaff) {
      await updateMutation.mutateAsync({ id: editingStaff.id, payload: values });
      setEditingStaff(null);
    } else {
      await createMutation.mutateAsync(values);
    }
    reset({ user_id: "", storage_ids: [], location_ids: [] });
  });

  return (
    <section>
      <ToastContainer messages={messages} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Eleman Yönetimi</h2>
          <p style={{ color: "#64748b" }}>Otel elemanlarını yönetin ve depo atamaları yapın</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingStaff(null);
            reset({ user_id: "", storage_ids: [], location_ids: [] });
          }}
          style={{
            border: "none",
            background: "#1d4ed8",
            color: "#fff",
            padding: "0.55rem 1.1rem",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Yeni Eleman Ataması
        </button>
      </div>

      <form
        onSubmit={submit}
        style={{
          marginBottom: "2rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1rem",
          background: "#fff",
          padding: "1.25rem",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
            Kullanıcı
          </label>
          <select
            {...register("user_id", { required: "Kullanıcı zorunlu" })}
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
            }}
          >
            <option value="">Seçiniz</option>
            {usersQuery.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email} ({user.role})
              </option>
            ))}
          </select>
          {errors.user_id && <span style={{ color: "#dc2626", fontSize: "0.75rem" }}>{errors.user_id.message}</span>}
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
            Depolar (Opsiyonel)
          </label>
          <select
            multiple
            {...register("storage_ids")}
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
              minHeight: "100px",
            }}
          >
            {storagesQuery.data?.map((storage) => (
              <option key={storage.id} value={storage.id}>
                {storage.code}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
            Lokasyonlar (Opsiyonel)
          </label>
          <select
            multiple
            {...register("location_ids")}
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
              minHeight: "100px",
            }}
          >
            {locationsQuery.data?.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ alignSelf: "end" }}>
          <button
            type="submit"
            style={{
              border: "none",
              background: "#16a34a",
              color: "#fff",
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {editingStaff ? "Güncelle" : "Kaydet"}
          </button>
        </div>
      </form>

      {/* Staff list */}
      {staffQuery.isLoading ? (
        <div>Yükleniyor...</div>
      ) : staffQuery.isError ? (
        <div style={{ color: "#dc2626" }}>Elemanlar yüklenemedi</div>
      ) : staffQuery.data && staffQuery.data.length > 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  Kullanıcı
                </th>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  Atanan Depolar
                </th>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  Atanan Lokasyonlar
                </th>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody>
              {staffQuery.data.map((staff) => {
                const user = usersQuery.data?.find((u) => u.id === staff.user_id);
                return (
                  <tr key={staff.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "1rem", fontSize: "0.9rem" }}>{user?.email || staff.user_id}</td>
                    <td style={{ padding: "1rem", fontSize: "0.9rem" }}>
                      {staff.assigned_storage_ids.length > 0
                        ? staff.assigned_storage_ids
                            .map(
                              (id) =>
                                storagesQuery.data?.find((s) => s.id === id)?.code || id.substring(0, 8) + "..."
                            )
                            .join(", ")
                        : "-"}
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.9rem" }}>
                      {staff.assigned_location_ids.length > 0
                        ? staff.assigned_location_ids
                            .map(
                              (id) =>
                                locationsQuery.data?.find((l) => l.id === id)?.name || id.substring(0, 8) + "..."
                            )
                            .join(", ")
                        : "-"}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        <button
                          type="button"
                          style={{ border: "none", background: "none", color: "#1d4ed8", cursor: "pointer" }}
                          onClick={() => {
                            setEditingStaff(staff);
                            reset({
                              user_id: staff.user_id,
                              storage_ids: staff.assigned_storage_ids,
                              location_ids: staff.assigned_location_ids,
                            });
                          }}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer" }}
                          onClick={() => deleteMutation.mutate(staff.id)}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            padding: "3rem",
            borderRadius: "12px",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          <p>Henüz eleman ataması bulunmuyor</p>
        </div>
      )}
    </section>
  );
}

