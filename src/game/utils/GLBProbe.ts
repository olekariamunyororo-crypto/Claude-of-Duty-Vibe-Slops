import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveYachtUrl, resolveNv4Url, resolveGhostUrl } from '../scene/modelStorage';
import { useGame } from '../store/gameStore';
import { registerSpecGlossExtension } from './GLTFSpecGloss';

export interface ModelProbeState { ok: boolean; placeholder: boolean; tris: number; url: string }

export const MODEL_STATE: Record<'yacht' | 'nv4' | 'ghost', ModelProbeState> = {
  yacht: { ok: false, placeholder: true, tris: 0, url: '' },
  nv4: { ok: false, placeholder: true, tris: 0, url: '' },
  ghost: { ok: false, placeholder: true, tris: 0, url: '' },
};

const modelUrl = (name: string) => `${import.meta.env.BASE_URL}models/${name}.glb`;

function countTris(root: unknown): number {
  let tris = 0;
  (root as { traverse?: (cb: (o: object) => void) => void })?.traverse?.((o: object) => {
    const m = o as { isMesh?: boolean; geometry?: { index?: { count: number } | null; attributes?: { position?: { count: number } } } };
    if (m.isMesh && m.geometry) {
      const idx = m.geometry.index;
      tris += idx ? idx.count / 3 : (m.geometry.attributes?.position?.count ?? 0) / 3;
    }
  });
  return tris;
}

async function probe(url: string): Promise<number | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const gltf = await new Promise<{ scene: unknown }>((resolve, reject) => {
      const loader = new GLTFLoader();
      registerSpecGlossExtension(loader);
      loader.parse(buf, '', resolve as never, reject as never);
    });
    return countTris(gltf.scene);
  } catch { return null; }
}

export async function probeModels(): Promise<void> {
  const [yachtUrl, nv4Url, ghostUrl] = await Promise.all([
    resolveYachtUrl(),
    resolveNv4Url(),
    resolveGhostUrl(),
  ]);
  const [y, n, g] = await Promise.all([
    probe(yachtUrl),
    probe(nv4Url),
    probe(ghostUrl),
  ]);
  const apply = (key: 'yacht' | 'nv4' | 'ghost', url: string, tris: number | null) => {
    const st = MODEL_STATE[key];
    st.url = url;
    st.ok = tris !== null;
    st.tris = tris ?? 0;
    st.placeholder = tris === null || tris < 100;
  };
  apply('yacht', yachtUrl, y);
  apply('nv4', nv4Url, n);
  apply('ghost', ghostUrl, g);
  useGame.getState().bumpDeploy();
}
