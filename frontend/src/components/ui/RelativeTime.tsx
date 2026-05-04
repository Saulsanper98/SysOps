import { timeAgo, formatDate } from "../../lib/utils";

export function RelativeTime({ date }: { date: string | Date }) {
  const abs = formatDate(date);
  return (
    <span title={abs} className="tabular-nums">
      {timeAgo(date)}
    </span>
  );
}
