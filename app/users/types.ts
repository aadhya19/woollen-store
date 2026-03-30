/** Row from public.Roles */
export type RoleRow = {
  id: string;
  role: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.Users (role is FK → Roles.id) */
export type UserRow = {
  id: string;
  name: string | null;
  username: string | null;
  password: string | null;
  role: string | null;
  created_at: string;
  updated_at: string | null;
};
