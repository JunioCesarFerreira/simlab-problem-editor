# simlab-problem-editor

🌍 *[**English**](README.md) ∙ [Português](README_pt.md)*

Visual editor for authoring Wireless Sensor Network (WSN) problem instances compatible with the [SimLab](https://github.com/JunioCesarFerreira/simlab) experimentation pipeline.

**[Live demo](https://juniocesarferreira.github.io/simlab-problem-editor/)**

## Overview

**simlab-problem-editor** is a browser-based visual editor built with **Vue 3**, **TypeScript**, and **Pinia** for creating WSN problem instances in the JSON format expected by **SimLab**.

The tool was designed to simplify the definition of spatial network scenarios by replacing manual JSON authoring with an interactive canvas workflow. Instead of editing coordinates and trajectory expressions by hand, you can use a reference image, define the region of interest, place the sink and candidate nodes, draw mobile node paths, and export a problem instance directly.

This is particularly useful for scenarios in which the spatial structure matters, such as synthetic urban layouts, industrial monitoring areas, or mobility-aware communication experiments.

## What the editor does

With **simlab-problem-editor**, you can:

- load a background image as a spatial reference
- calibrate the canvas scale to real-world coordinates
- define the problem region
- place the sink node
- place and edit candidate fixed-node positions
- design mobile-node trajectories visually
- inspect communication reach through a connectivity overlay
- measure distances directly on the scene
- export the final instance as SimLab-compatible JSON

The exported output is intended to be consumed by SimLab’s optimization and simulation components.

## Main Features

- **Background image support**  
  Import a map, floor plan, sketch, or any other image to serve as a geometric reference for the scenario.

- **World-coordinate calibration**  
  Define scale using a known-distance segment so that all positions are converted consistently into world coordinates.

- **Region definition**  
  Specify the scenario bounding box in the form `[xmin, ymin, xmax, ymax]`.

- **Sink placement**  
  Insert exactly one sink node in the problem instance.

- **Candidate-node placement**  
  Add, move, and remove candidate positions for fixed communication nodes.

- **Mobile trajectory authoring**  
  Draw trajectories for mobile nodes using:
  - **Polyline segments**
  - **Elliptic paths**

- **Automatic parametric path generation**  
  Convert visually defined trajectories into parametric expressions suitable for downstream processing in SimLab.

- **Connectivity graph visualization**  
  Display edges between nodes that fall within the communication radius.

- **Measurement tool**  
  Measure distances in calibrated world units directly on the canvas.

- **Live JSON preview**  
  Inspect the generated instance in real time while editing.

- **JSON export**  
  Produce a valid `{ "problem": { ... } }` object ready to be used in SimLab workflows.

## Typical Workflow

1. Load a reference image.
2. Calibrate the image scale.
3. Define the scenario region.
4. Place the sink node.
5. Add candidate fixed-node positions.
6. Draw mobile-node trajectories.
7. Inspect connectivity and distances.
8. Export the generated JSON instance.

This workflow makes it easier to construct reproducible WSN scenarios without manually deriving coordinates and path expressions.

## Keyboard Shortcuts

| Key | Action |
|------|--------|
| `S` | Select tool |
| `K` | Place sink |
| `C` | Place candidate |
| `L` | Draw line / polyline segment |
| `E` | Draw ellipse |
| `M` | Measure distance |
| `R` | Calibrate scale |
| `G` | Toggle connectivity graph |
| `Del` | Remove selected element |
| `Esc` | Cancel current drawing |
| `Scroll` | Zoom |
| `Middle-drag` | Pan |

## Output Format

The editor exports JSON following the SimLab problem schema:

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
          [
            "cx + rx * np.cos(2 * np.pi * t)",
            "cy + ry * np.sin(2 * np.pi * t)"
          ]
        ]
      }
    ]
  }
}
````

### Notes on path expressions

* Each path segment is represented parametrically with `t ∈ [0, 1]`.
* Expressions may use `np.cos`, `np.sin`, and `np.pi`.
* The generated format is compatible with NumPy-based processing used in SimLab.

## Technology Stack

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Framework        | Vue 3 (Composition API) |
| Language         | TypeScript              |
| State Management | Pinia                   |
| Rendering        | HTML5 Canvas 2D         |
| Build Tool       | Vite                    |

## Getting Started

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

## Project Structure

```text
src/
  components/
    editor/
      ProblemEditor.vue      # Root editor layout
      CanvasView.vue         # Canvas rendering and interaction logic
      Toolbar.vue            # Tool buttons and editor actions
      PropertiesPanel.vue    # Editable properties of the selected element
      JsonPreviewPanel.vue   # Live JSON visualization
  stores/
    problemStore.ts          # Problem model state and export logic
    editorStore.ts           # UI state, active tool, viewport, overlays
  models/
    problem.ts               # Domain types and interfaces
  services/
    exportProblemJson.ts     # Conversion from editor state to SimLab JSON
```

## Use Cases

This editor is useful for:

* rapid prototyping of WSN scenarios
* mobility-aware network design experiments
* preparing benchmark instances for optimization pipelines
* generating problem inputs for simulation-based evaluation
* visually defining structured scenarios from maps or layout images

## Related Repositories

* [SimLab](https://github.com/JunioCesarFerreira/simlab) — experimentation, simulation, and optimization pipeline
* [wsn-design-space-exploration](https://github.com/JunioCesarFerreira/wsn-design-space-exploration) — MILP and multi-objective design-space exploration framework
* [Cooja-MO-SimLab](https://github.com/JunioCesarFerreira/Cooja-MO-SimLab) — early Cooja-based SimLab prototype

## License

This project is licensed under the **MIT License**.
