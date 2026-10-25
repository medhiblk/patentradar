import { AppNavigation } from "@/components/app-navigation";
import { PrivateWorkspace } from "@/components/private-workspace";
export default function Files() {
  return (
    <>
      <AppNavigation page="My Inventions" />
      <main className="developer-page" id="main-content">
        <PrivateWorkspace />
      </main>
    </>
  );
}
