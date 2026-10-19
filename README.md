# jMemorize Angular 22

A small Angular 22 flash-card app based on the supplied jMemorize `lesson.xml`.

## Description 
Our platform is web-based and works on any device with a browser, with nothing to install. By contrast, official jMemorize is built on Java Swing, so it runs on Windows, Linux, and macOS, provided the Java Runtime Environment (JRE) is installed. The official gitub page of JMemorize is https://github.com/riadd/jMemorize 

Switching is simple: export your lesson file (lesson.xml) from jMemorize and import it into our platform. When you finish practicing, you can export your progress and take it with you.

## Run

```bash
npm install
npm start
```

Then open the URL printed by Angular CLI (normally `http://localhost:4200`).

The supplied `lesson.xml` is already copied to `public/lesson.xml` and loads automatically. You can also import another compatible XML file from the UI.

## Demo

https://ielts-free.ir/flashcard/
