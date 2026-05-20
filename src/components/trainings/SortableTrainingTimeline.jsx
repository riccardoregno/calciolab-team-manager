import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import { useTranslation } from "../../i18n";

function SortableTrainingTimeline({ exercises = [], onReorder }) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const ids = exercises.map((item, index) =>
    String(item.exerciseId || item.id || index)
  );

  const totalMinutes = exercises.reduce(
    (sum, item) => sum + Number(item.customDuration || item.duration || 0),
    0
  );

  function handleDragEnd(event) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));

    onReorder(arrayMove(exercises, oldIndex, newIndex));
  }

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

  const timeline = exercises.reduce(
    (acc, item, index) => {
      const duration = Number(item.customDuration || item.duration || 0);
      const start = acc.currentMinute;
      const end = start + duration;

      acc.items.push({
        item,
        index,
        duration,
        start,
        end,
        id: String(item.exerciseId || item.id || index),
      });
      acc.currentMinute = end;

      return acc;
    },
    { currentMinute: 0, items: [] }
  ).items;

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
            {t("components.trainingTimeline.dragSubtitle")}
          </p>
        </div>

        <Badge tone="blue">{totalMinutes} min</Badge>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={ids}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {timeline.map(({ item, index, duration, start, end, id }) => {
              return (
                <SortableTimelineItem
                  key={id}
                  id={id}
                  item={item}
                  index={index}
                  start={start}
                  end={end}
                  duration={duration}
                  total={exercises.length}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </AppCard>
  );
}

function SortableTimelineItem({ id, item, index, start, end, duration, total }) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
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
          border: isDragging
            ? "1px solid rgba(56,189,248,0.45)"
            : "1px solid rgba(255,255,255,0.10)",
          boxShadow: isDragging
            ? "0 24px 70px rgba(56,189,248,0.20)"
            : "0 16px 40px rgba(0,0,0,0.18)",
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
          <div>
  <div className="print-only" style={{ fontWeight: 800, marginBottom: 6 }}>
    {t("components.trainingTimeline.exerciseN", { n: index + 1 })}
  </div>

  <strong style={{ fontSize: 16 }}>
    {item.title || item.name || t("components.trainingTimeline.exerciseN", { n: index + 1 })}
  </strong>

            <p
              style={{
                color: "#94a3b8",
                margin: "8px 0 0",
                fontSize: 14,
              }}
            >
              {item.category ||
                item.objective ||
                item.variantNotes ||
                t("components.trainingTimeline.trainingBlock")}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge
              tone={
                index === 0
                  ? "green"
                  : index === total - 1
                  ? "orange"
                  : "purple"
              }
            >
              {duration} min
            </Badge>

            <button
              {...attributes}
              {...listeners}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                cursor: "grab",
                fontWeight: 900,
              }}
              title="Trascina"
            >
              ⋮⋮
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SortableTrainingTimeline;
