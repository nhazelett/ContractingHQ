# FARCADE — Professional 3D Handheld Asset Integration

Status: **source acquired and converted; binary upload and production integration remain pending**. Do not deploy the current procedurally built 3D shell as the final model.

## Asset conversion completed (2026-11-11)

User-supplied Sketchfab source ZIP was inspected. It contained a COLLADA `model/model.dae` with four geometry groups, plus PBR textures. The exact groups are **Case lp (11,932 triangles)**, **Plastic lp (2,288)**, **Metal lp (970)** and **Screen lp (160)**. This is a combined-material mesh, **not** one mesh per button. Thus individual button click animations need custom invisible 3D hit regions, manual mesh editing in Blender, or reconstruction of those few controls.

A browser-ready textured GLB has been converted locally: `farcade-professional-source.glb` (~8.6 MB), with UV-mapped case/plastic/metal/glass albedo, normal, ambient-occlusion and metallic/roughness images. Four meshes, 15,350 triangles total. The converted file and a separate interactive prototype are offered as a downloadable ZIP in the ChatGPT conversation. Geometry was visually inspected in an offscreen render, but the interactive Three.js preview has not been QA tested in a real browser.

**Deployment dependency:** GitHub connector cannot directly ingest this local binary GLB. The asset has NOT been pushed to the repository. To activate a GitHub-hosted version, place the exported GLB at `assets/farcade/models/farcade-professional-source.glb` through GitHub UI or another binary-capable Git workflow. Do not deploy the old procedural shell as the finished design. The on-site page currently still uses that earlier model until the GLB is uploaded and integrated.

## Preferred asset

- Creator: Wikiti
- Title: Game Boy Color
- URL: https://sketchfab.com/3d-models/game-boy-color-03c6fe28d45244d2acd55486e3cfee19
- Listed license: CC BY (verify rights and download archive's included license before use).
- Source modeling: Blender; texture work: Substance 3D Painter.
- Listing: ~15.4k triangles / 8k vertices.

Sketchfab's Download API requires an authenticated user. Obtain the asset using its official **Download 3D Model** control and retain the original archive, source URL, creator name and license. Do not circumvent authentication, scrape viewer payloads, or acquire an unlicensed copy.

## Required review before integrating

1. Open the original download in Blender. Inspect mesh hierarchy, PBR textures, image resolutions, UVs and model size.
2. Confirm there are independently addressable meshes for A, B, Start, Select and the D-pad (or create them through non-destructive extraction).
3. Create or isolate a sliding switch on the right-hand side and expose it as node **POWER_SWITCH**.
4. Replace brand/trademark artwork with **FARCADE** / **KTHQ**; do not imply Nintendo endorsement.
5. Create a flat, accurately aligned screen UV surface named **SCREEN_LCD** with its own material; preserve transparent cover glass as **SCREEN_GLASS**.
6. Name actionable mesh nodes **BUTTON_A**, **BUTTON_B**, **DPAD_UP**, **DPAD_DOWN**, **DPAD_LEFT**, **DPAD_RIGHT**, **BUTTON_START**, **BUTTON_SELECT**, **POWER_SWITCH**.
7. Re-export to GLB with textures embedded, verify normals/tangents and sRGB color texture vs linear normal/roughness maps.
8. Test in a real browser at desktop and mobile widths; verify click targets, power-on gating, camera pullback, and low-resolution game screen.
9. Optimize only after visual approval; prefer 2k textures or suitable compressed KTX2 when possible. Aim for a small initial payload without sacrificing the asset's signature texture character.

## Proposed runtime architecture

- Three.js GLTFLoader loads **assets/farcade/models/farcade-handheld.glb** from the same KTHQ origin.
- Preserve current game-selection state machine and each game's URLs.
- At first load, point camera toward right-hand POWER_SWITCH and leave SCREEN_LCD dark.
- On click or keyboard P, animate POWER_SWITCH and the camera into the static three-quarter front pose.
- Boot directly to game list (no separate Press Start gate).
- Use THREE.CanvasTexture applied to SCREEN_LCD material, refreshed only on game-selection/boot state changes.
- Raycast named meshes to dispatch input; no continuous parallax or idle device rotation.
- Show an accessible keyboard/controller fallback if WebGL is unavailable.
- Keep any required CC BY creator attribution in the UI and in documentation.

## Safety / performance gates

Do not ship the old procedural shell as the final design and do not represent it as professional PBR artwork. Do not load a GLB until its rights, texture maps and actual mesh node structure have been inspected. Keep changes in draft PR #17 until visual browser QA is completed.

## Model acquisition

Click the authorized download button on the Sketchfab page. Once downloaded, place the archive/GLB and any texture files into the development workspace or attach them to the FARCADE task for integration. Keep the original license metadata.
