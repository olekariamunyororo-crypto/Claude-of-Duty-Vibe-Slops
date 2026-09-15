// Minimal KHR_materials_pbrSpecularGlossiness support for GLTFLoader.
//
// This Khronos extension was archived years ago and three.js dropped its
// built-in handler, but some Sketchfab exports (this project's ghost.glb)
// still use it — occasionally as a *required* extension. Registering a
// plugin under this name converts the legacy diffuse/specular/glossiness
// factors into three.js's standard metallic-roughness workflow, so affected
// models get correct base-color textures and plausible shading instead of
// silently falling back to a blank white, fully-metallic default material.
//
// Typed loosely (`any`) on purpose: this same function is registered on both
// three's own GLTFLoader (used for the geometry probe/triangle count) and
// three-stdlib's GLTFLoader (used by drei's useGLTF for rendering) — two
// separate modules with structurally similar but not identical type
// declarations. `three`-level types (Color, MeshStandardMaterial,
// SRGBColorSpace) are shared by both, so those stay properly typed.
import { Color, MeshStandardMaterial, SRGBColorSpace } from 'three';

const EXT_NAME = 'KHR_materials_pbrSpecularGlossiness';
const DIELECTRIC_SPECULAR = 0.04;

interface SpecGlossDef {
  diffuseFactor?: [number, number, number, number];
  diffuseTexture?: { index: number; texCoord?: number };
  specularFactor?: [number, number, number];
  glossinessFactor?: number;
  specularGlossinessTexture?: { index: number; texCoord?: number };
}

/** Approximate metalness from average diffuse/specular reflectance (quadratic solve). */
function solveMetallic(diffuseAvg: number, specularAvg: number): number {
  if (specularAvg < DIELECTRIC_SPECULAR) return 0;
  const a = DIELECTRIC_SPECULAR;
  const b =
    (diffuseAvg * (1 - specularAvg)) / Math.max(1 - DIELECTRIC_SPECULAR, 1e-6) +
    specularAvg - 2 * DIELECTRIC_SPECULAR;
  const c = DIELECTRIC_SPECULAR - specularAvg;
  const d = Math.max(b * b - 4 * a * c, 0);
  return Math.min(Math.max((-b + Math.sqrt(d)) / (2 * a), 0), 1);
}

class SpecGlossPlugin {
  name = EXT_NAME;
  private parser: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(parser: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.parser = parser;
  }

  getMaterialType(materialIndex: number): typeof MeshStandardMaterial | null {
    const def = this.parser.json.materials[materialIndex];
    if (!def.extensions || !def.extensions[EXT_NAME]) return null;
    return MeshStandardMaterial;
  }

  extendMaterialParams(materialIndex: number, materialParams: Record<string, unknown>): Promise<unknown> {
    const parser = this.parser;
    const def = parser.json.materials[materialIndex];
    const ext: SpecGlossDef | undefined = def.extensions?.[EXT_NAME];
    if (!ext) return Promise.resolve();

    const pending: Promise<unknown>[] = [];
    const diffuse = ext.diffuseFactor ?? [1, 1, 1, 1];
    (materialParams.color as Color).setRGB(diffuse[0], diffuse[1], diffuse[2]);
    materialParams.opacity = diffuse[3] ?? 1;

    if (ext.diffuseTexture) {
      pending.push(parser.assignTexture(materialParams, 'map', ext.diffuseTexture, SRGBColorSpace));
    }

    const specular = ext.specularFactor ?? [1, 1, 1];
    const glossiness = ext.glossinessFactor ?? 1;
    const diffuseAvg = (diffuse[0] + diffuse[1] + diffuse[2]) / 3;
    const specularAvg = (specular[0] + specular[1] + specular[2]) / 3;

    materialParams.roughness = Math.min(Math.max(1 - glossiness, 0), 1);
    materialParams.metalness = solveMetallic(diffuseAvg, specularAvg);

    // specularGlossinessTexture packs specular(RGB)+glossiness(A), which does
    // not line up with MeshStandardMaterial's roughness(G)/metalness(B)
    // texture packing — assigning it directly would look actively wrong, not
    // just imprecise, so we intentionally keep the flat factors above.

    return Promise.all(pending);
  }
}

/** Register on any GLTFLoader instance (three's or three-stdlib's). */
export function registerSpecGlossExtension(loader: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  loader.register((parser: any) => new SpecGlossPlugin(parser)); // eslint-disable-line @typescript-eslint/no-explicit-any
}
