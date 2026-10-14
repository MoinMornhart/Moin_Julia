# 80 – „App hinzufügen“ im Discord-Profil

**Wunsch Philip (14.10.2026):** Er will in Discord bei Julia direkt auf „App hinzufügen“ klicken und sie damit auf einen eigenen Server einladen.

## So geht es
- **Beim Start richtet der Bot den Knopf selbst ein.**
  - Er trägt die Server-Installation in die App-Einstellungen ein (`integration_types_config` Typ 0): Bot + Befehle und die üblichen Rechte, also dieselben wie beim Dashboard-Einladungslink und **ohne** Administrator.
  - Danach zeigt Discord im Profil von Julia den Knopf **„App hinzufügen“ → „Zu Server hinzufügen“**.
  - Steht im Developer Portal schon etwas (eigene Einstellung oder eigener Link), ändert der Bot nichts.
  - Eine vorhandene Nutzer-Installation (Typ 1) bleibt erhalten.
- **Discord-Regel:** Ein *privater* Bot darf diesen Knopf nicht haben. Der Bot schreibt dann einen Hinweis ins Log. Philip muss einmal selbst Folgendes tun:
  1. Developer Portal → **Bot → „Public Bot“ an**. Das kann der Bot nicht selbst umstellen.
  2. Bot neu starten.
- **Zusätzlich `/moin einladen`:**
  - Der Bot schickt einen Knopf „➕ Zu einem Server hinzufügen“ mit demselben Link. Die Antwort sieht nur die Person, die den Befehl nutzt.
  - Ist der Bot privat, steht der Hinweis dabei, wie man ihn öffentlich macht.
- **Gemeinsamer Link:** Der Einladungs-Link und die Rechte stehen jetzt an einer Stelle in `@moin/shared` (`bot-invite.ts`). Dashboard und Bot nutzen dieselben Werte.

## Zu beachten
- **„Public Bot“ an** heißt: Jede Person mit dem Link oder dem Knopf kann Julia auf ihren Server holen. Das kostet dann auch KI-Verbrauch. Sperren lässt sich das jederzeit im Developer Portal wieder („Public Bot“ aus).
- **Zum Einladen** braucht man auf dem Ziel-Server das Recht „Server verwalten“.

## Tests
- **Unit:**
  - Link-Aufbau: Bot + Befehle, kein Administrator.
  - Prüfung, ob der Knopf schon eingerichtet ist.
- **Typprüfung:** Bot-Typprüfung grün.
- **Befehls-Katalog:** neu erzeugt.
- **Klick-Test:** 265/265.
- **Sweep:** ohne Probleme.
- **Von Philip zu bestätigen:** ob der Knopf nach dem Update im Profil erscheint.
