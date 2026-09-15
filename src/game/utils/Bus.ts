// One-shot event bus for things that fire once and are not state.
type Handler = (payload?: unknown) => void;
const map = new Map<string, Set<Handler>>();

export const bus = {
  on(event: string, handler: Handler): () => void {
    let set = map.get(event);
    if (!set) { set = new Set(); map.set(event, set); }
    set.add(handler);
    return () => { set!.delete(handler); };
  },
  emit(event: string, payload?: unknown): void {
    map.get(event)?.forEach((h) => h(payload));
  },
};
