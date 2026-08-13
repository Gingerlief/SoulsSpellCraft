
export type KindStyle = {
  label: string;
  color: string;
  blurb: string;
};

const KINDS: Record<string, KindStyle> = {
  magic: {
    label: 'Magic',
    color: '#db9c53',
    blurb: 'The spell row itself — the root of the graph.',
  },
  bullet: {
    label: 'Bullet',
    color: '#6fb3e0',
    blurb: 'A projectile or emitter. Can spawn further bullets.',
  },
  atk: {
    label: 'Attack',
    color: '#e0776f',
    blurb: 'Damage and hit behaviour applied on contact.',
  },
  spEffect: {
    label: 'SpEffect',
    color: '#b18fd6',
    blurb: 'A status or stat modifier. Chains into further SpEffects.',
  },
  spEffectVfx: {
    label: 'SpEffect VFX',
    color: '#6fd6c4',
    blurb: 'The bridge from a SpEffect to its FXR visuals.',
  },
  fxr: {
    label: 'FXR',
    color: '#d4cc7d',
    blurb: 'A visual effect file. Not a param row — lives on disk as f{id}.fxr.',
  },
  goods: {
    label: 'Goods',
    color: '#8fc98a',
    blurb: 'The inventory item: icon, name and description.',
  },
};

const UNKNOWN: KindStyle = {
  label: 'Unknown',
  color: '#6b7280',
  blurb: 'A node kind this build does not recognise. Check the engine version.',
};

export function kindStyle(kind: string): KindStyle {
  return KINDS[kind] ?? { ...UNKNOWN, label: kind };
}

export const KNOWN_KINDS = Object.keys(KINDS);

export function isHealthy(status: string): boolean {
  return status === 'resolved';
}

export function isSoftLink(resolution: string): boolean {
  return resolution === 'idConvention';
}

export function castBadge(castTypes: string[]): { text: string; title: string } | null {
  const set = new Set(castTypes);
  if (set.has('charged') && set.size === 1) {
    return {
      text: 'charged only',
      title: 'Reached only when the spell is cast charged.',
    };
  }
  if (set.has('charged')) {
    return {
      text: 'tap + charged',
      title: 'Shared between the normal and charged casts.',
    };
  }
  return null;
}
