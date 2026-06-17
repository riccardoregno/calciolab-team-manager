import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DndContext } from "@dnd-kit/core";
import AppCard from "../components/ui/AppCard";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { styles } from "../styles/index.js";
import { ArrowRight, Move, Pause, Play, Plus, Undo2 } from "lucide-react";
import { emptyExercise } from "../data/initialData";
import { createUuid } from "../utils/helpers";
import { useTranslation } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";
import { boardStyles } from "../styles/tacticalBoard";
import {
  getCompatibleRoles,
  DRAW_COLORS,
  FIELD_REFERENCE_SIZE,
  defaultAreaSize,
  colorId,
  formationOptions,
  fallbackPlayers,
  clamp,
  buildBoard,
  clampBoard,
  makeShapeId,
  normalizeLines,
  normalizeBoardObjects,
  getShapeBounds,
  rotatePoint,
  getAngle,
  getSelectedShape,
  getSelectedObject,
  buildFrameSnapshot,
  clampAreaSize,
  normalizeAreaSize,
  easeInOut,
  interpolateItems,
} from "../utils/tacticalBoardHelpers";
import {
  LineHandle,
  ShapeHandles,
  FieldObject,
  DraggablePlayer,
  Note,
  ToolButton,
} from "../components/tacticalboard/BoardElements";
import {
  EXERCISE_MODAL,
  EXERCISE_DRAFT_KEY,
  defaultNotes,
  loadSaved,
  saveToStorage,
  loadExerciseDraftName,
  clearExerciseDraftName,
  loadSchemas,
  persistSchemas,
  PRESET_SCHEMAS,
} from "../utils/tacticalBoardStorage";

// Caricato una sola volta al mount del modulo
const _saved = loadSaved();

export default function TacticalBoard({
  players = [], setExercises }) {

  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { showToast, ToastContainer } = useToast();
  const searchParams = new URLSearchParams(location.search);
  const isExerciseModalRoute = searchParams.get("modal") === EXERCISE_MODAL;

  // Quando si arriva da Exercises con ?edit=<exerciseId>
  const editingExerciseId   = location.state?.exerciseId   ?? null;
  const editingExerciseName = location.state?.exerciseName ?? null;

  // Quando si arriva da SetPlays per disegnare uno schema
  const setPlaySection = location.state?.setPlaySection ?? null;
  const setPlayLabel   = location.state?.setPlayLabel   ?? null;

  const [ownFormation, setOwnFormation] = useState(_saved?.ownFormation ?? "4-2-3-1");
  const [opponentFormation, setOpponentFormation] = useState(_saved?.opponentFormation ?? "Nessuno");
  const [selectedLineup, setSelectedLineup] = useState(_saved?.selectedLineup ?? []);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [selectedBenchPlayer, setSelectedBenchPlayer] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTool, setActiveTool] = useState("move");
  const [lines, setLines] = useState(() => normalizeLines(_saved?.lines ?? []));
  const [drawingLine, setDrawingLine] = useState(null);
  const [editDrag, setEditDrag] = useState(null);
  const [notes, setNotes] = useState(_saved?.notes ?? defaultNotes);
  const [boardObjects, setBoardObjects] = useState(() => normalizeBoardObjects(_saved?.boardObjects ?? []));
  const [drawColor, setDrawColor] = useState("white");
  const [areaSize, setAreaSize] = useState(() => normalizeAreaSize(_saved?.areaSize ?? _saved?.fieldSize ?? defaultAreaSize));
  const [boardFrames, setBoardFrames] = useState(_saved?.boardFrames ?? []);
  const [activeFrameId, setActiveFrameId] = useState(_saved?.activeFrameId ?? "");
  const [isPlayingFrames, setIsPlayingFrames] = useState(false);
  const [savedSchemas, setSavedSchemas] = useState(() => loadSchemas());
  const [mobileFullscreen, setMobileFullscreen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [fieldTheme, setFieldTheme] = useState(_saved?.fieldTheme ?? "auto");
  const [schemaName, setSchemaName] = useState("");
  const [schemaSaved, setSchemaSaved] = useState(false);

  // ── Esercizio da lavagna ──────────────────────────────────────────────────────
  const [exModalOpen, setExModalOpen] = useState(!!editingExerciseId);
  const [exName,      setExName]      = useState(() => loadExerciseDraftName(editingExerciseName ?? ""));
  const [exFeedback,  setExFeedback]  = useState(null); // { ok: bool, text: string }

  // ── Undo stack (session-only, non persiste) ───────────────────────────────────
  const [undoStack, setUndoStack] = useState([]);

  const availablePlayers = players.length ? players : fallbackPlayers;

  const [boardPlayers, setBoardPlayers] = useState(() =>
    _saved?.boardPlayers ?? buildBoard("4-2-3-1", "Nessuno")
  );

  useEffect(() => {
    if (!isExerciseModalRoute) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExModalOpen(true);
  }, [isExerciseModalRoute]);

  useEffect(() => {
    if (!exModalOpen || editingExerciseId) return;
    try {
      localStorage.setItem(EXERCISE_DRAFT_KEY, exName);
    } catch {
      // storage unavailable — silently ignore
    }
  }, [editingExerciseId, exModalOpen, exName]);

  // Auto-salvataggio: persiste formazione, posizioni, linee, note e titolari
  useEffect(() => {
    saveToStorage({
      ownFormation,
      opponentFormation,
      boardPlayers,
      lines,
      notes,
      selectedLineup,
      boardObjects,
      areaSize,
      boardFrames,
      activeFrameId,
      fieldTheme,
    });
  }, [ownFormation, opponentFormation, boardPlayers, lines, notes, selectedLineup, boardObjects, areaSize, boardFrames, activeFrameId, fieldTheme]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!selectedItem) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (event.target?.tagName === "TEXTAREA" || event.target?.tagName === "INPUT") return;

      event.preventDefault();
      if (selectedItem.kind === "shape") {
        setLines((prev) => prev.filter((shape) => shape.id !== selectedItem.id));
      }
      if (selectedItem.kind === "object") {
        setBoardObjects((prev) => prev.filter((obj) => obj.id !== selectedItem.id));
      }
      setSelectedItem(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem]);

  useEffect(() => {
    if (!isPlayingFrames || boardFrames.length < 2) return undefined;

    let cancelled = false;
    let animationId = 0;
    let nextStepTimer = 0;

    function showFrame(frame) {
      setBoardPlayers(frame.boardPlayers ?? []);
      setLines(normalizeLines(frame.lines ?? []));
      setBoardObjects(normalizeBoardObjects(frame.boardObjects ?? []));
      setNotes(frame.notes ?? defaultNotes);
      setSelectedItem(null);
      setActiveFrameId(frame.id);
    }

    function playStep(index) {
      if (cancelled) return;
      if (index >= boardFrames.length - 1) {
        showFrame(boardFrames[boardFrames.length - 1]);
        setIsPlayingFrames(false);
        return;
      }

      const fromFrame = boardFrames[index];
      const toFrame = boardFrames[index + 1];
      const fromPlayers = fromFrame.boardPlayers ?? [];
      const toPlayers = toFrame.boardPlayers ?? [];
      const fromObjects = normalizeBoardObjects(fromFrame.boardObjects ?? []);
      const toObjects = normalizeBoardObjects(toFrame.boardObjects ?? []);
      const startedAt = performance.now();
      const duration = 900;

      setLines(normalizeLines(toFrame.lines ?? []));
      setNotes(toFrame.notes ?? defaultNotes);
      setSelectedItem(null);

      function animate(now) {
        if (cancelled) return;
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = easeInOut(progress);

        setBoardPlayers(interpolateItems(fromPlayers, toPlayers, eased));
        setBoardObjects(interpolateItems(fromObjects, toObjects, eased));
        setActiveFrameId(progress < 1 ? fromFrame.id : toFrame.id);

        if (progress < 1) {
          animationId = window.requestAnimationFrame(animate);
          return;
        }

        showFrame(toFrame);
        nextStepTimer = window.setTimeout(() => playStep(index + 1), 180);
      }

      animationId = window.requestAnimationFrame(animate);
    }

    const activeIndex = boardFrames.findIndex((frame) => frame.id === activeFrameId);
    const startIndex = activeIndex >= 0 && activeIndex < boardFrames.length - 1 ? activeIndex : 0;
    playStep(startIndex);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationId);
      window.clearTimeout(nextStepTimer);
    };
  }, [activeFrameId, boardFrames, isPlayingFrames]);

  const ownCount = boardPlayers.filter((p) => p.team === "own").length;
  const opponentCount = boardPlayers.filter((p) => p.team === "opponent").length;
  const selectedShape = getSelectedShape(lines, selectedItem);
  const selectedObject = getSelectedObject(boardObjects, selectedItem);
  const mobileFullscreenActive = isMobile && mobileFullscreen;
  const activeFieldTheme = fieldTheme === "auto" ? (mobileFullscreenActive ? "grey" : "green") : fieldTheme;
  const fieldThemeStyle = FIELD_THEMES[activeFieldTheme]?.style ?? FIELD_THEMES.green.style;
  const benchPlayers = availablePlayers.filter((player) => !selectedLineup.some((selected) => selected.id === player.id));

  // ── Undo helpers ─────────────────────────────────────────────────────────────
  function pushHistory(currentLines, currentObjects, currentPlayers) {
    setUndoStack((prev) => [
      ...prev.slice(-49),
      { lines: currentLines, boardObjects: currentObjects, boardPlayers: currentPlayers },
    ]);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setLines(snapshot.lines);
    setBoardObjects(snapshot.boardObjects);
    setBoardPlayers(snapshot.boardPlayers);
    setSelectedItem(null);
    setUndoStack((prev) => prev.slice(0, -1));
  }

  function deleteSelectedItem() {
    if (!selectedItem) return;
    pushHistory(lines, boardObjects, boardPlayers);

    if (selectedItem.kind === "shape") {
      setLines((prev) => prev.filter((shape) => shape.id !== selectedItem.id));
    }

    if (selectedItem.kind === "object") {
      setBoardObjects((prev) => prev.filter((obj) => obj.id !== selectedItem.id));
    }

    setSelectedItem(null);
  }

  function applyFormations(nextOwn, nextOpponent) {
    setBoardPlayers(buildBoard(nextOwn, nextOpponent));
    setSelectedLineup([]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);
  }

  function changeOwnFormation(value) {
    setOwnFormation(value);
    applyFormations(value, opponentFormation);
  }

  function changeOpponentFormation(value) {
    setOpponentFormation(value);
    applyFormations(ownFormation, value);
  }

  function handleDragEnd(event) {
    const { active, delta } = event;
    const board = document.getElementById("tactical-board-field");
    if (!board) return;

    const rect = board.getBoundingClientRect();
    const dx = (delta.x / rect.width) * 100;
    const dy = (delta.y / rect.height) * 100;

    pushHistory(lines, boardObjects, boardPlayers);

    if (String(active.id).startsWith("obj-")) {
      setBoardObjects((prev) =>
        prev.map((obj) =>
          obj.id !== active.id ? obj : { ...obj, x: clamp(obj.x + dx), y: clamp(obj.y + dy) }
        )
      );
      setSelectedItem({ kind: "object", id: String(active.id) });
    } else {
      setBoardPlayers((prev) =>
        prev.map((player) =>
          player.id !== active.id ? player : { ...player, x: clamp(player.x + dx), y: clamp(player.y + dy) }
        )
      );
    }
  }
  function getBoardCoordinates(event) {
    const board = document.getElementById("tactical-board-field");

    if (!board) return null;

    const rect = board.getBoundingClientRect();

    return {
      x: clampBoard(((event.clientX - rect.left) / rect.width) * 100),
      y: clampBoard(((event.clientY - rect.top) / rect.height) * 100),
    };
  }

  const isDrawTool = (tool) =>
    tool === "line" ||
    tool === "arrow" ||
    tool === "dashed" ||
    tool === "curve" ||
    tool === "curve-dashed" ||
    tool === "zone";

  function startEditorDrag(event, payload) {
    event.preventDefault();
    event.stopPropagation();

    const point = getBoardCoordinates(event);
    if (!point) return;

    // Capture pointer on the board so handleBoardMouseMove/Up receive all events
    // during a handle drag (scale / rotate / endpoint), even if cursor leaves board bounds
    const board = document.getElementById("tactical-board-field");
    if (board && event.pointerId != null) {
      try { board.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    }

    pushHistory(lines, boardObjects, boardPlayers);
    setSelectedItem({ kind: payload.kind, id: payload.id });
    setEditDrag({
      ...payload,
      origin: point,
      originalLines: lines,
      originalObjects: boardObjects,
    });
  }

  function updateShapeDrag(point, drag) {
    const original = drag.originalLines.find((shape) => shape.id === drag.id);
    if (!original) return;

    const dx = point.x - drag.origin.x;
    const dy = point.y - drag.origin.y;

    setLines((prev) =>
      prev.map((shape) => {
        if (shape.id !== drag.id) return shape;

        if (drag.action === "move") {
          return {
            ...shape,
            startX: clampBoard(original.startX + dx),
            startY: clampBoard(original.startY + dy),
            endX: clampBoard(original.endX + dx),
            endY: clampBoard(original.endY + dy),
          };
        }

        if (drag.action === "start" || drag.action === "end") {
          return {
            ...shape,
            [drag.action === "start" ? "startX" : "endX"]: point.x,
            [drag.action === "start" ? "startY" : "endY"]: point.y,
          };
        }

        if (drag.action === "control") {
          return { ...shape, controlX: point.x, controlY: point.y };
        }

        if (shape.type === "zone" && drag.action?.startsWith("corner-")) {
          const bounds = getShapeBounds(original);
          const localPoint = rotatePoint(point, { x: bounds.cx, y: bounds.cy }, -Number(original.rotation ?? 0));
          const localX = clampBoard(localPoint.x);
          const localY = clampBoard(localPoint.y);

          if (drag.action === "corner-start") {
            return { ...shape, startX: localX, startY: localY };
          }
          if (drag.action === "corner-end") {
            return { ...shape, endX: localX, endY: localY };
          }
          if (drag.action === "corner-start-end") {
            return { ...shape, startX: localX, endY: localY };
          }
          if (drag.action === "corner-end-start") {
            return { ...shape, endX: localX, startY: localY };
          }
        }

        if (shape.type === "zone" && drag.action === "rotate") {
          const bounds = getShapeBounds(original);
          const angle = getAngle({ x: bounds.cx, y: bounds.cy }, point) + 90;
          return { ...shape, rotation: Math.round(angle) };
        }

        return shape;
      })
    );
  }

  function updateObjectDrag(point, drag) {
    const original = drag.originalObjects.find((obj) => obj.id === drag.id);
    if (!original) return;

    setBoardObjects((prev) =>
      prev.map((obj) => {
        if (obj.id !== drag.id) return obj;

        if (drag.action === "scale") {
          const delta = (point.x - drag.origin.x + point.y - drag.origin.y) / 16;
          return { ...obj, scale: Math.max(0.45, Math.min(3.2, Number(original.scale ?? 1) + delta)) };
        }

        if (drag.action === "rotate") {
          return { ...obj, rotation: Math.round(getAngle({ x: original.x, y: original.y }, point) + 90) };
        }

        return obj;
      })
    );
  }

  function handleBoardMouseDown(event) {
    const point = getBoardCoordinates(event);
    if (!point) return;

    const onToken = event.target.closest?.("[data-board-token]");

    // Only capture pointer when drawing/stamping on empty board area.
    // DnD items (data-board-token) and edit handles manage their own capture.
    if (!onToken) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    if (activeTool.startsWith("stamp-")) {
      if (onToken) return;
      pushHistory(lines, boardObjects, boardPlayers);
      const type = activeTool.replace("stamp-", "");
      const nextObject = {
        id: makeShapeId("obj"),
        type,
        x: point.x,
        y: point.y,
        scale: 1,
        rotation: 0,
        color: drawColor,
        text: "",
      };
      setBoardObjects((prev) => [...prev, nextObject]);
      setSelectedItem({ kind: "object", id: nextObject.id });
      return;
    }

    if (isDrawTool(activeTool) && !onToken) {
      setDrawingLine({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
      setSelectedItem(null);
      return;
    }

    if (!onToken && activeTool === "move") {
      setSelectedItem(null);
    }
  }

  function handleBoardMouseMove(event) {
    const point = getBoardCoordinates(event);
    if (!point) return;

    if (editDrag) {
      if (editDrag.kind === "shape") updateShapeDrag(point, editDrag);
      if (editDrag.kind === "object") updateObjectDrag(point, editDrag);
      return;
    }

    if (!drawingLine || !isDrawTool(activeTool)) return;
    setDrawingLine((prev) => ({ ...prev, endX: point.x, endY: point.y }));
  }

  function handleBoardMouseUp() {
    if (editDrag) {
      setEditDrag(null);
      return;
    }

    if (!drawingLine || !isDrawTool(activeTool)) return;
    const dx = Math.abs(drawingLine.endX - drawingLine.startX);
    const dy = Math.abs(drawingLine.endY - drawingLine.startY);
    if (dx < 1 && dy < 1) {
      setDrawingLine(null);
      return;
    }

    pushHistory(lines, boardObjects, boardPlayers);
    const nextShape = {
      id: makeShapeId("shape"),
      ...drawingLine,
      controlX: (drawingLine.startX + drawingLine.endX) / 2,
      controlY: ((drawingLine.startY + drawingLine.endY) / 2) - 10,
      color: drawColor,
      type: activeTool,
      rotation: 0,
    };
    setLines((prev) => [...prev, nextShape]);
    setSelectedItem({ kind: "shape", id: nextShape.id });
    setDrawingLine(null);
  }

  function updateSelectedShape(patch) {
    if (!selectedShape) return;
    setLines((prev) => prev.map((shape) => (shape.id === selectedShape.id ? { ...shape, ...patch } : shape)));
  }

  function updateSelectedObject(patch) {
    if (!selectedObject) return;
    setBoardObjects((prev) => prev.map((obj) => (obj.id === selectedObject.id ? { ...obj, ...patch } : obj)));
  }

  function updateAreaSize(key, value) {
    setAreaSize((prev) => ({ ...prev, [key]: clampAreaSize(key, value) }));
  }

  function addSizedArea() {
    pushHistory(lines, boardObjects, boardPlayers);
    const normalizedSize = normalizeAreaSize(areaSize);
    const widthPct = Math.min(96, (normalizedSize.width / FIELD_REFERENCE_SIZE.width) * 100);
    const heightPct = Math.min(96, (normalizedSize.length / FIELD_REFERENCE_SIZE.length) * 100);
    const nextShape = {
      id: makeShapeId("shape"),
      type: "zone",
      color: drawColor,
      rotation: 0,
      startX: clampBoard(50 - widthPct / 2),
      startY: clampBoard(50 - heightPct / 2),
      endX: clampBoard(50 + widthPct / 2),
      endY: clampBoard(50 + heightPct / 2),
      controlX: 50,
      controlY: 40,
      label: `${normalizedSize.width} x ${normalizedSize.length} m`,
    };

    setLines((prev) => [...prev, nextShape]);
    setSelectedItem({ kind: "shape", id: nextShape.id });
    setActiveTool("move");
  }

  function addFrame() {
    setIsPlayingFrames(false);
    const nextFrame = {
      ...buildFrameSnapshot({ boardPlayers, lines, boardObjects, notes }),
      label: `Frame ${boardFrames.length + 1}`,
    };

    setBoardFrames((prev) => [...prev, nextFrame]);
    setActiveFrameId(nextFrame.id);
  }

  function updateActiveFrame() {
    if (!activeFrameId) return;
    setIsPlayingFrames(false);
    const snapshot = buildFrameSnapshot({ boardPlayers, lines, boardObjects, notes });

    setBoardFrames((prev) =>
      prev.map((frame, index) =>
        frame.id === activeFrameId
          ? {
              ...snapshot,
              id: frame.id,
              label: frame.label || `Frame ${index + 1}`,
            }
          : frame
      )
    );
  }

  function loadFrame(frame) {
    setIsPlayingFrames(false);
    setBoardPlayers(frame.boardPlayers ?? []);
    setLines(normalizeLines(frame.lines ?? []));
    setBoardObjects(normalizeBoardObjects(frame.boardObjects ?? []));
    setNotes(frame.notes ?? defaultNotes);
    setSelectedItem(null);
    setActiveFrameId(frame.id);
  }

  function deleteActiveFrame() {
    if (!activeFrameId) return;
    setIsPlayingFrames(false);

    const currentIndex = boardFrames.findIndex((frame) => frame.id === activeFrameId);
    const nextFrames = boardFrames.filter((frame) => frame.id !== activeFrameId);
    const nextFrame = nextFrames[Math.min(currentIndex, nextFrames.length - 1)] ?? null;

    setBoardFrames(nextFrames);
    setSelectedItem(null);

    if (nextFrame) {
      setBoardPlayers(nextFrame.boardPlayers ?? []);
      setLines(normalizeLines(nextFrame.lines ?? []));
      setBoardObjects(normalizeBoardObjects(nextFrame.boardObjects ?? []));
      setNotes(nextFrame.notes ?? defaultNotes);
      setActiveFrameId(nextFrame.id);
      return;
    }

    setActiveFrameId("");
  }

  function resetFrames() {
    setIsPlayingFrames(false);
    setBoardFrames([]);
    setActiveFrameId("");
  }

  function toggleFramePlayback() {
    if (boardFrames.length < 2) return;
    setIsPlayingFrames((prev) => !prev);
  }

  function resetBoard() {
    setOwnFormation("Nessuno");
    setOpponentFormation("Nessuno");
    setBoardPlayers([]);
    setSelectedLineup([]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);
    setSelectedItem(null);
    setLines([]);
    setDrawingLine(null);
    setEditDrag(null);
    setBoardObjects([]);
    setNotes(defaultNotes);
    setBoardFrames([]);
    setActiveFrameId("");
    setIsPlayingFrames(false);
  }

  function toggleMobilePanel(panel) {
    setMobilePanel((current) => (current === panel ? null : panel));
  }

  function selectMobileTool(tool) {
    setActiveTool(tool);
    setSelectedItem(null);
    setMobilePanel(null);
  }

  function insertMobileObject(type) {
    pushHistory(lines, boardObjects, boardPlayers);
    const nextObject = {
      id: makeShapeId("obj"),
      type,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      color: drawColor,
      text: "",
    };
    setBoardObjects((prev) => [...prev, nextObject]);
    setSelectedItem({ kind: "object", id: nextObject.id });
    setActiveTool("move");
    setMobilePanel(null);
  }

  // ─── Schema save / load ───────────────────────────────────────────────────────
  function saveCurrentSchema() {
    const name = schemaName.trim();
    if (!name) {
      showToast(t("pages.tacticalBoard.toastSchemaNameRequired"), "warn");
      return;
    }
    const schema = {
      id: `schema-${Date.now()}`,
      name,
      category: "Personalizzato",
      ownFormation,
      boardPlayers: boardPlayers.map((p) => ({ ...p })),
      lines: lines.map((l) => ({ ...l })),
      boardObjects: boardObjects.map((o) => ({ ...o })),
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedSchemas, schema];
    setSavedSchemas(updated);
    persistSchemas(updated);
    setSchemaName("");
    setSchemaSaved(true);
    setTimeout(() => setSchemaSaved(false), 2200);
  }

  function loadSchema(schema) {
    if (schema.ownFormation && schema.ownFormation !== "Nessuno") {
      setOwnFormation(schema.ownFormation);
    }
    setBoardPlayers(schema.boardPlayers ?? []);
    setLines(normalizeLines(schema.lines ?? []));
    setBoardObjects(normalizeBoardObjects(schema.boardObjects ?? []));
    setSelectedLineup([]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);
    setSelectedItem(null);
  }

  function deleteSchema(id) {
    const updated = savedSchemas.filter((s) => s.id !== id);
    setSavedSchemas(updated);
    persistSchemas(updated);
  }

  function openExerciseModal() {
    const params = new URLSearchParams(location.search);
    params.set("modal", EXERCISE_MODAL);
    setExName(loadExerciseDraftName(""));
    setExFeedback(null);
    setExModalOpen(true);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
  }

  function closeExerciseModal({ resetDraft = false } = {}) {
    if (resetDraft && !editingExerciseId) {
      clearExerciseDraftName();
      setExName("");
    }
    setExFeedback(null);
    setExModalOpen(false);
    if (!isExerciseModalRoute) return;
    const params = new URLSearchParams(location.search);
    params.delete("modal");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  }

  // ── Esporta la lavagna corrente come esercizio ────────────────────────────────
  function exportToExercise() {
    // Quando si modifica un esercizio esistente il nome viene dall'esercizio stesso
    const name = editingExerciseId
      ? (editingExerciseName ?? "Esercizio")
      : exName.trim();

    if (!editingExerciseId && !name) {
      setExFeedback({ ok: false, text: t("pages.tacticalBoard.exerciseNameRequired") });
      return;
    }

    const boardSnapshot = {
      boardPlayers: boardPlayers.map((p) => ({ ...p })),
      lines:        lines.map((l) => ({ ...l })),
      boardObjects: boardObjects.map((o) => ({ ...o })),
      ownFormation,
    };

    if (editingExerciseId && setExercises) {
      // Aggiorna il disegno su un esercizio esistente
      setExercises((prevExercises) =>
        prevExercises.map((ex) =>
          ex.id === editingExerciseId
            ? { ...ex, tacticalBoard: boardSnapshot }
            : ex
        )
      );
      setExFeedback({ ok: true, text: `Disegno salvato in "${name}". Torna all'Eserciziario per completarlo.` });
    } else if (setExercises) {
      // Crea un nuovo esercizio con il disegno incorporato
      const newExercise = {
        ...emptyExercise(),
        id:           createUuid(),
        title:        name,
        tacticalBoard: boardSnapshot,
      };
      setExercises((prevExercises) => [...prevExercises, newExercise]);
      clearExerciseDraftName();
      setExFeedback({ ok: true, text: `Esercizio "${name}" creato! Vai all'Eserciziario per aggiungere descrizione e dettagli.` });
    }
  }

  // ── Salva la lavagna in Palle Inattive e torna ───────────────────────────────
  function saveForSetPlay() {
    const snapshot = {
      boardPlayers: boardPlayers.map((p) => ({ ...p })),
      lines:        lines.map((l) => ({ ...l })),
      boardObjects: boardObjects.map((o) => ({ ...o })),
      ownFormation,
    };
    sessionStorage.setItem(
      "setPlayDiagramResult",
      JSON.stringify({ section: setPlaySection, snapshot })
    );
    navigate("/set-plays");
  }

  function clearLineup() {
    setSelectedLineup([]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);

    setBoardPlayers((prev) =>
      prev.map((slot) => ({
        ...slot,
        realPlayerId: undefined,
        name: slot.slotRole,
        number: Number(slot.id.split("-")[1]),
        role: undefined,
      }))
    );
  }

  function assignPlayerToSlot(slot, playerToAssign = selectedBenchPlayer) {
    if (!slot || !playerToAssign) return;
    if (slot.team !== "own" || slot.realPlayerId) return;
    if (selectedLineup.some((p) => p.id === playerToAssign.id)) return;

    setBoardPlayers((prev) =>
      prev.map((item) =>
        item.id === slot.id
          ? {
              ...item,
              realPlayerId: playerToAssign.id,
              name: playerToAssign.name,
              number: playerToAssign.number || item.number,
              role: playerToAssign.role || item.slotRole,
            }
          : item
      )
    );

    setSelectedLineup((prev) => [...prev, playerToAssign]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);
  }

  function addPlayerToLineup(player) {
    const compatibleRoles = getCompatibleRoles(player.role);

    const selectedSlot = boardPlayers.find(
      (slot) => slot.id === selectedSlotId && slot.team === "own" && !slot.realPlayerId
    );

    const compatibleSlot = boardPlayers.find(
      (slot) =>
        slot.team === "own" &&
        !slot.realPlayerId &&
        compatibleRoles.includes(slot.slotRole)
    );

    const fallbackSlot = boardPlayers.find(
      (slot) => slot.team === "own" && !slot.realPlayerId
    );

    assignPlayerToSlot(selectedSlot || compatibleSlot || fallbackSlot, player);
  }

  function removePlayerFromLineup(player) {
    setSelectedLineup((prev) => prev.filter((p) => p.id !== player.id));

    setBoardPlayers((prev) =>
      prev.map((slot) =>
        slot.realPlayerId === player.id
          ? {
              ...slot,
              realPlayerId: undefined,
              name: slot.slotRole,
              number: Number(slot.id.split("-")[1]),
              role: undefined,
            }
          : slot
      )
    );
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t("pages.tacticalBoard.title")}
        subtitle={t("pages.tacticalBoard.pageSubtitle")}
      />

      {/* ── Banner: si arriva da un esercizio specifico ── */}
      {editingExerciseId && (
        <div style={exStyles.banner}>
          <span style={exStyles.bannerText}>
            {t("pages.tacticalBoard.bannerEditing")} <strong>{editingExerciseName || t("pages.tacticalBoard.exNamePlaceholder")}</strong>
          </span>
          <button
            type="button"
            onClick={() => navigate("/exercise-library?tab=miei")}
            style={exStyles.bannerBack}
          >
            {t("pages.tacticalBoard.bannerEditBack")}
          </button>
        </div>
      )}

      {/* ── Banner: si arriva da Palle Inattive per disegnare uno schema ── */}
      {setPlaySection && (
        <div style={{ ...exStyles.banner, background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.35)" }}>
          <span style={exStyles.bannerText}>
            {t("pages.tacticalBoard.bannerDrawSchema")} <strong>{setPlayLabel || setPlaySection}</strong>
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate("/set-plays")}
              style={exStyles.bannerBack}
            >
              {t("pages.tacticalBoard.bannerCancel")}
            </button>
            <button
              type="button"
              onClick={saveForSetPlay}
              style={{ ...exStyles.bannerBack, background: "rgba(139,92,246,0.3)", borderColor: "rgba(139,92,246,0.6)", color: "#c4b5fd" }}
            >
              {t("pages.tacticalBoard.bannerSaveSetPlay")}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal "Inserisci come esercizio" ── */}
      {exModalOpen && (
        <div style={exStyles.modalOverlay} onClick={() => closeExerciseModal()}>
          <div style={exStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>
              {editingExerciseId ? t("pages.tacticalBoard.modalSaveDrawTitle") : t("pages.tacticalBoard.modalInsertTitle")}
            </h3>
            <p style={{ color: "#94a3b8", margin: "0 0 18px", fontSize: 13, lineHeight: 1.5 }}>
              {editingExerciseId
                ? t("pages.tacticalBoard.modalSaveDrawSub", { name: editingExerciseName })
                : t("pages.tacticalBoard.modalInsertSub")}
            </p>
            {!editingExerciseId && (
              <input
                placeholder={t("pages.tacticalBoard.exNamePlaceholder")}
                value={exName}
                onChange={(e) => { setExName(e.target.value); setExFeedback(null); }}
                onKeyDown={(e) => e.key === "Enter" && exportToExercise()}
                autoFocus
                style={exStyles.input}
              />
            )}
            {exFeedback && (
              <div style={{ ...exStyles.feedback, ...(exFeedback.ok ? exStyles.feedbackOk : exStyles.feedbackErr) }}>
                {exFeedback.text}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => closeExerciseModal({ resetDraft: true })} style={exStyles.btnGhost}>
                {t("pages.tacticalBoard.undo")}
              </button>
              {exFeedback?.ok ? (
                <button type="button" onClick={() => navigate("/exercise-library?tab=miei")} style={exStyles.btnPrimary}>
                  {t("pages.tacticalBoard.btnGotoLibrary")}
                </button>
              ) : (
                <button type="button" onClick={exportToExercise} style={exStyles.btnPrimary}>
                  {editingExerciseId ? t("pages.tacticalBoard.btnSaveDrawing") : t("pages.tacticalBoard.btnCreateExercise")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        style={mobileFullscreenActive ? {
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "#020617",
          overflow: "hidden",
          padding: "max(8px, env(safe-area-inset-top)) 8px max(10px, env(safe-area-inset-bottom))",
        } : {}}
      >
      <div style={{ ...boardStyles.layout, gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) 330px" }}>
        <div style={boardStyles.mainColumn}>
          <AppCard
            noPadding={mobileFullscreenActive}
            style={mobileFullscreenActive ? {
              minHeight: "100%",
              background: "transparent",
              border: "none",
              boxShadow: "none",
              overflow: "visible",
            } : undefined}
          >
            {!mobileFullscreenActive && <div style={{ ...boardStyles.header, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
              <div>
                <div style={boardStyles.kicker}>CALCIOLAB TACTICAL PAD</div>
                <h2 style={boardStyles.title}>Match Plan</h2>
                <p style={boardStyles.subtitle}>
                  {t("pages.tacticalBoard.matchPlanSubtitle")}
                </p>
              </div>

              <div style={boardStyles.counters}>
                <div style={boardStyles.counterBlue}>
                  <span>{t("pages.tacticalBoard.ownTeam")}</span>
                  <strong>{ownCount}</strong>
                </div>
                <div style={boardStyles.counterRed}>
                  <span>{t("pages.tacticalBoard.opponents")}</span>
                  <strong>{opponentCount}</strong>
                </div>
              </div>
            </div>}

            {/* ── Riga 1: formazioni + azioni gara ── */}
            {!mobileFullscreenActive && <div style={boardStyles.toolbar}>
              <label style={boardStyles.label}>
                {t("pages.tacticalBoard.ownTeam")}
                <select value={ownFormation} onChange={(e) => changeOwnFormation(e.target.value)} style={boardStyles.select}>
                  {formationOptions.map((formation) => (
                    <option key={formation}>{formation}</option>
                  ))}
                </select>
              </label>
              <label style={boardStyles.label}>
                {t("pages.tacticalBoard.opponents")}
                <select value={opponentFormation} onChange={(e) => changeOpponentFormation(e.target.value)} style={boardStyles.select}>
                  {formationOptions.map((formation) => (
                    <option key={formation}>{formation}</option>
                  ))}
                </select>
              </label>
              <div style={{ ...boardStyles.actions, marginLeft: isMobile ? 0 : "auto" }}>
                <button style={boardStyles.secondaryButton} onClick={clearLineup}>{t("pages.tacticalBoard.btnClearLineup")}</button>
                <button style={boardStyles.primaryButton} onClick={resetBoard}>Reset board</button>
              </div>
            </div>}

            {/* ── Riga 2: strumenti di disegno ── */}
            {mobileFullscreenActive ? (
              <div style={mobileTopBar}>
                <button type="button" onClick={() => toggleMobilePanel("players")} style={{ ...mobileTopButton, ...(mobilePanel === "players" ? mobileTopButtonActive : {}) }}>
                  👕
                </button>
                <button type="button" onClick={() => toggleMobilePanel("objects")} style={{ ...mobileTopButton, ...(mobilePanel === "objects" ? mobileTopButtonActive : {}) }}>
                  🔺
                </button>
                <button type="button" onClick={() => toggleMobilePanel("lines")} style={{ ...mobileTopButton, ...(mobilePanel === "lines" ? mobileTopButtonActive : {}) }}>
                  ↗
                </button>
                <button type="button" onClick={() => toggleMobilePanel("field")} style={{ ...mobileTopButton, ...(mobilePanel === "field" ? mobileTopButtonActive : {}) }}>
                  ⚙
                </button>
                <button type="button" onClick={() => setMobileFullscreen(false)} style={{ ...mobileTopButton, marginLeft: "auto" }}>
                  ✕
                </button>
              </div>
            ) : (
            <div style={{
              ...boardStyles.drawBar,
              padding: isMobile ? "8px" : undefined,
            }}>
              {/* Modalità */}
              <div style={boardStyles.toolGroup}>
                <ToolButton icon={<Move size={17} />} active={activeTool === "move"} onClick={() => setActiveTool("move")} title={t("pages.tacticalBoard.moveToolTip")} />
                <ToolButton
                  icon={<svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>}
                  active={activeTool === "line"} onClick={() => setActiveTool("line")} title={t("pages.tacticalBoard.lineTypeLine")}
                />
                <ToolButton
                  icon={<svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 3"/></svg>}
                  active={activeTool === "dashed"} onClick={() => setActiveTool("dashed")} title={t("pages.tacticalBoard.dashedToolTip")}
                />
                <ToolButton icon={<ArrowRight size={17} />} active={activeTool === "arrow"} onClick={() => setActiveTool("arrow")} title={t("pages.tacticalBoard.arrowToolTip")} />
                <ToolButton
                  icon={<svg viewBox="0 0 24 18" width="22" height="16"><path d="M2 14 C7 2, 15 2, 22 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>}
                  active={activeTool === "curve"} onClick={() => setActiveTool("curve")} title={t("pages.tacticalBoard.lineTypeCurve")}
                />
                <ToolButton
                  icon={<svg viewBox="0 0 24 18" width="22" height="16"><path d="M2 14 C7 2, 15 2, 22 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3"/></svg>}
                  active={activeTool === "curve-dashed"} onClick={() => setActiveTool("curve-dashed")} title={t("pages.tacticalBoard.curveDashedToolTip")}
                />
                <ToolButton
                  icon={<svg width="20" height="14"><rect x="1" y="1" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2"/></svg>}
                  active={activeTool === "zone"} onClick={() => setActiveTool("zone")} title={t("pages.tacticalBoard.zoneToolTip")}
                />
              </div>
              {!isMobile && <div style={boardStyles.toolSep} />}
              {/* Oggetti campo */}
              <div style={boardStyles.toolGroup}>
                {[
                  { key: "ball",   titleKey: "stampBall",   icon: <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="8" fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth="1.2"/><polygon points="10,4 13.5,8 12,13 8,13 6.5,8" fill="#333" opacity="0.4"/></svg> },
                  { key: "cone",   titleKey: "stampCone",   icon: <svg viewBox="0 0 18 20" width="14" height="17"><polygon points="9,1 17,19 1,19" fill="#f97316"/><ellipse cx="9" cy="19" rx="7" ry="2" fill="#ea580c"/></svg> },
                  { key: "goal",   titleKey: "stampGoal",   icon: <svg viewBox="0 0 28 18" width="22" height="15"><rect x="1" y="1" width="26" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg> },
                  { key: "pole",   titleKey: "stampPole",   icon: <svg viewBox="0 0 10 22" width="9" height="20"><rect x="3" y="0" width="4" height="22" rx="1" fill="currentColor"/><rect x="3" y="0" width="4" height="5" fill="#ef4444"/><rect x="3" y="5" width="4" height="5" fill="white"/><rect x="3" y="10" width="4" height="5" fill="#ef4444"/></svg> },
                  { key: "hurdle", titleKey: "stampHurdle", icon: <svg viewBox="0 0 26 18" width="22" height="16"><path d="M4 16 V5 H22 V16" fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/><path d="M6 5 H20" stroke="white" strokeWidth="2"/></svg> },
                  { key: "ring",   titleKey: "stampRing",   icon: <svg viewBox="0 0 22 22" width="18" height="18"><circle cx="11" cy="11" r="8" fill="none" stroke="#fbbf24" strokeWidth="3"/></svg> },
                  { key: "ladder", titleKey: "stampLadder", icon: <svg viewBox="0 0 26 18" width="23" height="16"><path d="M3 3 H23 M3 15 H23" stroke="currentColor" strokeWidth="2"/><path d="M7 3 V15 M13 3 V15 M19 3 V15" stroke="#fbbf24" strokeWidth="2"/></svg> },
                ].map(({ key, titleKey, icon }) => (
                  <ToolButton key={key} icon={icon} active={activeTool === `stamp-${key}`} onClick={() => setActiveTool(`stamp-${key}`)} title={t(`pages.tacticalBoard.${titleKey}`)} />
                ))}
              </div>
              {!isMobile && <div style={boardStyles.toolSep} />}
              {/* Colori */}
              <div style={boardStyles.toolGroup}>
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      setDrawColor(c.value);
                      if (selectedShape) updateSelectedShape({ color: c.value });
                      if (selectedObject) updateSelectedObject({ color: c.value });
                    }}
                    style={{
                      ...boardStyles.colorDot,
                      background: c.value,
                      boxShadow: drawColor === c.value ? `0 0 0 2px rgba(255,255,255,0.9)` : "none",
                    }}
                  />
                ))}
              </div>
              {!isMobile && <div style={boardStyles.toolSep} />}
              {/* Undo / Cancella */}
              <div style={boardStyles.toolGroup}>
                <ToolButton
                  icon={<Undo2 size={17} />}
                  active={false}
                  onClick={handleUndo}
                  title={`${t("pages.tacticalBoard.undo")}${undoStack.length ? ` (${undoStack.length})` : ""}`}
                  style={undoStack.length === 0 ? { opacity: 0.35, pointerEvents: "none" } : {}}
                />
              </div>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setMobileFullscreen((v) => !v)}
                  style={{
                    marginLeft: mobileFullscreenActive ? 4 : "auto",
                    flexShrink: 0,
                    border: "1px solid rgba(148,163,184,0.22)",
                    background: mobileFullscreen ? "rgba(37,99,235,0.28)" : "rgba(255,255,255,0.05)",
                    color: "#cbd5e1",
                    borderRadius: 12,
                    padding: "7px 10px",
                    fontWeight: 900,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {mobileFullscreen ? "✕" : "⛶"}
                </button>
              )}
            </div>
            )}

            {!mobileFullscreenActive && <div style={boardStyles.boardConfigBar}>
              <div style={boardStyles.fieldSizeGroup}>
                <span>Area</span>
                <label style={boardStyles.fieldSizeLabel}>
                  {t("pages.tacticalBoard.fieldWidthLabel")}
                  <input style={boardStyles.fieldSizeInput} type="number" value={areaSize.width} min="1" max="60" onChange={(event) => updateAreaSize("width", event.target.value)} />
                </label>
                <label style={boardStyles.fieldSizeLabel}>
                  {t("pages.tacticalBoard.fieldLengthLabel")}
                  <input style={boardStyles.fieldSizeInput} type="number" value={areaSize.length} min="1" max="110" onChange={(event) => updateAreaSize("length", event.target.value)} />
                </label>
                <small>{t("pages.tacticalBoard.meters")}</small>
                <button type="button" style={boardStyles.frameAddButton} onClick={addSizedArea}>
                  {t("pages.tacticalBoard.insertArea")}
                </button>
              </div>
              <div style={boardStyles.framesGroup}>
                <button type="button" style={boardStyles.frameAddButton} onClick={addFrame}>
                  <Plus size={15} /> Frame
                </button>
                <button
                  type="button"
                  style={{
                    ...boardStyles.frameAddButton,
                    opacity: activeFrameId ? 1 : 0.5,
                    cursor: activeFrameId ? "pointer" : "not-allowed",
                  }}
                  onClick={updateActiveFrame}
                  disabled={!activeFrameId}
                >
                  {t("pages.tacticalBoard.frameUpdate")}
                </button>
                <button
                  type="button"
                  style={{
                    ...boardStyles.frameAddButton,
                    opacity: boardFrames.length < 2 ? 0.5 : 1,
                    cursor: boardFrames.length < 2 ? "not-allowed" : "pointer",
                  }}
                  onClick={toggleFramePlayback}
                  disabled={boardFrames.length < 2}
                >
                  {isPlayingFrames ? <Pause size={15} /> : <Play size={15} />}
                  Play
                </button>
                <button
                  type="button"
                  style={{
                    ...boardStyles.frameAddButton,
                    opacity: activeFrameId ? 1 : 0.5,
                    cursor: activeFrameId ? "pointer" : "not-allowed",
                  }}
                  onClick={deleteActiveFrame}
                  disabled={!activeFrameId}
                >
                  {t("pages.tacticalBoard.frameDelete")}
                </button>
                <button
                  type="button"
                  style={{
                    ...boardStyles.frameAddButton,
                    opacity: boardFrames.length ? 1 : 0.5,
                    cursor: boardFrames.length ? "pointer" : "not-allowed",
                  }}
                  onClick={resetFrames}
                  disabled={!boardFrames.length}
                >
                  {t("pages.tacticalBoard.frameReset")}
                </button>
                {boardFrames.map((frame, index) => (
                  <button
                    key={frame.id}
                    type="button"
                    style={{
                      ...boardStyles.frameButton,
                      ...(activeFrameId === frame.id ? boardStyles.frameButtonActive : {}),
                    }}
                    onClick={() => loadFrame(frame)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>}

            {(selectedShape || (selectedObject && !mobileFullscreenActive)) && (
              <div style={{
                ...boardStyles.editorBar,
                ...(mobileFullscreenActive ? {
                  position: "fixed",
                  left: 10,
                  right: 10,
                  bottom: 78,
                  zIndex: 270,
                  margin: 0,
                  background: "rgba(2,6,23,0.9)",
                  boxShadow: "0 14px 34px rgba(0,0,0,0.45)",
                } : {}),
              }}>
                <div style={{ ...boardStyles.editorMeta, minWidth: isMobile ? 0 : 220 }}>
                  <strong>{selectedShape ? t("pages.tacticalBoard.shapeSelectedTitle") : t("pages.tacticalBoard.objectSelectedTitle")}</strong>
                  <span>
                    {selectedShape
                      ? t("pages.tacticalBoard.shapeEditHint")
                      : t("pages.tacticalBoard.objectEditHint")}
                  </span>
                </div>
                {selectedShape && (
                  <select
                    value={selectedShape.type}
                    onChange={(event) => updateSelectedShape({ type: event.target.value })}
                    style={boardStyles.editorSelect}
                  >
                    <option value="line">{t("pages.tacticalBoard.lineTypeLine")}</option>
                    <option value="dashed">{t("pages.tacticalBoard.lineTypeDashed")}</option>
                    <option value="arrow">{t("pages.tacticalBoard.lineTypeArrow")}</option>
                    <option value="curve">{t("pages.tacticalBoard.lineTypeCurve")}</option>
                    <option value="curve-dashed">{t("pages.tacticalBoard.lineTypeCurveDashed")}</option>
                    <option value="zone">{t("pages.tacticalBoard.lineTypeZone")}</option>
                  </select>
                )}
                {selectedObject && (
                  <div style={{ ...boardStyles.objectControls, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(150px, 1fr))", minWidth: isMobile ? 0 : 320 }}>
                    <label style={boardStyles.rangeLabel}>
                      {t("pages.tacticalBoard.scaleLabel", { value: Number(selectedObject.scale ?? 1).toFixed(1) })}
                      <input
                        type="range"
                        min="0.45"
                        max="3.2"
                        step="0.05"
                        value={Number(selectedObject.scale ?? 1)}
                        onChange={(event) => updateSelectedObject({ scale: Number(event.target.value) })}
                        style={boardStyles.rangeInput}
                      />
                    </label>
                    <label style={boardStyles.rangeLabel}>
                      {t("pages.tacticalBoard.rotationLabel", { value: Math.round(selectedObject.rotation ?? 0) })}
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="1"
                        value={Number(selectedObject.rotation ?? 0)}
                        onChange={(event) => updateSelectedObject({ rotation: Number(event.target.value) })}
                        style={boardStyles.rangeInput}
                      />
                    </label>
                    <label style={{ ...boardStyles.rangeLabel, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{t("pages.tacticalBoard.objectLabel")}</span>
                      <input
                        type="text"
                        maxLength={8}
                        value={selectedObject.text ?? ""}
                        placeholder={t("pages.tacticalBoard.objectLabelPlaceholder")}
                        onFocus={() => pushHistory(lines, boardObjects, boardPlayers)}
                        onChange={(e) => updateSelectedObject({ text: e.target.value })}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: "rgba(255,255,255,0.07)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 8,
                          color: "white",
                          fontSize: 13,
                          fontWeight: 600,
                          padding: "4px 8px",
                          outline: "none",
                          letterSpacing: "0.04em",
                        }}
                      />
                    </label>
                  </div>
                )}
                <button type="button" style={boardStyles.dangerButton} onClick={deleteSelectedItem}>
                  {t("pages.tacticalBoard.deleteSelected")}
                </button>
              </div>
            )}

            <DndContext onDragEnd={handleDragEnd}>
  <div
  id="tactical-board-field"
  style={{
    ...boardStyles.field,
    ...fieldThemeStyle,
    touchAction: "none",
    minHeight: isMobile ? 0 : 520,
    ...(mobileFullscreenActive ? {
      aspectRatio: "auto",
      height: "calc(100dvh - 132px)",
      minHeight: 0,
      width: "100%",
      marginTop: 66,
      borderRadius: 24,
      border: "1px solid rgba(255,255,255,0.18)",
    } : {}),
  }}
  onPointerDown={handleBoardMouseDown}
  onPointerMove={handleBoardMouseMove}
  onPointerUp={handleBoardMouseUp}
>
    <div style={boardStyles.pitchTexture} />
    <div style={boardStyles.halfwayLine} />
    <div style={boardStyles.zoneTop} />
    <div style={boardStyles.zoneBottom} />
    <div style={boardStyles.centerCircle} />
    <div style={boardStyles.centerSpot} />
    <div style={boardStyles.boxTop} />
    <div style={boardStyles.smallBoxTop} />
    <div style={boardStyles.boxBottom} />
    <div style={boardStyles.smallBoxBottom} />

    <svg style={boardStyles.svgLayer} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        {DRAW_COLORS.map((c) => (
          <marker
            key={c.value}
            id={`ah-${colorId(c.value)}`}
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={c.value} />
          </marker>
        ))}
      </defs>

      {lines.map((shape) => {
        const c = shape.color ?? "white";
        const isSelected = selectedItem?.kind === "shape" && selectedItem.id === shape.id;
        if (shape.type === "zone") {
          const bounds = getShapeBounds(shape);
          const rotation = Number(shape.rotation ?? 0);
          const corners = {
            start: rotatePoint({ x: shape.startX, y: shape.startY }, { x: bounds.cx, y: bounds.cy }, rotation),
            end: rotatePoint({ x: shape.endX, y: shape.endY }, { x: bounds.cx, y: bounds.cy }, rotation),
            startEnd: rotatePoint({ x: shape.startX, y: shape.endY }, { x: bounds.cx, y: bounds.cy }, rotation),
            endStart: rotatePoint({ x: shape.endX, y: shape.startY }, { x: bounds.cx, y: bounds.cy }, rotation),
            rotate: rotatePoint({ x: bounds.cx, y: bounds.y - 7 }, { x: bounds.cx, y: bounds.cy }, rotation),
          };

          return (
            <g key={shape.id}>
              <g transform={`rotate(${rotation} ${bounds.cx} ${bounds.cy})`}>
                <rect
                  data-board-token="true"
                  x={`${bounds.x}%`}
                  y={`${bounds.y}%`}
                  width={`${bounds.width}%`}
                  height={`${bounds.height}%`}
                  fill={c}
                  fillOpacity="0.12"
                  stroke={isSelected ? "#ffffff" : c}
                  strokeWidth={isSelected ? "3" : "2"}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="6 3"
                  strokeOpacity="0.9"
                  onPointerDown={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "move" })}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setLines((prev) => prev.filter((line) => line.id !== shape.id));
                    setSelectedItem(null);
                  }}
                  style={{ cursor: "move" }}
                />
                {shape.label && (
                  <text
                    x={`${bounds.cx}%`}
                    y={`${bounds.cy}%`}
                    fill="#f8fafc"
                    fontSize="3"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ pointerEvents: "none" }}
                  >
                    {shape.label}
                  </text>
                )}
              </g>
              {isSelected && (
                <ShapeHandles
                  points={corners}
                  onStart={(event, action) => startEditorDrag(event, { kind: "shape", id: shape.id, action })}
                />
              )}
            </g>
          );
        }

        if (shape.type === "curve" || shape.type === "curve-dashed") {
          const path = `M ${shape.startX} ${shape.startY} Q ${shape.controlX} ${shape.controlY} ${shape.endX} ${shape.endY}`;

          return (
            <g key={shape.id}>
              <path
                data-board-token="true"
                d={path}
                vectorEffect="non-scaling-stroke"
                fill="none"
                stroke={c}
                strokeWidth={isSelected ? "6" : "3"}
                strokeLinecap="round"
                strokeOpacity={isSelected ? "0.9" : "1"}
                strokeDasharray={shape.type === "curve-dashed" ? "10 5" : undefined}
                onPointerDown={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "move" })}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setLines((prev) => prev.filter((line) => line.id !== shape.id));
                  setSelectedItem(null);
                }}
                style={{ cursor: "move" }}
              />
              {isSelected && (
                <>
                  <path
                    d={`M ${shape.startX} ${shape.startY} L ${shape.controlX} ${shape.controlY} L ${shape.endX} ${shape.endY}`}
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.55"
                  />
                  <LineHandle x={shape.startX} y={shape.startY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "start" })} />
                  <LineHandle x={shape.controlX} y={shape.controlY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "control" })} fill="#fbbf24" />
                  <LineHandle x={shape.endX} y={shape.endY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "end" })} />
                </>
              )}
            </g>
          );
        }

        return (
          <g key={shape.id}>
            <line
              data-board-token="true"
              x1={`${shape.startX}%`}
              y1={`${shape.startY}%`}
              x2={`${shape.endX}%`}
              y2={`${shape.endY}%`}
              stroke={c}
              strokeWidth={isSelected ? "6" : "3"}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeOpacity={isSelected ? "0.9" : "1"}
              strokeDasharray={shape.type === "dashed" ? "10 5" : undefined}
              markerEnd={shape.type === "arrow" ? `url(#ah-${colorId(c)})` : undefined}
              onPointerDown={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "move" })}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setLines((prev) => prev.filter((line) => line.id !== shape.id));
                setSelectedItem(null);
              }}
              style={{ cursor: "move" }}
            />
            {isSelected && (
              <>
                <LineHandle x={shape.startX} y={shape.startY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "start" })} />
                <LineHandle x={shape.endX} y={shape.endY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "end" })} />
              </>
            )}
          </g>
        );
      })}

      {drawingLine && (() => {
        const c = drawColor;
        if (activeTool === "zone") {
          const x = Math.min(drawingLine.startX, drawingLine.endX);
          const y = Math.min(drawingLine.startY, drawingLine.endY);
          const w = Math.abs(drawingLine.endX - drawingLine.startX);
          const h = Math.abs(drawingLine.endY - drawingLine.startY);
          return (
            <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`}
              fill={c} fillOpacity="0.08" stroke={c} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 3" opacity="0.65" />
          );
        }
        if (activeTool === "curve" || activeTool === "curve-dashed") {
          const controlX = (drawingLine.startX + drawingLine.endX) / 2;
          const controlY = ((drawingLine.startY + drawingLine.endY) / 2) - 10;
          return (
            <path
              d={`M ${drawingLine.startX} ${drawingLine.startY} Q ${controlX} ${controlY} ${drawingLine.endX} ${drawingLine.endY}`}
              vectorEffect="non-scaling-stroke"
              fill="none"
              stroke={c}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.65"
              strokeDasharray={activeTool === "curve-dashed" ? "10 5" : undefined}
            />
          );
        }
        return (
          <line
            x1={`${drawingLine.startX}%`} y1={`${drawingLine.startY}%`}
            x2={`${drawingLine.endX}%`} y2={`${drawingLine.endY}%`}
            stroke={c} strokeWidth="3" strokeLinecap="round" opacity="0.6"
            strokeDasharray={activeTool === "dashed" ? "10 5" : undefined}
            markerEnd={activeTool === "arrow" ? `url(#ah-${colorId(c)})` : undefined}
          />
        );
      })()}
    </svg>

    {boardObjects.map((obj) => (
      <FieldObject
        key={obj.id}
        obj={obj}
        activeTool={activeTool}
        selected={selectedItem?.kind === "object" && selectedItem.id === obj.id}
        onSelect={() => setSelectedItem({ kind: "object", id: obj.id })}
        onEditStart={startEditorDrag}
        onRemove={(id) => {
          pushHistory(lines, boardObjects, boardPlayers);
          setBoardObjects((prev) => prev.filter((o) => o.id !== id));
          setSelectedItem(null);
        }}
      />
    ))}

    {boardPlayers.map((player) => (
      <DraggablePlayer
        key={player.id}
        player={player}
        selectedSlotId={selectedSlotId}
        selectedBenchPlayer={selectedBenchPlayer}
        onSelectSlot={setSelectedSlotId}
        onAssignToSlot={assignPlayerToSlot}
        onRemove={(slotPlayer) => {
          pushHistory(lines, boardObjects, boardPlayers);
          const linkedPlayer = selectedLineup.find(
            (p) => p.id === slotPlayer.realPlayerId
          );

          if (linkedPlayer) removePlayerFromLineup(linkedPlayer);
        }}
      />
    ))}
  </div>
</DndContext>

            {mobileFullscreenActive && (
              <div style={mobileDock}>
                <button type="button" onClick={handleUndo} disabled={undoStack.length === 0} style={{ ...mobileDockButton, opacity: undoStack.length ? 1 : 0.38 }}>
                  <Undo2 size={18} />
                </button>
                <button type="button" onClick={() => toggleMobilePanel("players")} style={{ ...mobileDockButton, ...(mobilePanel === "players" ? mobileDockButtonActive : {}) }}>
                  <span style={mobileDockIcon}>👕</span>
                  <span style={mobileDockLabel}>{t("pages.tacticalBoard.mobilePlayers")}</span>
                </button>
                <button type="button" onClick={() => toggleMobilePanel("objects")} style={{ ...mobileDockButton, ...(mobilePanel === "objects" ? mobileDockButtonActive : {}) }}>
                  <span style={mobileDockIcon}>🔺</span>
                  <span style={mobileDockLabel}>{t("pages.tacticalBoard.mobileObjects")}</span>
                </button>
                <button type="button" onClick={() => toggleMobilePanel("lines")} style={{ ...mobileDockButton, ...(mobilePanel === "lines" ? mobileDockButtonActive : {}) }}>
                  <span style={mobileDockIcon}>↗</span>
                  <span style={mobileDockLabel}>{t("pages.tacticalBoard.mobileLines")}</span>
                </button>
                <button type="button" onClick={() => toggleMobilePanel("field")} style={{ ...mobileDockButton, ...(mobilePanel === "field" ? mobileDockButtonActive : {}) }}>
                  <span style={mobileDockIcon}>⚙</span>
                  <span style={mobileDockLabel}>{t("pages.tacticalBoard.mobileField")}</span>
                </button>
              </div>
            )}

            {mobileFullscreenActive && mobilePanel && (
              <div style={mobileSheetBackdrop} onPointerDown={() => setMobilePanel(null)}>
                <div style={mobileSheet} onPointerDown={(event) => event.stopPropagation()}>
                  <div style={mobileSheetHandle} />
                  <div style={mobileSheetHeader}>
                    <h3 style={mobileSheetTitle}>{t(`pages.tacticalBoard.mobilePanel${mobilePanel[0].toUpperCase()}${mobilePanel.slice(1)}`)}</h3>
                    <button type="button" style={mobileSheetClose} onClick={() => setMobilePanel(null)}>✕</button>
                  </div>

                  {mobilePanel === "players" && (
                    <div style={mobileSheetContent}>
                      <div style={mobileInlineControls}>
                        <label style={mobileFieldLabel}>
                          {t("pages.tacticalBoard.ownTeam")}
                          <select value={ownFormation} onChange={(event) => changeOwnFormation(event.target.value)} style={mobileSelect}>
                            {formationOptions.map((formation) => <option key={formation}>{formation}</option>)}
                          </select>
                        </label>
                        <label style={mobileFieldLabel}>
                          {t("pages.tacticalBoard.opponents")}
                          <select value={opponentFormation} onChange={(event) => changeOpponentFormation(event.target.value)} style={mobileSelect}>
                            {formationOptions.map((formation) => <option key={formation}>{formation}</option>)}
                          </select>
                        </label>
                      </div>
                      <div style={mobilePlayerList}>
                        {benchPlayers.slice(0, 12).map((player) => (
                          <button key={player.id} type="button" style={mobilePlayerButton} onClick={() => addPlayerToLineup(player)}>
                            <span style={mobilePlayerNumber}>{player.number ?? "-"}</span>
                            <span style={mobilePlayerName}>{player.name}</span>
                          </button>
                        ))}
                        {!benchPlayers.length && <div style={mobileEmpty}>{t("pages.tacticalBoard.noStartersSelected")}</div>}
                      </div>
                      <button type="button" style={mobileActionButton} onClick={clearLineup}>{t("pages.tacticalBoard.btnClearLineup")}</button>
                    </div>
                  )}

                  {mobilePanel === "objects" && (
                    <div style={mobileSheetGrid}>
                      {MOBILE_OBJECT_TOOLS.map((tool) => (
                        <button key={tool.key} type="button" style={{ ...mobileChoiceButton, ...(selectedObject?.type === tool.key ? mobileChoiceButtonActive : {}) }} onClick={() => insertMobileObject(tool.key)}>
                          <span style={mobileChoiceIcon}>{tool.icon}</span>
                          <span>{t(`pages.tacticalBoard.${tool.titleKey}`)}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {mobilePanel === "lines" && (
                    <div style={mobileSheetContent}>
                      <div style={mobileSheetGrid}>
                        {MOBILE_LINE_TOOLS.map((tool) => (
                          <button key={tool.key} type="button" style={{ ...mobileChoiceButton, ...(activeTool === tool.key ? mobileChoiceButtonActive : {}) }} onClick={() => selectMobileTool(tool.key)}>
                            <span style={mobileChoiceIcon}>{tool.icon}</span>
                            <span>{t(`pages.tacticalBoard.${tool.titleKey}`)}</span>
                          </button>
                        ))}
                      </div>
                      <div style={mobileColorRow}>
                        {DRAW_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            title={c.label}
                            onClick={() => {
                              setDrawColor(c.value);
                              if (selectedShape) updateSelectedShape({ color: c.value });
                              if (selectedObject) updateSelectedObject({ color: c.value });
                            }}
                            style={{
                              ...mobileColorButton,
                              background: c.value,
                              boxShadow: drawColor === c.value ? "0 0 0 3px rgba(250,204,21,0.75)" : "none",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {mobilePanel === "field" && (
                    <div style={mobileSheetContent}>
                      <div style={mobileThemeRow}>
                        {Object.entries(FIELD_THEMES).map(([key, theme]) => (
                          <button key={key} type="button" style={{ ...mobileThemeButton, ...(fieldTheme === key ? mobileChoiceButtonActive : {}) }} onClick={() => setFieldTheme(key)}>
                            <span style={{ ...mobileThemeSwatch, background: theme.swatch }} />
                            <span>{t(`pages.tacticalBoard.${theme.titleKey}`)}</span>
                          </button>
                        ))}
                      </div>
                      <div style={mobileInlineControls}>
                        <label style={mobileFieldLabel}>
                          {t("pages.tacticalBoard.fieldWidthLabel")}
                          <input style={mobileNumberInput} type="number" value={areaSize.width} min="1" max="60" onChange={(event) => updateAreaSize("width", event.target.value)} />
                        </label>
                        <label style={mobileFieldLabel}>
                          {t("pages.tacticalBoard.fieldLengthLabel")}
                          <input style={mobileNumberInput} type="number" value={areaSize.length} min="1" max="110" onChange={(event) => updateAreaSize("length", event.target.value)} />
                        </label>
                      </div>
                      <div style={mobileInlineActions}>
                        <button type="button" style={mobileActionButton} onClick={addSizedArea}>{t("pages.tacticalBoard.insertArea")}</button>
                        <button type="button" style={mobileActionButton} onClick={addFrame}><Plus size={15} /> Frame</button>
                        <button type="button" style={mobileActionButton} onClick={toggleFramePlayback} disabled={boardFrames.length < 2}>
                          {isPlayingFrames ? <Pause size={15} /> : <Play size={15} />} {boardFrames.length || "0/0"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!mobileFullscreenActive && <div style={boardStyles.legend}>
              <span style={boardStyles.legendItem}><i style={boardStyles.dotBlue} />{t("pages.tacticalBoard.ownTeam")}</span>
              <span style={boardStyles.legendItem}><i style={boardStyles.dotRed} />{t("pages.tacticalBoard.opponents")}</span>
            </div>}
          </AppCard>
        </div>



        {!mobileFullscreenActive && <div style={boardStyles.sideColumn}>
          <AppCard>
            <h3 style={styles.cardTitle}>{t("pages.tacticalBoard.gamePrinciples")}</h3>
            <div style={boardStyles.notes}>
              <Note title={t("pages.tacticalBoard.costruzione")} value={notes.costruzione} onChange={(v) => setNotes((p) => ({ ...p, costruzione: v }))} />
              <Note title={t("pages.tacticalBoard.rifinitura")} value={notes.rifinitura} onChange={(v) => setNotes((p) => ({ ...p, rifinitura: v }))} />
              <Note title={t("pages.tacticalBoard.transizione")} value={notes.transizione} onChange={(v) => setNotes((p) => ({ ...p, transizione: v }))} />
              <Note title={t("pages.tacticalBoard.nonPossesso")} value={notes.nonPossesso} onChange={(v) => setNotes((p) => ({ ...p, nonPossesso: v }))} />
            </div>
          </AppCard>

          <AppCard>
            <h3 style={styles.cardTitle}>{t("pages.tacticalBoard.starters", { count: selectedLineup.length })}</h3>
            <div style={boardStyles.lineup}>
              {selectedLineup.length ? (
                selectedLineup.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    style={{ ...boardStyles.lineupPlayer, textAlign: "left", cursor: "pointer" }}
                    onClick={() => removePlayerFromLineup(player)}
                    aria-label={t("pages.tacticalBoard.removeFromLineup", { name: player.name })}
                  >
                    <div style={boardStyles.lineupNumber}>{player.number || "--"}</div>
                    <div style={boardStyles.lineupInfo}>
                      <strong>{player.name}</strong>
                      <span>{player.role || t("pages.tacticalBoard.player")}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div style={boardStyles.emptyLineup}>{t("pages.tacticalBoard.noStartersSelected")}</div>
              )}
            </div>
          </AppCard>

          <AppCard>
            <h3 style={styles.cardTitle}>{t("pages.tacticalBoard.bench", { count: availablePlayers.length - selectedLineup.length })}</h3>

            {selectedSlotId && (
              <div style={boardStyles.slotHint}>
                {t("pages.tacticalBoard.benchSlotHint")} <strong>{boardPlayers.find((p) => p.id === selectedSlotId)?.slotRole}</strong>
              </div>
            )}

            <div style={boardStyles.bench}>
              {availablePlayers
                .filter((player) => !selectedLineup.some((selected) => selected.id === player.id))
                .map((player) => (
                  <div
                    key={player.id}
                    style={{
                      ...boardStyles.benchPlayer,
                      ...(selectedBenchPlayer?.id === player.id ? boardStyles.benchPlayerSelected : {}),
                    }}
                    onClick={() => {
                      setSelectedBenchPlayer(player);
                      addPlayerToLineup(player);
                    }}
                  >
                    <div style={boardStyles.benchNumber}>{player.number || "--"}</div>
                    <div style={boardStyles.benchInfo}>
                      <strong>{player.name}</strong>
                      <span>{player.role || t("pages.tacticalBoard.player")}</span>
                    </div>
                  </div>
                ))}
            </div>
          </AppCard>

          {/* ── Schemi Salvati ── */}
          <AppCard>
            <h3 style={styles.cardTitle}>{t("pages.tacticalBoard.savedSchemas")}</h3>

            {/* Salva schema corrente */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                placeholder={t("pages.tacticalBoard.schemaNamePlaceholder")}
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCurrentSchema()}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 10,
                  color: "white",
                  padding: "8px 11px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={saveCurrentSchema}
                style={boardStyles.frameAddButton}
              >
                {t("pages.tacticalBoard.btnSave")}
              </button>
              {schemaSaved && <span style={{ color: "#4ade80", fontSize: 13, marginLeft: 8 }}>{t("pages.tacticalBoard.btnSaved")}</span>}
            </div>

            {/* Esporta in esercizi */}
            <button
              type="button"
              onClick={openExerciseModal}
              style={boardStyles.exportExerciseBtn}
            >
              {t("pages.tacticalBoard.btnInsertExercise")}
            </button>

            {/* Preset palle inattive */}
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0, color: "#64748b", margin: "12px 0 8px" }}>
              {t("pages.tacticalBoard.presetSchemas")}
            </p>
            <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
              {PRESET_SCHEMAS.map((preset) => (
                <div key={preset.id} style={boardStyles.schemaRow}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 12, lineHeight: 1.2, display: "block" }}>{preset.name}</strong>
                    <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{preset.category}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadSchema(preset)}
                    style={boardStyles.schemaLoadBtn}
                  >
                    {t("pages.tacticalBoard.btnLoad")}
                  </button>
                </div>
              ))}
            </div>

            {/* Schemi personalizzati */}
            {savedSchemas.length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0, color: "#64748b", margin: "0 0 8px" }}>
                  {t("pages.tacticalBoard.customSchemas", { count: savedSchemas.length })}
                </p>
                <div style={{ display: "grid", gap: 6 }}>
                  {savedSchemas.map((schema) => (
                    <div key={schema.id} style={boardStyles.schemaRow}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 12, lineHeight: 1.2, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {schema.name}
                        </strong>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{schema.ownFormation}</span>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => loadSchema(schema)}
                          style={boardStyles.schemaLoadBtn}
                        >
                          {t("pages.tacticalBoard.btnLoad")}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSchema(schema.id)}
                          style={{ ...boardStyles.schemaLoadBtn, background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {savedSchemas.length === 0 && (
              <p style={{ color: "#475569", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                {t("pages.tacticalBoard.noSavedSchemasHint")}
              </p>
            )}
          </AppCard>
        </div>}
      </div>
      </div>
    </div>
  );
}
/* ─── Esercizio export styles ─────────────────────────────────────────────── */
const exStyles = {
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 18px",
    marginBottom: 16,
    borderRadius: 14,
    background: "rgba(234,179,8,0.1)",
    border: "1px solid rgba(234,179,8,0.3)",
    flexWrap: "wrap",
  },
  bannerText: {
    fontSize: 13,
    color: "#fde68a",
    lineHeight: 1.4,
  },
  bannerBack: {
    background: "transparent",
    border: "none",
    color: "#fbbf24",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
    padding: 0,
    flexShrink: 0,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "grid",
    placeItems: "center",
    zIndex: 9999,
    padding: 20,
  },
  modal: {
    background: "#1a1f2e",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 28,
    width: "min(460px, 100%)",
    boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 15,
    outline: "none",
    marginBottom: 4,
  },
  feedback: {
    marginTop: 10,
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 600,
  },
  feedbackOk: {
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.28)",
    color: "#86efac",
  },
  feedbackErr: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.26)",
    color: "#fca5a5",
  },
  btnPrimary: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  },
  btnGhost: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#94a3b8",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
};

const FIELD_THEMES = {
  auto: {
    titleKey: "fieldThemeAuto",
    swatch: "linear-gradient(135deg,#22c55e 0 50%,#64748b 50% 100%)",
    style: {
      background:
        "linear-gradient(180deg, rgba(34,197,94,0.18), transparent 56%), repeating-linear-gradient(90deg, rgba(22,163,74,0.72) 0, rgba(22,163,74,0.72) 76px, rgba(21,128,61,0.72) 76px, rgba(21,128,61,0.72) 152px)",
    },
  },
  green: {
    titleKey: "fieldThemeGreen",
    swatch: "#16a34a",
    style: {
      background:
        "linear-gradient(180deg, rgba(34,197,94,0.2), transparent 56%), repeating-linear-gradient(90deg, rgba(22,163,74,0.75) 0, rgba(22,163,74,0.75) 76px, rgba(21,128,61,0.75) 76px, rgba(21,128,61,0.75) 152px)",
    },
  },
  grey: {
    titleKey: "fieldThemeGrey",
    swatch: "#64748b",
    style: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.07), transparent 26%), linear-gradient(180deg, rgba(100,116,139,0.62), rgba(71,85,105,0.54)), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0, rgba(255,255,255,0.035) 70px, transparent 70px, transparent 140px)",
    },
  },
  dark: {
    titleKey: "fieldThemeDark",
    swatch: "#111827",
    style: {
      background:
        "linear-gradient(180deg, rgba(30,41,59,0.86), rgba(15,23,42,0.84)), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 70px, transparent 70px, transparent 140px)",
    },
  },
};

const MOBILE_OBJECT_TOOLS = [
  { key: "ball", titleKey: "stampBall", icon: "⚽" },
  { key: "cone", titleKey: "stampCone", icon: "🔺" },
  { key: "goal", titleKey: "stampGoal", icon: "▱" },
  { key: "pole", titleKey: "stampPole", icon: "│" },
  { key: "hurdle", titleKey: "stampHurdle", icon: "▰" },
  { key: "ring", titleKey: "stampRing", icon: "○" },
  { key: "ladder", titleKey: "stampLadder", icon: "▤" },
];

const MOBILE_LINE_TOOLS = [
  { key: "move", titleKey: "moveToolTip", icon: "✥" },
  { key: "line", titleKey: "lineTypeLine", icon: "━" },
  { key: "dashed", titleKey: "lineTypeDashed", icon: "┄" },
  { key: "arrow", titleKey: "lineTypeArrow", icon: "↗" },
  { key: "curve", titleKey: "lineTypeCurve", icon: "⌒" },
  { key: "curve-dashed", titleKey: "lineTypeCurveDashed", icon: "⌁" },
  { key: "zone", titleKey: "lineTypeZone", icon: "▭" },
];

const mobileTopBar = {
  position: "fixed",
  top: "max(8px, env(safe-area-inset-top))",
  left: 8,
  right: 8,
  zIndex: 260,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px",
  borderRadius: 18,
  background: "rgba(2,6,23,0.86)",
  border: "1px solid rgba(255,255,255,0.09)",
  boxShadow: "0 14px 36px rgba(0,0,0,0.42)",
  backdropFilter: "blur(14px)",
};

const mobileTopButton = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(15,23,42,0.9)",
  color: "#e2e8f0",
  display: "grid",
  placeItems: "center",
  fontSize: 20,
  fontWeight: 900,
  cursor: "pointer",
};

const mobileTopButtonActive = {
  border: "1px solid rgba(250,204,21,0.78)",
  background: "rgba(250,204,21,0.16)",
  color: "#fde68a",
};

const mobileDock = {
  position: "fixed",
  left: "50%",
  bottom: "max(10px, env(safe-area-inset-bottom))",
  transform: "translateX(-50%)",
  zIndex: 260,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 24,
  background: "rgba(2,6,23,0.86)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 14px 36px rgba(0,0,0,0.42)",
  backdropFilter: "blur(14px)",
};

const mobileDockButton = {
  width: 54,
  height: 50,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(15,23,42,0.95)",
  color: "#e2e8f0",
  display: "grid",
  placeItems: "center",
  gap: 1,
  fontSize: 19,
  fontWeight: 900,
  cursor: "pointer",
};

const mobileDockButtonActive = {
  border: "1px solid rgba(250,204,21,0.82)",
  background: "rgba(250,204,21,0.16)",
  color: "#fde68a",
  boxShadow: "0 0 0 2px rgba(250,204,21,0.12)",
};

const mobileDockIcon = {
  lineHeight: 1,
  fontSize: 18,
};

const mobileDockLabel = {
  fontSize: 9,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
};

const mobileSheetBackdrop = {
  position: "fixed",
  inset: 0,
  zIndex: 270,
  display: "flex",
  alignItems: "flex-end",
  background: "linear-gradient(180deg, rgba(2,6,23,0.08), rgba(2,6,23,0.58))",
};

const mobileSheet = {
  width: "100%",
  maxHeight: "62dvh",
  overflowY: "auto",
  borderRadius: "28px 28px 0 0",
  border: "1px solid rgba(255,255,255,0.1)",
  borderBottom: "none",
  background: "rgba(2,6,23,0.97)",
  color: "#f8fafc",
  padding: "10px 18px max(18px, env(safe-area-inset-bottom))",
  boxShadow: "0 -22px 60px rgba(0,0,0,0.48)",
};

const mobileSheetHandle = {
  width: 58,
  height: 5,
  borderRadius: 999,
  background: "rgba(148,163,184,0.7)",
  margin: "0 auto 18px",
};

const mobileSheetHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 16,
};

const mobileSheetTitle = {
  margin: 0,
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
};

const mobileSheetClose = {
  width: 40,
  height: 40,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(15,23,42,0.95)",
  color: "#e2e8f0",
  fontWeight: 950,
  cursor: "pointer",
};

const mobileSheetContent = {
  display: "grid",
  gap: 14,
};

const mobileSheetGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const mobileChoiceButton = {
  minHeight: 78,
  borderRadius: 18,
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(30,41,59,0.9)",
  color: "#e2e8f0",
  display: "grid",
  placeItems: "center",
  gap: 6,
  padding: "10px 8px",
  fontSize: 11,
  fontWeight: 900,
  textAlign: "center",
  cursor: "pointer",
};

const mobileChoiceButtonActive = {
  border: "2px solid rgba(250,204,21,0.92)",
  background: "rgba(250,204,21,0.16)",
  color: "#fef3c7",
};

const mobileChoiceIcon = {
  fontSize: 25,
  lineHeight: 1,
};

const mobileColorRow = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 10,
};

const mobileColorButton = {
  height: 44,
  borderRadius: 999,
  border: "2px solid rgba(255,255,255,0.16)",
  cursor: "pointer",
};

const mobileInlineControls = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const mobileFieldLabel = {
  display: "grid",
  gap: 7,
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
};

const mobileSelect = {
  width: "100%",
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,23,42,0.95)",
  color: "#f8fafc",
  padding: "0 10px",
  fontWeight: 900,
};

const mobileNumberInput = {
  ...mobileSelect,
  appearance: "textfield",
};

const mobilePlayerList = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 9,
  maxHeight: 178,
  overflowY: "auto",
};

const mobilePlayerButton = {
  minHeight: 52,
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(30,41,59,0.88)",
  color: "#f8fafc",
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 10px",
  cursor: "pointer",
  minWidth: 0,
};

const mobilePlayerNumber = {
  width: 30,
  height: 30,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg,#3b82f6,#2563eb)",
  color: "white",
  fontSize: 13,
  fontWeight: 950,
  flexShrink: 0,
};

const mobilePlayerName = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 13,
  fontWeight: 900,
};

const mobileEmpty = {
  gridColumn: "1 / -1",
  padding: 14,
  borderRadius: 14,
  background: "rgba(15,23,42,0.82)",
  color: "#94a3b8",
  fontWeight: 800,
  textAlign: "center",
};

const mobileActionButton = {
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid rgba(250,204,21,0.28)",
  background: "rgba(250,204,21,0.14)",
  color: "#fde68a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 12px",
  fontWeight: 950,
  cursor: "pointer",
};

const mobileInlineActions = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 9,
};

const mobileThemeRow = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 9,
};

const mobileThemeButton = {
  minHeight: 70,
  borderRadius: 18,
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(30,41,59,0.9)",
  color: "#e2e8f0",
  display: "grid",
  placeItems: "center",
  gap: 7,
  padding: "9px 7px",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
};

const mobileThemeSwatch = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "2px solid rgba(255,255,255,0.25)",
};
