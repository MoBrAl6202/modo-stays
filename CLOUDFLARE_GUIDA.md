# Guida Semplice per Mettere Online **Modo Stays** su Cloudflare

Questa guida è pensata per chi parte da zero: nessuna parola complicata, solo i passaggi esatti da seguire in ordine per mettere il sito su **Cloudflare Pages**, caricare le tue foto, modificare i testi e collegare **Airbnb**, **Booking.com** e **Stripe**.

---

## 1. Mappa Facile dei File (Dove Toccare Cosa)

Abbiamo organizzato il progetto con **pochi file dal nome chiaro**, così sai subito dove andare senza perderti:

| Cosa vuoi fare | Dove aprire / quale cartella o file usare |
| :--- | :--- |
| **Cambiare le FOTO delle case** | Cartella **`public/foto-alloggi/`** (contiene 6 file `.jpg` pronti da sostituire con le tue foto reali!) |
| **Cambiare TESTI e DESCRIZIONI** | File **`src/CONTENUTI_ALLOGGI.ts`** (puoi aprirlo con qualsiasi editor di testo o Blocco Note e cambiare titoli, frasi, regole e indirizzi) |
| **Cambiare PREZZI, DATE APERTURA, NOTE** | Direttamente dal sito! Vai in **`Area Host`** (in alto a destra) → codice `2026` → scheda **`Alloggi & Prezzi`** |
| **Collegare Airbnb, Booking e vedere prenotazioni** | Sempre dal sito in **`Area Host`** → schede **`Calendario`** e **`Link .ics & Auto-Sync`** |
| **Database locale sul tuo PC** | File **`data/modo-stays-db.json`** (si crea e si aggiorna da solo quando testi il sito sul computer) |
| **Backend automatico per Cloudflare** | File **`functions/api/[[path]].ts`** (non devi toccarlo: fa funzionare tutto su Cloudflare in automatico) |

---

## 2. Come Caricare le Tue Foto Definitive (Cartella JPEG)

Tutte le immagini del sito si trovano nella cartella:
```text
public/foto-alloggi/
```

Dentro troverai esattamente questi **6 file `.jpg`**:
1. `hero-principale.jpg` → La foto grande nella prima pagina iniziale.
2. `dettaglio-ospitalita.jpg` → La foto editoriale di dettaglio nella prima pagina.
3. `nizza-carlone-1.jpg` → La foto principale di **Suite Carlone Lumière (Nizza)**.
4. `nizza-terrazza-1.jpg` → La foto principale di **Atelier Promenade & Terrazza (Nizza)**.
5. `ibiza-calma-1.jpg` → La foto di anteprima di **Casa Calma (Ibiza — apertura Febbraio 2027)**.
6. `milano-beatrice-1.jpg` → La foto di anteprima di **Residenza Beatrice (Milano — apertura Agosto 2027)**.

**Come sostituirle senza toccare il codice:**
1. Prendi le tue foto definitive in formato **`.jpg`** (o `.jpeg`, poi rinominale `.jpg`).
2. Dai a ogni foto **esattamente lo stesso nome** scritto sopra (es. `nizza-carlone-1.jpg`).
3. Trascinale dentro `public/foto-alloggi/` sostituendo i file segnaposto.
4. *(Facoltativo)* Se vuoi aggiungere altre foto alla galleria di una casa, copiale in `public/foto-alloggi/` (es. `nizza-carlone-2.jpg`) e aggiungi `'/foto-alloggi/nizza-carlone-2.jpg'` dentro **`src/CONTENUTI_ALLOGGI.ts`** nella lista `gallery`.

---

## 3. Come Mettere il Sito Online su Cloudflare (Passo dopo Passo)

### Passo A — Scarica lo ZIP e caricalo su GitHub (Metodo Consigliato, 2 minuti)
1. Qui in AI Studio clicca su **Export / Download ZIP** e decomprimi la cartella sul tuo computer (es. sul Desktop).
2. *(Se vuoi già cambiare le foto prima di andare online, sostituisci i file `.jpg` dentro `public/foto-alloggi/` adesso!)*
3. Crea un account gratuito su **GitHub.com**, clicca **New repository** (chiamalo `modo-stays`) e carica tutta la cartella dentro quel repository (o usa GitHub Desktop).

### Passo B — Crea il Sito su Cloudflare Pages
1. Registrati gratis o accedi su **[dash.cloudflare.com](https://dash.cloudflare.com)**.
2. Nel menu a sinistra clicca su **Workers & Pages** → **Create** → scheda **Pages** → **Connect to Git**.
3. Seleziona il tuo repository **`modo-stays`** e clicca **Begin setup**.
4. Nella schermata di configurazione scrivi esattamente questi due campi:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Clicca **Save and Deploy**. Dopo circa 1 minuto avrai il tuo link online (es. `modo-stays.pages.dev`)!

> **Nota sul "Caricamento Diretto ZIP" senza GitHub:** Cloudflare Pages permette anche l'upload manuale, ma se carichi uno ZIP con il Direct Upload del browser vengono caricati solo i file statici e non le funzioni del calendario (`functions/api/[[path]].ts`). Per far funzionare **calendario, database, Stripe e link .ics**, il collegamento tramite **GitHub → Cloudflare Pages** (o il comando `npx wrangler pages deploy`) è fondamentale ed è gratuito.

---

## 4. Creare il Database Permanente su Cloudflare (`MODO_DB`)

Senza questo passaggio, se Cloudflare riavvia il server, le nuove prenotazioni potrebbero sparire. Con **`MODO_DB`** invece tutto viene salvato per sempre su Cloudflare (gratis fino a migliaia di operazioni al giorno).

1. Nella dashboard di **Cloudflare**, nel menu a sinistra vai su **Storage & Databases** → **KV**.
2. Clicca su **Create** (in alto a destra).
3. Come nome scrivi **`MODO_DB`** e conferma.
4. Torna sul tuo sito: **Workers & Pages** → clicca sul progetto **`modo-stays`**.
5. Vai nella scheda **Settings** → **Bindings** → clicca **Add** → scegli **KV Namespace**.
   - **Variable name**: scrivi esattamente **`MODO_DB`** (tutto maiuscolo)
   - **KV Namespace**: scegli **`MODO_DB`** dal menu a tendina.
6. Clicca **Save**.
7. Vai nella scheda **Deployments** → clicca i tre puntini `...` sull'ultimo deploy → **Retry deployment** (serve solo una volta per attivare il collegamento).

Fatto! Ora prenotazioni, prezzi modificati dal sito, blocchi manuali, lista d'attesa e link `.ics` restano salvati in modo permanente.

---

## 5. Inserire le Chiavi Segrete (Password Host, Stripe, Google Maps)

Sempre dentro **Workers & Pages → `modo-stays` → Settings → Variables and Secrets**, clicca **Add** per aggiungere queste variabili:

| Nome Variabile | Cosa metterci | È obbligatoria? |
| :--- | :--- | :--- |
| **`HOST_ACCESS_CODE`** | La tua password personale per entrare in **Area Host** (es. `MiaPassword2027`). Se non la metti, resta `2026`. | Consigliatissima |
| **`APP_URL`** | L'indirizzo del tuo sito (es. `https://modo-stays.pages.dev` o il tuo dominio). | Consigliata |
| **`STRIPE_SECRET_KEY`** | La chiave segreta `sk_live_...` (o `sk_test_...`) presa dal tuo account **Stripe**. Senza questa, il sito usa la modalità prova (Sandbox). | Solo per pagamenti reali |
| **`STRIPE_WEBHOOK_SECRET`** | La chiave `whsec_...` creata su Stripe per l'URL `https://TUO-SITO/api/webhooks/stripe`. | Solo per pagamenti reali |
| **`VITE_GOOGLE_MAPS_API_KEY`** | La tua chiave Google Maps (necessaria per mostrare la mappa interattiva). *(Ricorda: dopo aver aggiunto una variabile `VITE_...`, fai un **Retry deployment**).* | Per la mappa |

---

## 6. Collegare Airbnb e Booking.com (Con Auto-Sync Intelligente!)

Una volta che il sito è online su Cloudflare:

### Come funziona la sincronizzazione nei 2 sensi
1. Entra nel tuo sito → clicca **Area Host** in alto a destra → inserisci il tuo codice → apri la scheda **`Link .ics & Auto-Sync`**.
2. **Dal tuo sito verso Airbnb e Booking:**
   - Copia il **"Link .ics del tuo sito"** (es. `https://tuosito.pages.dev/api/ical/suite-carlone-lumiere.ics`).
   - Vai su **Airbnb → Annuncio → Prezzi e disponibilità → Sincronizzazione calendario → Importa calendario** e incolla quel link.
   - Vai su **Booking.com Extranet → Tariffe e disponibilità → Sincronizza calendari → Aggiungi connessione calendario** e incolla lo stesso link.
3. **Da Airbnb e Booking verso il tuo sito:**
   - Su Airbnb e Booking clicca **Esporta calendario** e copia i due link `.ics` che ti danno loro.
   - Torna nella tua **Area Host** sul sito, incollali nei rispettivi campi di quella suite e clicca **Salva & Sincronizza ora**.

### Cos'è l'Auto-Sync Intelligente (ogni 15 minuti)
Non devi ricordarti di schiacciare "Sincronizza" ogni giorno! Il sito controlla automaticamente i link `.ics` di Airbnb e Booking **ogni 15 minuti** ogni volta che:
- un cliente apre il calendario di una suite per guardare le date disponibili;
- un cliente clicca "Procedi al pagamento" (controllo di sicurezza prima di pagare con Stripe!);
- tu apri l'**Area Host**.

Se trova una nuova prenotazione arrivata da Airbnb o Booking, la salva subito nel database `MODO_DB`, blocca quelle date sul sito ed evita doppie prenotazioni!
