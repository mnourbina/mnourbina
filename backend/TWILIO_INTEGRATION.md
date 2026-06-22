# Twilio WhatsApp Integration — TODO

> **Status**: MOCKED (logs only) — to be wired when credentials are available.

## Where the mock lives

`/app/backend/server.py` → function `_notify_asc(asc, patient, next_cpn, days_late)`.

Currently it only emits a log line:
```
LTFU notify (mock SMS) → +235... : [KHALABA] Recherche perdue de vue...
```

## How to wire Twilio WhatsApp (when credentials become available)

### 1. Get Twilio sandbox credentials (free)
1. Create account at https://www.twilio.com/try-twilio
2. Activate WhatsApp Sandbox: Console → Messaging → Try it out → Send a WhatsApp message
3. Copy:
   - `ACCOUNT_SID`
   - `AUTH_TOKEN`
   - WhatsApp From number (sandbox uses `whatsapp:+14155238886`)

### 2. Add to `/app/backend/.env`
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### 3. Install Twilio SDK
```bash
pip install twilio
pip freeze > /app/backend/requirements.txt
```

### 4. Replace `_notify_asc` in `server.py` with:

```python
import os
from twilio.rest import Client

_twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
_twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
_twilio_from = os.environ.get("TWILIO_WHATSAPP_FROM")
_twilio_client = Client(_twilio_sid, _twilio_token) if _twilio_sid and _twilio_token else None


async def _notify_asc(asc: dict, patient: dict, next_cpn: dict, days_late: int) -> None:
    if not asc or not asc.get("phone"):
        return
    weeks_late = days_late // 7
    body = (
        f"[KHALABA] Recherche perdue de vue\n"
        f"Patiente: {patient.get('full_name', 'N/A')}\n"
        f"Tél: {patient.get('phone') or 'Non renseigné'}\n"
        f"Adresse: {patient.get('address') or 'Non renseignée'}\n"
        f"{next_cpn['label']} en retard de {weeks_late} semaine(s).\n"
        f"Action: visite à domicile et ramener au CSC."
    )
    if not _twilio_client or not _twilio_from:
        logger.info("LTFU notify (no twilio) → %s : %s", asc["phone"], body.replace("\n", " | "))
        return
    try:
        # Strip leading '+' if needed; Twilio expects E.164
        to_number = asc["phone"].strip()
        if not to_number.startswith("+"):
            to_number = "+" + to_number.lstrip("0")
        _twilio_client.messages.create(
            from_=_twilio_from,
            to=f"whatsapp:{to_number}",
            body=body,
        )
        await audit(None, "WHATSAPP_SENT", "Pregnancy", new_data={"to": to_number, "asc_id": asc.get("id")})
    except Exception as e:
        logger.exception("Twilio WhatsApp send failed: %s", e)
```

### 5. Test
- Manually trigger `POST /api/admin/check-ltfu`
- Verify the message is received on the ASC's phone (must have joined sandbox)

## Production move
- Move from sandbox to a **WhatsApp Business API** approved number (requires Meta Business Verification)
- Add per-recipient opt-in tracking (Tchadian regulation + WhatsApp ToS)
- Rate-limiting: max 1 LTFU SMS per patient per 7 days (avoid spam)
