/**
 * ExerciseDiagram
 *
 * Single source of truth for rendering an exercise diagram.
 * Handles three diagram sources:
 *   1. tacticalBoard  — user-drawn TacticalBoard JSON   → TacticalMiniPreview
 *   2. source==="fp5" — generated SVG from exerciseContent → dangerouslySetInnerHTML
 *   3. image          — user-uploaded base64 / URL        → TacticalMiniPreview
 *
 * SECURITY NOTE: dangerouslySetInnerHTML is used ONLY for SVGs produced by
 * generateExerciseSvg() — a pure internal function that builds SVG markup from
 * exercise metadata using hard-coded paths and coordinates.
 * User-supplied images always flow through <TacticalMiniPreview> (rendered as
 * <img> or <canvas>), never through dangerouslySetInnerHTML.
 */

import { memo } from "react";
import { generateExerciseSvg } from "../../utils/exerciseContent";
import TacticalMiniPreview from "../ui/TacticalMiniPreview";

const ExerciseDiagram = memo(function ExerciseDiagram({
  exercise,
  /** Optional pre-computed SVG markup string — avoids double-computation when
   *  the caller already has it (e.g. for building a lightbox data-URI). */
  svgMarkup: svgMarkupProp,
  height = 220,
  /** onClick: makes the wrapper cursor: zoom-in */
  onClick,
  style = {},
}) {
  if (!exercise) return null;

  const wrapBase = {
    borderRadius: 12,
    overflow: "hidden",
    cursor: onClick ? "zoom-in" : "default",
    lineHeight: 0,
    ...style,
  };

  // ── 1. TacticalBoard (user-drawn) ────────────────────────────────────────
  if (exercise.tacticalBoard) {
    return (
      <div style={wrapBase} onClick={onClick}>
        <TacticalMiniPreview board={exercise.tacticalBoard} height={height} />
      </div>
    );
  }

  // ── 2. Generated SVG (FP5 catalog) ──────────────────────────────────────
  if (exercise.source === "fp5") {
    const markup = svgMarkupProp || generateExerciseSvg(exercise);
    return (
      <div style={wrapBase} onClick={onClick} dangerouslySetInnerHTML={{ __html: markup }} />
    );
  }

  // ── 3. User image ────────────────────────────────────────────────────────
  if (exercise.image) {
    return (
      <div style={wrapBase} onClick={onClick}>
        <TacticalMiniPreview imageSrc={exercise.image} height={height} />
      </div>
    );
  }

  return null;
});

export default ExerciseDiagram;
