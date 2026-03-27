export type Region = [number, number, number, number] // [xmin, ymin, xmax, ymax]

export type DraftSegment =
  | { type: 'line'; start: [number, number]; end: [number, number] }
  | { type: 'ellipse'; center: [number, number]; radiusX: number; radiusY: number }
  | { type: 'custom'; exprX: string; exprY: string }

export type MobileRouteDraft = {
  id: string
  name: string
  sourceCode: string
  speed: number
  timeStep: number
  isClosed: boolean
  isRoundTrip: boolean
  segments: DraftSegment[]
}

export type CandidatePoint = {
  id: string
  x: number
  y: number
}

export type SinkPoint = {
  x: number
  y: number
}

export type ProblemDraft = {
  name: string
  radiusOfReach: number
  radiusOfInter: number
  region: Region
  sink: SinkPoint | null
  candidates: CandidatePoint[]
  mobileNodes: MobileRouteDraft[]
}

// Exported types (JSON output)
export type ExportedMobileNode = {
  path_segments: Array<[string, string]>
  is_closed: boolean
  is_round_trip: boolean
  speed: number
  time_step: number
  name: string
  source_code: string
}

export type ExportedProblem = {
  name: string
  radius_of_reach: number
  radius_of_inter: number
  region: Region
  sink: [number, number]
  candidates: Array<[number, number]>
  mobile_nodes: ExportedMobileNode[]
}

export type ExportedProblemFile = {
  problem: ExportedProblem
}
