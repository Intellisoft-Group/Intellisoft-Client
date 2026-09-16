export default function DashboardLoading() {
  // Plain text only — no skeleton boxes (they flash against the real shell after login/navigation).
  return (
    <p className="page-loading" aria-busy="true" aria-live="polite">
      Loading…
    </p>
  );
}
