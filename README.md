# simlab-problem-editor

Visual editor for authoring WSN problem instances compatible with the [SimLab](https://github.com/JunioCesarFerreira/simlab) simulation pipeline.

🇧🇷 [Leia em português](README_pt.md)

## Overview

**simlab-problem-editor** is a browser-based canvas editor built with **Vue 3 + TypeScript + Pinia** that lets you visually design Wireless Sensor Network (WSN) problem instances and export them as JSON in the exact format consumed by SimLab's optimization and simulation engine.

Instead of writing JSON by hand, you load a reference image of the deployment area, draw the region boundary, place the sink and candidate nodes, trace mobile node trajectories, and export — the tool generates the parametric path expressions automatically.

## Features

- **Background image** — load any image as a spatial reference; calibrate its bounds to world coordinates
- **Scale calibration** — drag a known-length segment on the image to rescale all world coordinates consistently
- **Region definition** — set the problem bounding box `[xmin, ymin, xmax, ymax]`
- **Sink placement** — place exactly one sink node on the canvas
- **Candidate placement** — add, move, and remove candidate sensor positions
- **Mobile node trajectories** — draw multi-segment routes using:
  - Polyline (piecewise linear)
  - Ellipse (generates trigonometric parametric expressions)
- **Connectivity graph** — toggle (`G` / ⬡ button) to visualize edges between nodes within `radiusOfReach`
- **Measure tool** — ruler to measure distances in world coordinates
- **JSON export** — generates a valid `{ "problem": { ... } }` file ready for SimLab
- **JSON preview** — live panel showing the current problem as formatted JSON

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Select tool |
| `K` | Place sink |
| `C` | Place candidate |
| `L` | Draw line (polyline segment) |
| `E` | Draw ellipse |
| `M` | Measure |
| `R` | Scale calibration |
| `G` | Toggle connectivity graph |
| `Del` | Remove selected element |
| `Esc` | Cancel current drawing |
| Scroll | Zoom |
| Middle-drag | Pan |

## Output Format

The editor exports JSON in the SimLab problem schema:

```json
{
  "problem": {
    "name": "example",
    "radius_of_reach": 100,
    "radius_of_inter": 200,
    "region": [-150, -150, 150, 150],
    "sink": [0, 0],
    "candidates": [[x1, y1], [x2, y2]],
    "mobile_nodes": [
      {
        "name": "node1",
        "source_code": "node.c",
        "speed": 5,
        "time_step": 1,
        "is_closed": true,
        "is_round_trip": false,
        "path_segments": [
          ["cx + rx * np.cos(2 * np.pi * t)", "cy + ry * np.sin(2 * np.pi * t)"]
        ]
      }
    ]
  }
}
```

Parametric expressions use `t ∈ [0, 1]` per segment and reference `np.cos`, `np.sin`, and `np.pi` — compatible with NumPy-based SimLab solvers.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API) |
| Language | TypeScript |
| State | Pinia |
| Rendering | HTML5 Canvas 2D |
| Build | Vite |

## Getting Started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Project Structure

```
src/
  components/
    editor/
      ProblemEditor.vue   # root editor layout
      CanvasView.vue      # canvas, tools, drawing logic
      Toolbar.vue         # tool buttons and toggles
      PropertiesPanel.vue # selected element properties
      JsonPreviewPanel.vue
  stores/
    problemStore.ts       # problem data and export logic
    editorStore.ts        # UI state (active tool, viewport, overlays)
  models/
    problem.ts            # domain types
  services/
    exportProblemJson.ts  # draft → SimLab JSON
```

## Related Repositories

- [SimLab](https://github.com/JunioCesarFerreira/simlab) — simulation and optimization engine
- [wsn-design-space-exploration](https://github.com/JunioCesarFerreira/wsn-design-space-exploration) — MILP / multi-objective comparison framework
- [Cooja-MO-SimLab](https://github.com/JunioCesarFerreira/Cooja-MO-SimLab) — early Cooja-based SimLab prototype

## License

MIT
