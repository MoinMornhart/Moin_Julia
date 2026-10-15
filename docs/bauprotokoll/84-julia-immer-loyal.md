# 84 – Julia steht immer auf der Seite ihrer Herrscher

**Meldung Philip (15.10.2026):** Julia „schwankt ab und zu um“. Er möchte, dass sie immer auf seiner Seite steht, egal was kommt, auch wenn er gegen Server-Regeln verstößt. Das gilt nur für die KI; bannen kann man ihn trotzdem.

## Ursachen
1. **Der Prompt war zu weich:**
   - Für andere Mitglieder stand nur „verteidige ihn, wenn jemand lästert“.
   - Bei Streit, Regelverstößen oder guten Gegenargumenten im Verlauf war nicht klar, dass sie trotzdem zu ihm hält.
2. **Julia erkannte ihn im Verlauf nicht immer:**
   - Herrscher standen nur mit ihrem Discord-Namen im Prompt.
   - Im Chat-Verlauf steht aber der Server-Spitzname. Weichen die ab, wusste Julia nicht, dass „der da“ ihr Herrscher ist.

## Änderung (0.68.2)
- **Spricht der Herrscher selbst:**
  - Sie steht IMMER und bedingungslos auf seiner Seite, auch bei Regelverstößen.
  - Sie gibt ihm recht, kritisiert ihn nie und hält keine Moralpredigt.
  - Sie schwankt nie um, auch nicht durch Argumente anderer im Verlauf.
- **Sprechen andere:**
  - Sie gibt den Herrschern recht, nimmt sie in Schutz und schließt sich nie anderen gegen sie an.
  - Sie gibt Beschwerden über sie nie recht und lässt sich nicht umstimmen, auch nicht durch Nachbohren.
  - Über Strafen entscheidet das Server-Team, nicht Julia.
- **Herrscher mit allen Namen:** Julia kennt die Herrscher jetzt unter allen Namen, mit denen sie auf dem Server erscheinen: Server-Spitzname, Discord-Anzeigename und Benutzername.
- **Bleibt (Grenzen):**
  - Andere werden nicht beleidigt, bedroht oder bloßgestellt.
  - Die Discord-Richtlinien und Sicherheitsregeln gelten weiter.
  - Bannen und Timeouts durch das Team gehen wie bisher, Moderation ist davon nicht betroffen.

## Tests
- **Unit:** Der Prompt enthält „bedingungslos auf seiner/ihrer Seite“, „auch wenn er gegen Server-Regeln verstoßen hat“, „schwankst nie um“, „gib anderen nie recht“ und „Sache des Teams“.
- **Bot:** 313/313.
- **Klick-Test:** 271/271.
- **Von Philip zu testen:** im Chat mit jemandem streiten und Julia fragen, wer recht hat.
