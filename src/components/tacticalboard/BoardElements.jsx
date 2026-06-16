import { useTranslation } from "../../i18n";
import { useDraggable } from "@dnd-kit/core";
import { boardStyles } from "../../styles/tacticalBoard";
import { getCompatibleRoles, getLastName } from "../../utils/tacticalBoardHelpers";

export function FieldObjectIcon({ type }) {
  if (type === "ball") return (
    <svg viewBox="0 0 36 36" width="30" height="30" style={{ display: "block" }}>
      <defs>
        <radialGradient id="ballLight" cx="33%" cy="26%" r="72%">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="0.66" stopColor="#e5e7eb" />
          <stop offset="1" stopColor="#64748b" />
        </radialGradient>
      </defs>
      <circle cx="18" cy="18" r="15" fill="url(#ballLight)" stroke="#0f172a" strokeWidth="1.1" />
      <path d="M18 7 L24 12 L22 20 H14 L12 12 Z" fill="#0f172a" opacity="0.95" />
      <path d="M18 7 C14 8 12 10 12 12 M18 7 C22 8 24 10 24 12 M14 20 C15 23 21 23 22 20" stroke="#f8fafc" strokeWidth="1.2" fill="none" opacity="0.65" />
      <path d="M12 12 L5 10 M24 12 L31 10 M14 20 L9 28 M22 20 L27 28" stroke="#0f172a" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.78" />
      <path d="M5 10 C6 6 10 4 14 3 M31 10 C30 6 26 4 22 3 M9 28 C14 32 22 32 27 28" stroke="#0f172a" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
  if (type === "cone") return (
    <svg viewBox="0 0 22 24" width="22" height="24" style={{ display: "block" }}>
      <polygon points="11,1 21,23 1,23" fill="#f97316" />
      <ellipse cx="11" cy="23" rx="8" ry="2" fill="#ea580c" />
      <line x1="5" y1="14" x2="17" y2="14" stroke="white" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
  if (type === "goal") return (
    <svg viewBox="0 0 54 34" width="48" height="30" style={{ display: "block" }}>
      <path d="M5 29 V7 H49 V29" fill="none" stroke="#f8fafc" strokeWidth="3" strokeLinejoin="round" />
      <path d="M9 29 V11 H45 V29" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.2" />
      <path d="M13 11 V29 M21 11 V29 M29 11 V29 M37 11 V29 M9 17 H45 M9 23 H45" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
      <path d="M5 29 H49" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (type === "pole") return (
    <svg viewBox="0 0 14 38" width="14" height="38" style={{ display: "block" }}>
      <rect x="5" y="0" width="4" height="38" rx="2" fill="#fbbf24" />
      <rect x="5" y="0" width="4" height="8" rx="2" fill="#ef4444" />
      <rect x="5" y="8" width="4" height="8" fill="white" />
      <rect x="5" y="16" width="4" height="8" fill="#ef4444" />
    </svg>
  );
  if (type === "hurdle") return (
    <svg viewBox="0 0 40 26" width="38" height="24" style={{ display: "block" }}>
      <path d="M7 23 V8 H33 V23" fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 8 H30" stroke="#f8fafc" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 23 H13 M27 23 H33" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (type === "ring") return (
    <svg viewBox="0 0 34 34" width="32" height="32" style={{ display: "block" }}>
      <circle cx="17" cy="17" r="12" fill="none" stroke="#fbbf24" strokeWidth="4" />
      <circle cx="17" cy="17" r="8" fill="rgba(251,191,36,0.08)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" />
    </svg>
  );
  if (type === "ladder") return (
    <svg viewBox="0 0 58 28" width="54" height="26" style={{ display: "block" }}>
      <path d="M5 5 H53 M5 23 H53" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 5 V23 M23 5 V23 M33 5 V23 M43 5 V23" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  return null;
}

export function TacticalPlayerIcon({ player, isOpponent, isRealPlayer }) {
  const palette = isOpponent
    ? { shirt: "#ef4444", sleeve: "#b91c1c", trim: "#fee2e2", text: "#fff1f2", skin: "#f2c19b", hair: "#3f2212" }
    : isRealPlayer
      ? { shirt: "#3b82f6", sleeve: "#1d4ed8", trim: "#dbeafe", text: "#eff6ff", skin: "#f2c19b", hair: "#3f2212" }
      : { shirt: "#2563eb", sleeve: "#1e40af", trim: "#dbeafe", text: "#eff6ff", skin: "#f2c19b", hair: "#3f2212" };

  return (
    <svg viewBox="0 0 58 70" width="58" height="70" aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`shirt-${player.id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={palette.shirt} />
          <stop offset="1" stopColor={palette.sleeve} />
        </linearGradient>
      </defs>
      <ellipse cx="29" cy="66" rx="20" ry="4.4" fill="rgba(0,0,0,0.34)" />
      <path
        d="M12 30 L4 43 Q6 48 13 47 L16 40 Z"
        fill={palette.sleeve}
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M46 30 L54 43 Q52 48 45 47 L42 40 Z"
        fill={palette.sleeve}
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M12 62 L14 31 Q19 26 24 25 L29 32 L34 25 Q39 26 44 31 L46 62 Z"
        fill={`url(#shirt-${player.id})`}
        stroke="rgba(255,255,255,0.96)"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M22.5 27.5 L29 34.5 L35.5 27.5"
        fill="none"
        stroke={palette.trim}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 38 H41" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
      <text
        x="29"
        y="49"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="17"
        fontWeight="950"
        fontFamily="system-ui,sans-serif"
        fill={palette.text}
      >
        {player.number}
      </text>
      <circle cx="29" cy="16" r="12" fill={palette.skin} stroke="rgba(255,255,255,0.96)" strokeWidth="3" />
      <path d="M17.2 15.5 Q19 5.2 29 4.8 Q39 5.2 40.8 15.5 Q35 10.7 29 11 Q23 10.7 17.2 15.5Z" fill={palette.hair} opacity="0.72" />
      <circle cx="24.6" cy="17" r="1.25" fill="rgba(30,15,5,0.62)" />
      <circle cx="33.4" cy="17" r="1.25" fill="rgba(30,15,5,0.62)" />
      <path d="M25 22 Q29 24.4 33 22" fill="none" stroke="rgba(30,15,5,0.36)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LineHandle({ x, y, onStart, fill = "#0f172a" }) {
  return (
    <circle
      data-board-token="true"
      cx={`${x}%`}
      cy={`${y}%`}
      r="1.4"
      fill={fill}
      stroke="#ffffff"
      strokeWidth="0.45"
      onPointerDown={onStart}
      style={{ cursor: "grab" }}
    />
  );
}

export function ShapeHandles({ points, onStart }) {
  return (
    <>
      <line
        x1={`${points.rotate.x}%`}
        y1={`${points.rotate.y}%`}
        x2={`${(points.start.x + points.end.x) / 2}%`}
        y2={`${(points.start.y + points.end.y) / 2}%`}
        stroke="#ffffff"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeDasharray="4 3"
        opacity="0.8"
      />
      <LineHandle x={points.start.x} y={points.start.y} onStart={(event) => onStart(event, "corner-start")} />
      <LineHandle x={points.end.x} y={points.end.y} onStart={(event) => onStart(event, "corner-end")} />
      <LineHandle x={points.startEnd.x} y={points.startEnd.y} onStart={(event) => onStart(event, "corner-start-end")} />
      <LineHandle x={points.endStart.x} y={points.endStart.y} onStart={(event) => onStart(event, "corner-end-start")} />
      <circle
        data-board-token="true"
        cx={`${points.rotate.x}%`}
        cy={`${points.rotate.y}%`}
        r="1.4"
        fill="#fbbf24"
        stroke="#111827"
        strokeWidth="0.45"
        onPointerDown={(event) => onStart(event, "rotate")}
        style={{ cursor: "grab" }}
      />
    </>
  );
}

// ─── Oggetto campo draggable ──────────────────────────────────────────────────
export function FieldObject({ obj, activeTool, selected, onSelect, onEditStart, onRemove }) {
  const { t } = useTranslation();
  const isDraggable = activeTool === "move" || selected;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: obj.id,
    disabled: !isDraggable,
  });

  return (
    <div
      ref={setNodeRef}
      data-board-token="true"
      title={t("pages.tacticalBoard.playerDoubleClickHint")}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onRemove(obj.id);
      }}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      style={{
        position: "absolute",
        left: `${obj.x}%`,
        top: `${obj.y}%`,
        transform: transform
          ? `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) rotate(${obj.rotation ?? 0}deg) scale(${obj.scale ?? 1})`
          : `translate(-50%, -50%) rotate(${obj.rotation ?? 0}deg) scale(${obj.scale ?? 1})`,
        zIndex: 20,
        cursor: isDraggable ? "grab" : "crosshair",
        userSelect: "none",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
        outline: selected ? "2px solid rgba(255,255,255,0.9)" : "none",
        outlineOffset: 5,
        borderRadius: 10,
      }}
    >
      <FieldObjectIcon type={obj.type} />
      {obj.text ? (
        <span style={{
          position: "absolute",
          bottom: -20,
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize: 12,
          fontWeight: 800,
          color: "white",
          textShadow: "0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.7)",
          pointerEvents: "none",
          letterSpacing: "0.04em",
          lineHeight: 1,
        }}>
          {obj.text}
        </span>
      ) : null}
      {selected && (
        <>
          <button
            type="button"
            data-board-token="true"
            title={t("pages.tacticalBoard.deleteTip")}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(obj.id);
            }}
            style={{ ...boardStyles.objectHandle, right: -16, top: -16, background: "#ef4444", color: "white", fontSize: 14, fontWeight: 900 }}
          >
            ✕
          </button>
          <button
            type="button"
            data-board-token="true"
            title={t("pages.tacticalBoard.scaleTip")}
            onPointerDown={(event) => onEditStart(event, { kind: "object", id: obj.id, action: "scale" })}
            style={{ ...boardStyles.objectHandle, right: -14, bottom: -14, cursor: "nwse-resize" }}
          />
          <button
            type="button"
            data-board-token="true"
            title={t("pages.tacticalBoard.rotateTip")}
            onPointerDown={(event) => onEditStart(event, { kind: "object", id: obj.id, action: "rotate" })}
            style={{ ...boardStyles.objectHandle, left: "50%", top: -24, transform: "translateX(-50%)", background: "#fbbf24" }}
          />
        </>
      )}
    </div>
  );
}

export function DraggablePlayer({
  player,
  onRemove,
  selectedSlotId,
  onSelectSlot,
  selectedBenchPlayer,
  onAssignToSlot,
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: player.id,
  });

  const isOwn = player.team === "own";
  const isOpponent = player.team === "opponent";
  const isRealPlayer = Boolean(player.realPlayerId);

  const compatibleRoles = selectedBenchPlayer
    ? getCompatibleRoles(selectedBenchPlayer.role)
    : [];

  const isCompatible =
    selectedBenchPlayer &&
    isOwn &&
    !isRealPlayer &&
    compatibleRoles.includes(player.slotRole);

  const style = {
    ...boardStyles.player,
    ...(isOwn ? boardStyles.ownPlayer : {}),
    ...(isOpponent ? boardStyles.opponentPlayer : {}),
    ...(isRealPlayer ? boardStyles.realPlayer : {}),
    ...(selectedSlotId === player.id ? boardStyles.selectedPlayer : {}),
    ...(isCompatible ? boardStyles.compatiblePlayer : {}),
    left: `${player.x}%`,
    top: `${player.y}%`,
    transform: transform
      ? `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px)`
      : "translate(-50%, -50%)",
  };

  return (
    <div
      ref={setNodeRef}
      data-board-token="true"
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (selectedBenchPlayer && isOwn && !isRealPlayer) {
          onAssignToSlot(player);
          return;
        }

        if (isOwn && !isRealPlayer) {
          onSelectSlot(player.id);
        }
      }}
      onDoubleClick={() => isRealPlayer && onRemove(player)}
      title={isRealPlayer ? t("pages.tacticalBoard.playerDoubleClickHint") : t("pages.tacticalBoard.playerDragHint")}
    >
      <TacticalPlayerIcon player={player} isOpponent={isOpponent} isRealPlayer={isRealPlayer} />
      {selectedSlotId === player.id && (
        <div style={boardStyles.playerTooltip}>
          <strong>{isRealPlayer ? getLastName(player.name) : player.slotRole}</strong>
          <span>{isRealPlayer ? player.role : "Slot"}</span>
        </div>
      )}
    </div>
  );
}

export function Note({ title, value, onChange }) {
  return (
    <div style={boardStyles.note}>
      <strong style={{ fontSize: 13, color: "#e2e8f0" }}>{title}</strong>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={boardStyles.noteTextarea}
        rows={3}
      />
    </div>
  );
}

export function ToolButton({ icon, active, onClick, title, style: extraStyle }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        border: active
          ? "1px solid rgba(59,130,246,0.7)"
          : "1px solid rgba(255,255,255,0.08)",
        background: active
          ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
          : "rgba(255,255,255,0.04)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "opacity 0.2s, box-shadow 0.2s",
        boxShadow: active
          ? "0 10px 30px rgba(37,99,235,0.35)"
          : "none",
        ...extraStyle,
      }}
    >
      {icon}
    </button>
  );
}
