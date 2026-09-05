import * as Localization from 'expo-localization';

export type UnitSystem = 'metric' | 'imperial';

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

/**
 * Everything is stored in kilograms and centimetres. These helpers convert at the display and
 * input boundaries only — nothing converted here is ever written to the database.
 */

export function weightUnitLabel(system: UnitSystem) {
  return system === 'imperial' ? 'lb' : 'kg';
}

/** Storage (kg) -> what the user sees. */
export function toDisplayWeight(kg: number, system: UnitSystem): number {
  const value = system === 'imperial' ? kg / KG_PER_LB : kg;
  return Math.round(value * 10) / 10;
}

/** What the user typed -> storage (kg). */
export function toStorageWeight(value: number, system: UnitSystem): number {
  const kg = system === 'imperial' ? value * KG_PER_LB : value;
  // Three decimals keeps a pound-entered value round-tripping back to the same pound reading.
  return Math.round(kg * 1000) / 1000;
}

/** Formats a weight with its unit, dropping a trailing ".0" so "60 kg" doesn't read "60.0 kg". */
export function formatWeight(kg: number, system: UnitSystem): string {
  const value = toDisplayWeight(kg, system);
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${text} ${weightUnitLabel(system)}`;
}

/** Formats a total tonnage, where decimals are noise and thousands separators help. */
export function formatVolume(kg: number, system: UnitSystem, language: string): string {
  const value = Math.round(toDisplayWeight(kg, system));
  return `${value.toLocaleString(language)} ${weightUnitLabel(system)}`;
}

/**
 * Smallest sensible increment for the +/- buttons: 2.5 kg is the lightest common plate pair on a
 * metric bar, 5 lb its imperial equivalent.
 */
export function weightStep(system: UnitSystem): number {
  return system === 'imperial' ? 5 : 2.5;
}

export function toDisplayHeight(cm: number, system: UnitSystem): { feet: number; inches: number } | number {
  if (system === 'metric') return cm;
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: Math.round(totalInches - feet * 12) };
}

export function heightFromFeetInches(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH * 10) / 10;
}

export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === 'metric') return `${cm} cm`;
  const imperial = toDisplayHeight(cm, system);
  if (typeof imperial === 'number') return `${imperial} cm`;
  return `${imperial.feet}'${imperial.inches}"`;
}

/**
 * Best guess before the user has said anything, taken from the device locale. `uk` maps to metric:
 * British gyms label plates in kilograms even though bodyweight is often discussed in stones.
 */
export function deviceUnitSystem(): UnitSystem {
  const measurement = Localization.getLocales()[0]?.measurementSystem;
  return measurement === 'us' ? 'imperial' : 'metric';
}
