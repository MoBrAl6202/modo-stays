/**
 * ============================================================================
 * MODO STAYS — FILE UNICO EMAIL DI CONFERMA PRENOTAZIONE
 * ============================================================================
 *
 * Qui puoi modificare liberamente tutti i testi dell'email che riceve l'ospite
 * dopo la prenotazione.
 *
 * COME ATTIVARE L'INVIO REALE DELLE EMAIL SU CLOUDFLARE (GRATIS):
 * 1. Crea un account gratuito su https://resend.com (3.000 email/mese gratis).
 * 2. Copia la tua API Key (inizia con "re_...").
 * 3. Su Cloudflare Pages -> Settings -> Variables and Secrets aggiungi:
 *      RESEND_API_KEY = re_...
 *      EMAIL_FROM     = Modo Stays <onboarding@resend.dev>   (per i test)
 *                       oppure <prenotazioni@tuodominio.com> (con dominio tuo)
 *      HOST_NOTIFICATION_EMAIL = tua@email.com (opzionale, per ricevere copia)
 * ============================================================================
 */

import type { BookingRecord, Suite, SuiteLocation } from './types.ts';

export const IMPOSTAZIONI_EMAIL = {
  oggetto: 'Conferma prenotazione Modo Stays — {suiteName} ({bookingId})',
  titoloBenvenuto: 'La tua prenotazione è confermata.',
  messaggioApertura:
    'Grazie per aver scelto Modo Stays. Abbiamo riservato l’appartamento per le date indicate qui sotto e aggiornato automaticamente i nostri calendari.',
  istruzioniCheckIn:
    'Check-in dalle 15:00 · Check-out entro le 11:00. Riceverai le indicazioni dettagliate e i codici di accesso 48 ore prima del tuo arrivo.',
  notaPagamentoProva:
    'Prenotazione registrata in modalità prova (nessun addebito reale effettuato su carta).',
  emailContatto: 'ospitalita@modostays.com',
  /**
   * Scrivi qui la tua email personale se vuoi ricevere un avviso per ogni nuova
   * prenotazione (in alternativa puoi impostare HOST_NOTIFICATION_EMAIL su Cloudflare).
   */
  emailNotificaHost: '',
  firma: 'Il team Modo Stays',
  visionFooter:
    'Thoughtfully designed apartments. Prime locations. Effortless experiences.',
};

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formattaDataItaliana(iso: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  const mesi = [
    'gennaio',
    'febbraio',
    'marzo',
    'aprile',
    'maggio',
    'giugno',
    'luglio',
    'agosto',
    'settembre',
    'ottobre',
    'novembre',
    'dicembre',
  ];
  return `${d} ${mesi[(m - 1) % 12]} ${y}`;
}

function calcolaNotti(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

export interface GeneratedEmail {
  subject: string;
  html: string;
  text: string;
}

export function generaEmailConferma(params: {
  booking: BookingRecord;
  suite: Suite;
  location?: SuiteLocation;
}): GeneratedEmail {
  const { booking, suite, location } = params;
  const nights = calcolaNotti(booking.checkIn, booking.checkOut);
  const addressText = location
    ? `${location.address}, ${location.postalCity} (${location.city})`
    : suite.name;

  const isSandbox = Boolean(booking.stripeSessionId?.startsWith('cs_sandbox_'));
  const paymentLabel =
    booking.paymentStatus === 'paid'
      ? isSandbox
        ? 'Confermata (Modalità Prova / Sandbox)'
        : 'Pagata con Stripe'
      : 'In attesa di pagamento';

  const subject = IMPOSTAZIONI_EMAIL.oggetto
    .replace('{suiteName}', suite.name)
    .replace('{bookingId}', booking.id);

  const checkInFmt = formattaDataItaliana(booking.checkIn);
  const checkOutFmt = formattaDataItaliana(booking.checkOut);

  const html = `<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1C1A17;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FAF9F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E6E2DA;">
          <tr>
            <td style="padding:28px 32px;border-bottom:1px solid #E6E2DA;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:#1C1A17;">
                Modo Stays
              </div>
              <div style="font-size:12px;color:#666158;margin-top:4px;">
                Conferma Prenotazione · Rif. ${escapeHtml(booking.id)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;color:#1C1A17;">
                Ciao ${escapeHtml(booking.guestName)}, ${escapeHtml(IMPOSTAZIONI_EMAIL.titoloBenvenuto.toLowerCase())}
              </h1>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.65;color:#4B4740;">
                ${escapeHtml(IMPOSTAZIONI_EMAIL.messaggioApertura)}
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F3F1EC;border:1px solid #E6E2DA;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#666158;">
                      Riepilogo Soggiorno
                    </div>
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1C1A17;margin-top:4px;">
                      ${escapeHtml(suite.name)}
                    </div>
                    <div style="font-size:13px;color:#4B4740;margin-top:4px;">
                      ${escapeHtml(addressText)}
                    </div>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;border-top:1px solid #DFDAD0;padding-top:12px;font-size:13px;">
                      <tr>
                        <td style="padding:5px 0;color:#666158;">Check-in</td>
                        <td align="right" style="padding:5px 0;font-weight:600;color:#1C1A17;">${escapeHtml(checkInFmt)}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#666158;">Check-out</td>
                        <td align="right" style="padding:5px 0;font-weight:600;color:#1C1A17;">${escapeHtml(checkOutFmt)}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#666158;">Durata & Ospiti</td>
                        <td align="right" style="padding:5px 0;color:#1C1A17;">${nights} ${nights === 1 ? 'notte' : 'notti'} · ${booking.guestsCount} ${booking.guestsCount === 1 ? 'ospite' : 'ospiti'}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#666158;">Stato</td>
                        <td align="right" style="padding:5px 0;color:#2C3E35;font-weight:600;">${escapeHtml(paymentLabel)}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 0 0;border-top:1px solid #DFDAD0;font-weight:600;color:#1C1A17;">Totale</td>
                        <td align="right" style="padding:10px 0 0 0;border-top:1px solid #DFDAD0;font-size:16px;font-weight:700;color:#2C3E35;">€${booking.totalAmountEur}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="padding:16px;border-left:3px solid #2C3E35;background-color:#FAF9F6;font-size:13px;line-height:1.6;color:#3D3A34;margin-bottom:20px;">
                <strong style="color:#1C1A17;">Informazioni per l’arrivo:</strong><br/>
                ${escapeHtml(IMPOSTAZIONI_EMAIL.istruzioniCheckIn)}
              </div>

              ${
                isSandbox
                  ? `<p style="font-size:12px;color:#9A7B4F;margin:0 0 16px 0;">${escapeHtml(
                      IMPOSTAZIONI_EMAIL.notaPagamentoProva
                    )}</p>`
                  : ''
              }

              <p style="margin:0;font-size:13px;line-height:1.6;color:#4B4740;">
                Per qualsiasi richiesta puoi rispondere a questa email o scriverci a
                <a href="mailto:${escapeHtml(IMPOSTAZIONI_EMAIL.emailContatto)}" style="color:#2C3E35;font-weight:600;">${escapeHtml(
                  IMPOSTAZIONI_EMAIL.emailContatto
                )}</a>.
              </p>
              <p style="margin:18px 0 0 0;font-size:13px;color:#1C1A17;">
                A presto,<br/>
                <strong>${escapeHtml(IMPOSTAZIONI_EMAIL.firma)}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background-color:#F3F1EC;border-top:1px solid #E6E2DA;font-size:11px;color:#666158;text-align:center;">
              ${escapeHtml(IMPOSTAZIONI_EMAIL.visionFooter)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Modo Stays — Conferma Prenotazione (${booking.id})`,
    '',
    `Ciao ${booking.guestName},`,
    IMPOSTAZIONI_EMAIL.messaggioApertura,
    '',
    `Suite: ${suite.name}`,
    `Indirizzo: ${addressText}`,
    `Check-in: ${checkInFmt}`,
    `Check-out: ${checkOutFmt}`,
    `Ospiti: ${booking.guestsCount} · Notti: ${nights}`,
    `Totale: €${booking.totalAmountEur} (${paymentLabel})`,
    '',
    IMPOSTAZIONI_EMAIL.istruzioniCheckIn,
    '',
    `Contatti: ${IMPOSTAZIONI_EMAIL.emailContatto}`,
    IMPOSTAZIONI_EMAIL.firma,
  ].join('\n');

  return { subject, html, text };
}

export interface SendConfirmationEmailResult {
  sent: boolean;
  hostNotified?: boolean;
  reason?: string;
  providerId?: string;
  recipient?: string;
  subject: string;
}

export async function inviaEmailConfermaResend(params: {
  resendApiKey?: string;
  fromEmail?: string;
  hostNotificationEmail?: string;
  booking: BookingRecord;
  suite: Suite;
  location?: SuiteLocation;
}): Promise<SendConfirmationEmailResult> {
  const { booking, suite, location } = params;
  const generated = generaEmailConferma({ booking, suite, location });
  const recipient = booking.guestEmail?.trim();

  if (!recipient) {
    return {
      sent: false,
      reason: 'missing_guest_email',
      subject: generated.subject,
    };
  }

  if (!params.resendApiKey) {
    return {
      sent: false,
      reason: 'missing_api_key',
      recipient,
      subject: generated.subject,
    };
  }

  const from =
    (params.fromEmail || '').trim() || 'Modo Stays <onboarding@resend.dev>';
  const apiKey = params.resendApiKey.trim();
  const hostEmail = (
    params.hostNotificationEmail ||
    IMPOSTAZIONI_EMAIL.emailNotificaHost ||
    ''
  ).trim();

  let guestSent = false;
  let guestReason: string | undefined;
  let providerId: string | undefined;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        reply_to: IMPOSTAZIONI_EMAIL.emailContatto,
        subject: generated.subject,
        html: generated.html,
        text: generated.text,
      }),
    });

    const data = (await response.json()) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (response.ok) {
      guestSent = true;
      providerId = data.id;
    } else {
      guestReason = data.message || data.name || `HTTP ${response.status}`;
    }
  } catch (err) {
    guestReason = err instanceof Error ? err.message : 'Errore rete email';
  }

  let hostNotified = false;
  if (hostEmail && hostEmail.includes('@')) {
    const hostSubject = `[Modo Stays] Nuova prenotazione — ${suite.name} (${booking.checkIn} / ${booking.checkOut})`;
    const hostText = [
      `Nuova prenotazione ricevuta sul sito Modo Stays!`,
      '',
      `Codice: ${booking.id}`,
      `Suite: ${suite.name}`,
      `Check-in: ${formattaDataItaliana(booking.checkIn)}`,
      `Check-out: ${formattaDataItaliana(booking.checkOut)}`,
      `Ospiti: ${booking.guestsCount}`,
      `Totale: €${booking.totalAmountEur}`,
      '',
      `Ospite: ${booking.guestName}`,
      `Email ospite: ${recipient}`,
      `Telefono: ${booking.guestPhone || 'Non indicato'}`,
      `Note: ${booking.notes || 'Nessuna'}`,
    ].join('\n');

    try {
      const hostRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [hostEmail],
          reply_to: recipient,
          subject: hostSubject,
          text: hostText,
        }),
      });
      hostNotified = hostRes.ok;
    } catch {
      hostNotified = false;
    }
  }

  return {
    sent: guestSent,
    hostNotified,
    reason: guestReason,
    providerId,
    recipient,
    subject: generated.subject,
  };
}
