import { Injectable, computed, signal } from '@angular/core';
import { DeckView, FlashCard } from '../models/lesson.model';

const STORAGE_KEY = 'jmemorize-angular.lesson-state.v1';
const DATE_FORMAT = /^([0-3]\d)-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Inferred from the uploaded jMemorize lesson data. Deck 0 means "new/reset".
const DEFAULT_INTERVAL_DAYS = [0, 3, 7, 14, 16, 32, 64, 128, 256, 512, 512, 512, 512];

interface PersistedCardState {
  id: string;
  deckIndex: number;
  dateTested?: string;
  dateExpired?: string;
  testsHit: number;
  testsTotal: number;
}

@Injectable({ providedIn: 'root' })
export class LessonService {
  readonly cards = signal<FlashCard[]>([]);
  readonly deckCount = signal(0);
  readonly sourceXml = signal('');
  readonly loaded = signal(false);
  readonly selectedDeckIndex = signal(0);

  readonly decks = computed<DeckView[]>(() => {
    const now = new Date();
    const cards = this.cards();
    return Array.from({ length: this.deckCount() }, (_, index) => {
      const deckCards = cards.filter(card => card.deckIndex === index);
      return {
        index,
        title: index === 0 ? 'Deck 1 · New / Reset' : `Deck ${index + 1}`,
        total: deckCards.length,
        due: deckCards.filter(card => this.isDue(card, now)).length
      };
    });
  });

  async loadDefault(): Promise<void> {
    const response = await fetch('lesson.xml');
    if (!response.ok) throw new Error(`Cannot load lesson.xml (${response.status})`);
    await this.loadXml(await response.text());
  }

  async loadFile(file: File): Promise<void> {
    await this.loadXml(await file.text());
  }

  dueCards(deckIndex: number, now = new Date()): FlashCard[] {
    return this.cards()
      .filter(card => card.deckIndex === deckIndex && this.isDue(card, now))
      .sort((a, b) => (a.dateExpired?.getTime() ?? 0) - (b.dateExpired?.getTime() ?? 0));
  }

  answer(cardId: string, remembered: boolean, testedAt = new Date()): FlashCard | undefined {
    let answered: FlashCard | undefined;
    this.cards.update(cards => cards.map(card => {
      if (card.id !== cardId) return card;

      const nextDeck = remembered
        ? Math.min(card.deckIndex + 1, Math.max(0, this.deckCount() - 1))
        : 0;
      const interval = DEFAULT_INTERVAL_DAYS[Math.min(nextDeck, DEFAULT_INTERVAL_DAYS.length - 1)] ?? 512;
      const dateExpired = nextDeck === 0
        ? undefined
        : new Date(testedAt.getTime() + interval * 24 * 60 * 60 * 1000);

      answered = {
        ...card,
        deckIndex: nextDeck,
        dateTested: testedAt,
        dateExpired,
        testsTotal: card.testsTotal + 1,
        testsHit: card.testsHit + (remembered ? 1 : 0)
      };
      return answered;
    }));
    this.persist();
    return answered;
  }

  exportXml(): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(this.sourceXml(), 'application/xml');
    const category = doc.querySelector('Lesson > Category');
    if (!category) throw new Error('No Category element found.');

    const decks = Array.from(category.children).filter(node => node.tagName === 'Deck');
    const byId = new Map(this.cards().map(card => [card.id, card]));
    const sourceCards = Array.from(category.querySelectorAll('Deck > Card'));

    sourceCards.forEach((element, sourceIndex) => {
      const card = byId.get(`card-${sourceIndex}`);
      if (!card) return;
      element.remove();
      this.applyStateToElement(element, card);
      decks[card.deckIndex]?.appendChild(element);
    });

    return new XMLSerializer().serializeToString(doc);
  }

  clearSavedState(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private async loadXml(xml: string): Promise<void> {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) throw new Error(`Invalid XML: ${parserError.textContent ?? 'parse error'}`);

    const category = doc.querySelector('Lesson > Category');
    if (!category) throw new Error('The XML must contain Lesson > Category.');

    // Category tags are deliberately ignored. Only the first Category is used as the deck container.
    const deckElements = Array.from(category.children).filter(node => node.tagName === 'Deck');
    let sourceIndex = 0;
    const parsedCards: FlashCard[] = [];

    deckElements.forEach((deck, deckIndex) => {
      Array.from(deck.children)
        .filter(node => node.tagName === 'Card')
        .forEach(node => {
          const attributes = Object.fromEntries(Array.from(node.attributes).map(attr => [attr.name, attr.value]));
          parsedCards.push({
            id: `card-${sourceIndex++}`,
            frontside: attributes['Frontside'] ?? '',
            backside: attributes['Backside'] ?? '',
            deckIndex,
            dateCreated: this.parseDate(attributes['DateCreated']),
            dateModified: this.parseDate(attributes['DateModified']),
            dateTested: this.parseDate(attributes['DateTested']),
            dateExpired: this.parseDate(attributes['DateExpired']),
            testsHit: Number(attributes['TestsHit'] ?? 0),
            testsTotal: Number(attributes['TestsTotal'] ?? 0),
            sourceAttributes: attributes
          });
        });
    });

    const persisted = this.readPersistedState();
    const persistedById = new Map(persisted.map(state => [state.id, state]));
    const merged = parsedCards.map(card => {
      const state = persistedById.get(card.id);
      if (!state) return card;
      return {
        ...card,
        deckIndex: state.deckIndex,
        dateTested: state.dateTested ? new Date(state.dateTested) : undefined,
        dateExpired: state.dateExpired ? new Date(state.dateExpired) : undefined,
        testsHit: state.testsHit,
        testsTotal: state.testsTotal
      };
    });

    this.sourceXml.set(xml);
    this.deckCount.set(deckElements.length);
    this.cards.set(merged);
    this.selectedDeckIndex.set(0);
    this.loaded.set(true);
  }

  private isDue(card: FlashCard, now: Date): boolean {
    // New/reset cards in Deck 1 have no DateExpired in the source lesson and are considered due.
    return !card.dateExpired || card.dateExpired.getTime() <= now.getTime();
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const match = DATE_FORMAT.exec(value);
    if (!match) return undefined;
    const [, dd, mon, yyyy, hh, mm, ss] = match;
    const month = MONTHS.indexOf(mon);
    if (month < 0) return undefined;
    return new Date(Number(yyyy), month, Number(dd), Number(hh), Number(mm), Number(ss));
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}-${MONTHS[date.getMonth()]}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private persist(): void {
    const state: PersistedCardState[] = this.cards().map(card => ({
      id: card.id,
      deckIndex: card.deckIndex,
      dateTested: card.dateTested?.toISOString(),
      dateExpired: card.dateExpired?.toISOString(),
      testsHit: card.testsHit,
      testsTotal: card.testsTotal
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private readPersistedState(): PersistedCardState[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as PersistedCardState[] : [];
    } catch {
      return [];
    }
  }

  private applyStateToElement(element: Element, card: FlashCard): void {
    element.setAttribute('DateTested', card.dateTested ? this.formatDate(card.dateTested) : '');
    if (card.dateExpired) element.setAttribute('DateExpired', this.formatDate(card.dateExpired));
    else element.removeAttribute('DateExpired');
    element.setAttribute('TestsHit', String(card.testsHit));
    element.setAttribute('TestsTotal', String(card.testsTotal));
  }
}
