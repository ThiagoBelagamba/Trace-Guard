import { DashboardAuthGate } from "../components/DashboardAuthGate";
import { DashboardView } from "../components/DashboardView";

export default function HomePage() {
  return (
    <DashboardAuthGate>
      <DashboardView />
    </DashboardAuthGate>
  );
}
