
import type { Card, CardDefinition } from '../state/types';
import baseDeckData from '../../data/cards/base-deck.json';

const allDefinitions: CardDefinition[] = [
  ...baseDeckData.evidence,
  ...baseDeckData.objections,
  ...baseDeckData.tactics,
] as CardDefinition[];

const definitionMap = new Map<string, CardDefinition>();
allDefinitions.forEach(d => definitionMap.set(d.definitionId, d));

export function getDefinition(definitionId: string): CardDefinition | undefined {
  return definitionMap.get(definitionId);
}

export function getAllDefinitions(): CardDefinition[] {
  return [...allDefinitions];
}

export function getDefinitionsByType(type: string): CardDefinition[] {
  return allDefinitions.filter(d => d.type === type);
}

export function instantiateCard(definition: CardDefinition): Card {
  return { ...definition, id: crypto.randomUUID() };
}

export function createBaseDeck(): Card[] {
  return allDefinitions.map(d => instantiateCard(d));
}
