// The SRD's rules chapters. Only the compendium imports this, so it downloads on demand.
import rulesJson from './rules.json';
import type { Rule } from './index';

export const rules = rulesJson as Rule[];
