/**
 * Shared OBJECTIVE_STATUS constant used across PostMatch, Trainings, and Dashboard.
 * Use `t(meta.labelKey)` to render translated labels.
 */
export const OBJECTIVE_STATUS = {
  todo:    { labelKey: "objectiveStatus.todo",    tone: "orange" },
  worked:  { labelKey: "objectiveStatus.worked",  tone: "blue"   },
  solved:  { labelKey: "objectiveStatus.solved",  tone: "green"  },
};

export function getObjectiveStatusMeta(status) {
  return OBJECTIVE_STATUS[status] || OBJECTIVE_STATUS.todo;
}
