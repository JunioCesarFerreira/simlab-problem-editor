import type { ProblemDraft, ExportedProblemFile } from '../models/problem'
import { hasCandidates } from '../models/problem'
import { buildSegmentExpressions } from './segmentExpressionBuilder'

export function exportProblem(draft: ProblemDraft): ExportedProblemFile {
  if (!draft.sink) throw new Error('Cannot export: sink is not defined')

  const candidatesOrSensors = hasCandidates(draft.name)
    ? { candidates: draft.candidates.map(c => [c.x, c.y] as [number, number]) }
    : { number_of_relays: draft.numSensors }

  return {
    problem: {
      name: draft.name,
      radius_of_reach: draft.radiusOfReach,
      radius_of_inter: draft.radiusOfInter,
      region: draft.region,
      sink: [draft.sink.x, draft.sink.y],
      ...candidatesOrSensors,
      mobile_nodes: draft.mobileNodes.map(m => ({
        name: m.name,
        source_code: m.sourceCode,
        speed: m.speed,
        time_step: m.timeStep,
        is_closed: m.isClosed,
        is_round_trip: m.isRoundTrip,
        path_segments: m.segments.map(buildSegmentExpressions),
      })),
    },
  }
}
