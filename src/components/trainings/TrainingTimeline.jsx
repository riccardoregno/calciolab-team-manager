import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import { useTranslation } from "../../i18n";

function TrainingTimeline({ exercises = [] }) {
  const { t } = useTranslation();
  const totalMinutes = exercises.reduce(
    (sum, item) => sum + Number(item.customDuration || item.duration || 0),
    0
  );

  if (exercises.length === 0) {
    return (
      <AppCard>
        <h3 style={{ marginTop: 0 }}>{t("components.trainingTimeline.title")}</h3>
        <p style={{ color: "#94a3b8" }}>
          {t("components.trainingTimeline.emptyText")}
        </p>
      </AppCard>
    );
  }

  const timelineBlocks = exercises.reduce((blocks, item, index) => {
    const duration = Number(item.customDuration || item.duration || 0);
    const start = blocks[index - 1]?.end || 0;
    const end = start + duration;

    return [...blocks, { item, index, duration, start, end }];
  }, []);

  return (
    <AppCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{t("components.trainingTimeline.title")}</h3>
          <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>
            {t("components.trainingTimeline.subtitle")}
          </p>
        </div>

        <Badge tone="blue">{totalMinutes} min</Badge>
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(90deg,#38bdf8,#2563eb)",
          }}
        />
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {timelineBlocks.map(({ item, index, duration, start, end }) => {
          return (
            <div
              key={`${item.exerciseId || item.id}-${index}`}
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "78px 1fr",
                gap: 14,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  color: "#94a3b8",
                  fontWeight: 900,
                  fontSize: 13,
                  paddingTop: 14,
                }}
              >
                {start}' - {end}'
              </div>

              <div
                style={{
                  borderRadius: 20,
                  padding: 16,
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))",
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: 16 }}>
                    {item.title || item.name || `Esercizio ${index + 1}`}
                  </strong>

                  <Badge tone={index === 0 ? "green" : index === exercises.length - 1 ? "orange" : "purple"}>
                    {duration} min
                  </Badge>
                </div>

                <p
                  style={{
                    color: "#94a3b8",
                    margin: "8px 0 0",
                    fontSize: 14,
                  }}
                >
                  {item.category || item.objective || item.variantNotes || t("components.trainingTimeline.trainingBlock")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </AppCard>
  );
}

export default TrainingTimeline;
