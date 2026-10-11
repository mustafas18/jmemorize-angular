export interface FlashCard {
  id: string;
  frontside: string;
  backside: string;
  deckIndex: number;
  dateCreated?: Date;
  dateModified?: Date;
  dateTested?: Date;
  dateExpired?: Date;
  testsHit: number;
  testsTotal: number;
  sourceAttributes: Record<string, string>;
}

export interface DeckView {
  index: number;
  title: string;
  total: number;
  due: number;
}
