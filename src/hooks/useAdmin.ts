import { useAuth } from "@/hooks/useAuth";

// Add admin emails here
const ADMIN_EMAILS = [
  "psr21102006@gmail.com",
];

export const useAdmin = () => {
  const { user } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);
  return { isAdmin };
};
