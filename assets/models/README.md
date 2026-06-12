# Optional Marine Life Models

Place lightweight GLB/GLTF marine models here to replace the built-in fallback shapes in `ocean.js`.

Expected filenames:

- `fish.glb`
- `shark.glb`
- `whale.glb`

Recommended source:

- Quaternius animated animal or fish packs, preferably GLB/GLTF exports when available.
- Other downloadable models are fine if their license allows redistribution in this project.

Notes:

- Keep each model low-poly and web-friendly.
- If a file is missing or fails to load, the simulator keeps the built-in fallback creature.
- Current loader uses static model scenes. Animation clips can be wired later if the chosen pack includes compatible clips.
