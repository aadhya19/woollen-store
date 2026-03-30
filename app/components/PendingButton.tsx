"use client";

import { useFormStatus } from "react-dom";

type PendingButtonProps = {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
};

export default function PendingButton({
  idleLabel,
  pendingLabel = "Loading...",
  className,
}: PendingButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
