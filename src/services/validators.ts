import type { ProblemDraft } from '../models/problem'

export type ValidationError = { field: string; message: string }

export function validateProblem(draft: ProblemDraft): ValidationError[] {
  const errors: ValidationError[] = []
  if (!draft.name.trim()) errors.push({ field: 'name', message: 'Name is required' })
  if (draft.radiusOfReach <= 0) errors.push({ field: 'radius_of_reach', message: 'radius_of_reach must be > 0' })
  if (draft.radiusOfInter <= 0) errors.push({ field: 'radius_of_inter', message: 'radius_of_inter must be > 0' })
  const [xmin, ymin, xmax, ymax] = draft.region
  if (xmin >= xmax) errors.push({ field: 'region', message: 'xmin must be < xmax' })
  if (ymin >= ymax) errors.push({ field: 'region', message: 'ymin must be < ymax' })
  if (!draft.sink) {
    errors.push({ field: 'sink', message: 'Sink is required' })
  } else {
    const { x, y } = draft.sink
    if (x < xmin || x > xmax || y < ymin || y > ymax)
      errors.push({ field: 'sink', message: 'Sink must be inside region' })
  }
  for (const c of draft.candidates) {
    if (c.x < xmin || c.x > xmax || c.y < ymin || c.y > ymax)
      errors.push({ field: 'candidates', message: `Candidate (${c.x},${c.y}) is outside region` })
  }
  for (const m of draft.mobileNodes) {
    if (!m.name.trim()) errors.push({ field: 'mobile_nodes', message: 'Mobile node name required' })
    if (!m.sourceCode.trim()) errors.push({ field: 'mobile_nodes', message: `Node "${m.name}": source_code required` })
    if (m.speed <= 0) errors.push({ field: 'mobile_nodes', message: `Node "${m.name}": speed must be > 0` })
    if (m.timeStep <= 0) errors.push({ field: 'mobile_nodes', message: `Node "${m.name}": time_step must be > 0` })
    if (m.segments.length === 0) errors.push({ field: 'mobile_nodes', message: `Node "${m.name}": needs at least one segment` })
  }
  return errors
}
