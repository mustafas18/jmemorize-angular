# jMemorize Angular 22

A small Angular 22 flash-card app based on the supplied jMemorize `lesson.xml`.

## Behavior

- Category tags are ignored.
- Select a deck to study only cards whose `DateExpired` is at or before now.
- Cards in the first deck have no `DateExpired` in the supplied file; they are treated as new/reset cards and therefore due.
- The front side is shown first.
- **Yes** moves the card to the next deck (or keeps it in the final deck).
- **No** moves the card back to the first deck.
- After answering, the backside is revealed and `DateTested` is updated.
- The next `DateExpired` is calculated from the deck intervals inferred from the source XML: 3, 7, 14, 16, 32, 64, 128, 256, 512 days (later decks remain 512 days).
- `TestsTotal` increments on every answer; `TestsHit` increments on **Yes**.
- Changes are saved in `localStorage` and can be written to a downloadable XML using **Export XML**.

## Run

```bash
npm install
npm start
```

Then open the URL printed by Angular CLI (normally `http://localhost:4200`).

The supplied `lesson.xml` is already copied to `public/lesson.xml` and loads automatically. You can also import another compatible XML file from the UI.
