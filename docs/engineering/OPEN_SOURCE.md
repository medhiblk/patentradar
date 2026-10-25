# CAD source evaluation — 2026-10-25

Actual GitHub repository metadata, licences reported by the API and push timestamps are in `repository-audit.json`. NOASSERTION is not a permissive licence determination. README/source licence checks complement the API; links below are primary upstream sources. No third-party CAD application source was copied into PatentRadar.

| Candidate | Licence / observed state | Capability and integration decision |
|---|---|---|
| [Chili3D](https://github.com/xiangechen/chili3d) | AGPL-3.0 app; current README separately describes LGPL C++ module | Rich browser CAD. Not embedded: network copyleft obligations / commercial licence must be considered first. |
| [CadQuery](https://github.com/CadQuery/cadquery) | Apache 2.0 confirmed by upstream README; GitHub API NOASSERTION | Selected, installed 2.6.1 and executed. Parametric solids, booleans, STEP import/export and tessellation. Good docs and active project; Python/OCP native runtime required. |
| [build123d](https://github.com/gumyr/build123d) | Apache 2.0, active | Good alternative OpenCascade Python interface; avoid duplicating native runtimes in first MVP. |
| [FreeCAD](https://github.com/FreeCAD/FreeCAD) | LGPL-2.1 reported; module-specific terms apply | Full desktop parametric CAD; heavier deployment and GUI/headless dependencies. Not copied or integrated. |
| [tarikdsm/step-viewer](https://github.com/tarikdsm/step-viewer) | No licence reported by API | Inspectable example, commercial reuse not established. Not reused. |
| [tegos/cad-3d-viewer](https://github.com/tegos/cad-3d-viewer) | MIT, active | Browser STEP/IGES/BREP using Babylon/occt-import-js. Useful future local import path; selected server CadQuery avoids a second geometry stack. |
| [Three.js](https://github.com/mrdoob/three.js) | MIT, active | Selected for actual interactive mesh display, orbit, raycasting, TransformControls. Not a solid-CAD kernel. |
| [Text2CAD](https://github.com/SadilKhan/Text2CAD) | NOASSERTION from metadata; weights/data licences require separate review | Research text-to-parametric CAD; model training/inference and data requirements make it slower to integrate than bounded structured AI + CadQuery. No weights installed. |
| [DeepCAD](https://github.com/ChrisWu1997/DeepCAD) | MIT source; last observed push 2024 | Generative CAD sequence research, not a ready general engineering-drawing reconstruction API. No adoption. |
| [agentcad](https://github.com/jdilla1277/agentcad) | Apache 2.0, maintained | Agent CLI/MCP for build123d/CadQuery, validation/export. Good future integration; execution of arbitrary generated Python needs a stronger sandbox. Current MVP uses fixed operations only. |
| [agentic-cad](https://github.com/dancher00/agentic-cad) | Apache 2.0 reported | Text/photos to CAD pipeline; external model/proxy credentials and sometimes GPU needed. No model or proxy keys assumed. |
| [CascadeStudio](https://github.com/zalo/CascadeStudio) | MIT source | Browser OpenCascade scripting. Potential future WASM editor; executing scripts is outside current fixed-operation security model. |
| [BRepNet](https://github.com/AutodeskAILab/BRepNet) | NOASSERTION in metadata | B-rep representation learning, not complete document-to-assembly generation. No adoption without full licence review. |
| [TRELLIS](https://github.com/microsoft/TRELLIS) | MIT repository; model/data notices separate | Image-to-3D research, GPU/model dependencies; visual meshes do not establish engineering dimensions or editable feature history. No weights installed. |

## Selected integration

Next.js validates bounded parameter JSON → isolated Python subprocess → CadQuery/OpenCascade creates a valid solid and STEP → STL tessellation → Three.js displays actual geometry. AI only proposes the specification; it cannot execute Python or issue arbitrary tools. Missing measurements remain null. No CAPTCHA bypass, scraping proxies or generated-code eval.

Apache/MIT top-level licences do not erase dependency obligations. CadQuery wheels include native dependencies with their own terms (notably OCCT/OCP LGPL with applicable exceptions, and CasADi/solver libraries). Preserve notices and review redistribution/source-offer requirements before distributing a native image commercially. PDFium/Pillow also have their own upstream notices. No GPL/AGPL application code from FreeCAD/Chili3D was incorporated.

## Browser deployment selection

Replicad 1.2.0's packaged LICENSE was inspected and is MIT (some indexed README snippets still contain obsolete/visualizer AGPL wording; the visualizer application is not embedded). `replicad-opencascadejs` 1.1.0 is LGPL-2.1-only. Its unmodified JS/WASM, licence text and upstream corresponding-source/build references are served together under `/cad-kernel/`. The loader remains dynamically loaded and replaceable. `scripts/prepare-cad-assets.mjs` copies pinned installed assets; no generated code is evaluated.
