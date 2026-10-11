import { Component, computed, inject, signal } from '@angular/core';
import { LessonService } from './services/lesson.service';
import { FlashCard } from './models/lesson.model';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly lesson = inject(LessonService);
  readonly queue = signal<FlashCard[]>([]);
  readonly currentIndex = signal(0);
  readonly revealedCard = signal<FlashCard | null>(null);
  readonly lastAnswerWasYes = signal<boolean | null>(null);
  readonly error = signal('');

  readonly currentCard = computed(() => this.queue()[this.currentIndex()] ?? null);
  readonly remaining = computed(() => Math.max(0, this.queue().length - this.currentIndex()));

  constructor() {
    this.lesson.loadDefault()
      .then(() => this.selectDeck(0))
      .catch(err => this.error.set(err instanceof Error ? err.message : String(err)));
  }

  selectDeck(index: number): void {
    this.lesson.selectedDeckIndex.set(index);
    this.queue.set(this.lesson.dueCards(index));
    this.currentIndex.set(0);
    this.revealedCard.set(null);
    this.lastAnswerWasYes.set(null);
  }

  answer(remembered: boolean): void {
    const card = this.currentCard();
    if (!card || this.revealedCard()) return;
    const answered = this.lesson.answer(card.id, remembered);
    if (!answered) return;
    this.revealedCard.set(answered);
    this.lastAnswerWasYes.set(remembered);
  }

  nextCard(): void {
    this.currentIndex.update(index => index + 1);
    this.revealedCard.set(null);
    this.lastAnswerWasYes.set(null);
  }

  async importXml(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.error.set('');
      this.lesson.clearSavedState();
      await this.lesson.loadFile(file);
      this.selectDeck(0);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      input.value = '';
    }
  }

  exportXml(): void {
    try {
      const xml = this.lesson.exportXml();
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'lesson-updated.xml';
      a.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
