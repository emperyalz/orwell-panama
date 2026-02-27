interface RoleBadgeProps {
  role: string;
  roleCategory: string;
}

const ROLE_COLORS: Record<string, string> = {
  Deputy: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Governor: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Mayor: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  President: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function RoleBadge({ role, roleCategory }: RoleBadgeProps) {
  const colorClass = ROLE_COLORS[roleCategory] || ROLE_COLORS.Deputy;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {role}
    </span>
  );
}
