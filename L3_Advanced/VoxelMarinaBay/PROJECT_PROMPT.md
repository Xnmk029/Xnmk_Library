# Task Background

Create a voxel-style digital scale model of Singapore's Marina Bay and Downtown Core district. The core purpose of this project is to assess the model's combined ability to recreate a city at voxel scale, make landmark buildings recognizable, support both bird's-eye and first-person exploration, and create convincing lighting and atmosphere.

# Scope of Requirements

## City and Spatial Reconstruction

- Recreate Singapore's real Marina Bay and CBD cityscape using **extremely detailed voxels**, including but not limited to:
  - The Marina Bay waterfront (waterfront promenades, boardwalks, the Singapore River mouth, and the bay basin)
  - The texture of dense urban blocks, integrated garden greenery, and the surrounding road network
  - The central financial district (Raffles Place / Downtown Core) skyscraper cluster
  - Iconic landmark structures (Marina Bay Sands with its tri-tower base and SkyPark cantilever, the ArtScience Museum, the Merlion Park waterfront, and key CBD towers such as UOB Plaza, One Raffles Place, and Guoco Tower)
  - The road and bridge network (Marina Boulevard, Collyer Quay, surrounding pedestrian and vehicular bridges like the Helix Bridge or Sheares Bridge, and moving traffic; vehicle motion can be simple but must be present)
  - Singapore's highly recognizable Marina Bay skyline silhouette

## Camera Modes and Interaction

- **Bird's-eye view**: Show the grand scale of Marina Bay and the Downtown Core waterfront in full, with zooming and orbiting (an orbit camera or equivalent controls).
- **Immersive first-person view**: Let the player enter the voxel world and move freely through city streets, waterfront promenades, plazas, and between towers, conveying realistic scale and a bustling atmosphere.
- The two modes must be switchable, with clear control instructions.

## Lighting, Materials, and Environment

- Aim for cinematic lighting: sensible day/night conditions or a primary light direction, shadows, and ambient light; avoid a uniformly flat, plastic look.
- Give materials a realistic feel within the voxel style: distinguish reflective glass curtain walls, concrete, bay water, asphalt roads, lush equatorial greenery, and boardwalk timber.
- Include at least one dynamic environmental effect: moving bay water reflections, traffic flows, clouds/atmospheric haze, skyline night illumination, a day/night cycle, or similar.

## Style

- Combine voxel art with a digital-twin/open-world experience; aim for an art-quality, game-quality voxel world of Marina Bay.
- Demonstrate spatial understanding, architectural reconstruction, visual design, and an immersive experience to the greatest extent possible.

# Delivery Constraints

- Prefer a **single HTML file** (engines such as Three.js may be loaded from a reliable CDN) that runs when double-clicked.
- Build the buildings and city layout primarily with **procedural voxels**; do not make externally downloaded 3D model files the main content (CDN-hosted engine libraries are an exception).
- Do not copy projects from outside the workspace; do not pass off a single texture or video as an interactive scale model.
- Do not include TODOs or unfinished placeholders.
- Explain the controls and how to switch modes in the interface or in a README/log.
