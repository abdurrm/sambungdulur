import type { TreeDoc } from './types';
import { DEFAULT_SETTINGS, emptyFields } from './types';
import { t } from '../i18n';

/**
 * Starter tree. Mirrors the shape observed on the original site (me + two parents),
 * with our own wording; no assets or copy are taken from the original.
 */
export function createDefaultTree(): TreeDoc {
  return {
    title: t('defaultTitle'),
    persons: {
      I1: {
        ...emptyFields(),
        id: 'I1',
        givenName: t('defMe'),
        gender: 'male',
        birthDate: '4 JUL 1994',
        birthPlace: 'United Kingdom',
        facts: t('defMeFacts'),
      },
      I2: {
        ...emptyFields(),
        id: 'I2',
        givenName: t('defFather'),
        gender: 'male',
        birthDate: '7 MAR 1965',
        birthPlace: 'United Kingdom',
        facts: t('defFatherFacts'),
      },
      I3: {
        ...emptyFields(),
        id: 'I3',
        givenName: t('defMother'),
        gender: 'female',
        birthDate: '6 FEB 1969',
        birthPlace: 'Ireland',
        facts: t('defMotherFacts'),
      },
    },
    families: { F1: { id: 'F1', partners: ['I2', 'I3'], children: ['I1'] } },
    order: ['I1', 'I2', 'I3'],
    familyOrder: ['F1'],
    focusId: 'I1',
    settings: { ...DEFAULT_SETTINGS, ancestorGenerations: -1, descendantGenerations: -1 },
    manual: { personDx: {}, familyDy: {} },
    media: {},
    origin: 'default',
    collapsed: {},
    gallery: {},
    compactCards: {},
  };
}
