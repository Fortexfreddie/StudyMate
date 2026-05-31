import type { User } from "@/lib/types";

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "mock-id",
    email: "student@futo.edu",
    full_name: "Esther John",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
