/* ── LandXML 3D scene types ──────────────────────────────── */

export interface LandXmlSurface3D {
  name: string;
  /** Flat array of N*3 floats: [x0,y0,z0, x1,y1,z1, ...] in Three.js Y-up coords. */
  points: number[];
  /** Flat array of M*3 indices into ``points``. */
  faces: number[];
  elev_min: number;
  elev_max: number;
}

export interface LandXmlAlignment3D {
  name: string;
  /** Flat array of N*3 floats; consecutive vertices form a polyline. */
  polyline_3d: number[];
  has_profile: boolean;
}

export interface LandXmlSceneData {
  bounds3d: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
  /** ``[cE, cZ, cN]`` already subtracted from all coordinates. */
  world_offset: [number, number, number];
  surfaces: LandXmlSurface3D[];
  alignments: LandXmlAlignment3D[];
}
