# Julia mit Grafikkarte beschleunigen (statt „WebGPU“)

Kurz: **WebGPU hilft Julia nicht. Eine Grafikkarte hilft sehr, und zwar über Ollama.**

## Warum nicht WebGPU?
- WebGPU ist eine Schnittstelle **für Browser**. Damit kann eine Webseite die Grafikkarte des Besuchers nutzen, z. B. für KI direkt im Browser.
- Julia antwortet aber **im Discord-Bot auf dem Server**, rund um die Uhr, auch wenn niemand das Dashboard offen hat. Kein Browser-Tab, also kein WebGPU.
- Der Bot-Container (Proxmox-LXC/Docker) hat außerdem meist gar keine Grafikkarte.

## Was wirklich schneller macht: Ollama auf einem Rechner mit Grafikkarte
Ollama nutzt NVIDIA (CUDA), AMD (ROCm) und viele weitere Karten (Vulkan) automatisch. Julia fragt es über das Netzwerk.

1. **Auf dem Rechner mit Grafikkarte** Ollama installieren:
   - Windows/macOS: Installer von ollama.com.
   - Linux: `curl -fsSL https://ollama.com/install.sh | sh`.
2. **Modell laden:** `ollama pull llama3.2` (klein, ca. 2 GB) oder `ollama pull qwen3:8b` (besser, ca. 5 GB).
3. **Prüfen, ob die Grafikkarte genutzt wird:** `ollama ps`. Die Spalte „PROCESSOR“ sollte „100% GPU“ zeigen.
4. **Im Netzwerk erreichbar machen:** Ollama mit `OLLAMA_HOST=0.0.0.0` starten. Nur im eigenen Heimnetz bzw. über VPN wie NetBird, **nie offen ins Internet**.
5. **Im Dashboard eintragen:** Julia → Verbindung → Ollama → Adresse wie `http://192.168.1.50:11434`. Mehrere Ollama-Server gehen auch. Fällt einer aus, weicht Julia auf den nächsten aus (Selbstheilung, 0.38.0).

### Fortgeschritten: Grafikkarte direkt im Proxmox-Container
Die Grafikkarte lässt sich auch an einen eigenen Ollama-LXC durchreichen (GPU-Passthrough). Das ist je nach Karte unterschiedlich: Für NVIDIA braucht man den Treiber auf dem Host und die Geräte-Freigabe im Container, für Intel/AMD reicht oft `/dev/dri`. Die Anleitungen von Proxmox und Ollama zu „GPU passthrough“ beschreiben das genau. Danach weiter ab Schritt 2.

### Ohne eigene Grafikkarte
- **Ollama Cloud** (pro Server mit eigenem Schlüssel, seit 0.39.0) oder
- **Claude, Gemini, OpenAI & Co.** (Julia → Verbindung).

Verfasst mit Claude 🤖
