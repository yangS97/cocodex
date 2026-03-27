import { StatusCenterView } from "@/components/status/status-center";
import { buildStatusCenterSnapshot } from "@/lib/features/status/status-center";
import { getServerTranslator } from "@/lib/i18n/i18n";
import { requireAuth } from "@/lib/auth/require-admin";

export const revalidate = 60;

export default async function StatusPage() {
  const session = await requireAuth("/status");
  const { locale, t } = await getServerTranslator();

  try {
    const snapshot = await buildStatusCenterSnapshot({ session, locale, t });
    return <StatusCenterView snapshot={snapshot} t={t} />;
  } catch (error) {
    return (
      <main className="flex w-full flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
        <h1 className="text-2xl font-bold">{t("status.failedLoadStatus")}</h1>
        <pre className="overflow-auto rounded-md border p-4 text-xs">
          {error instanceof Error ? error.message : String(error)}
        </pre>
      </main>
    );
  }
}
