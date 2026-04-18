// src/types/profile.ts
export type Profile = {
  fullName?: string;
  dob?: string | null;
  phone?: string | null;
  address?: string | null;
  sex?: "male" | "female" | "other" | "prefer_not_to_say" | null;
};
