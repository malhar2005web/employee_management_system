# 📱 WABA (WhatsApp Business API) Complete Master Integration & Context Guide

> **Project / Company:** Planex Software / Pentasoft Consultancy  
> **Platform Provider:** messaging.digital (Chartered Information Systems Pvt. Ltd.)  
> **Conversation ID Reference:** `190b10a3-d9f9-482c-be7c-9fd913ce6869`  
> **Status:** 100% Tested & Verified in Postman & Live WhatsApp Delivery

---

## 🔑 1. Account Credentials & System IDs

* **Portal URL:** [https://waba.planexsoftware.in](https://waba.planexsoftware.in) / [https://messaging.digital](https://messaging.digital)
* **API Base URL:** `https://messagingapi.charteredinfo.com`
* **Account Login Email:** `joshi@pentasoftconsultancy.com` / `joshi1@pentasoftconsultancy.com`
* **Registered WhatsApp Business Number:** `+91 90822 70423`
* **Phone Number ID (`{{Phone-Number-ID}}`):** `1272160742648640` *(Used in Send Message & Media APIs)*
* **WhatsApp Account ID / WABA ID (`{{WABAId}}`):** `1799229541523265` *(Used in Billing & Balance APIs)*
* **Business Portfolio ID:** `2547029842389206`

---

## 🚀 2. Complete Tested & Verified APIs Suite

---

### 1️⃣ Auth Token API (JWT Token Generation)
* **HTTP Method:** `POST`
* **Endpoint URL:** `https://messagingapi.charteredinfo.com/AuthTokenV1/AuthToken`
* **Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "userId": "joshi1@pentasoftconsultancy.com",
  "password": "MALHAR@2005k",
  "authTokenValidityMins": "99999999"
}
```
* **Response:**
```json
{
  "isSuccess": true,
  "txnOutcome": "<JWT_BEARER_TOKEN>"
}
```
> **Usage:** Copy the `txnOutcome` value and use in all subsequent APIs as Header: `Authorization: Bearer <txnOutcome>`

---

### 2️⃣ Check Balance & Billing API
* **HTTP Method:** `GET`
* **Endpoint URL:** `https://messagingapi.charteredinfo.com/BillingV1/1799229541523265/Master`
* **Headers:** `Authorization: Bearer <txnOutcome>`
* **Response Details:**
  * `currentBal`: Available balance in ₹ (Rupees)
  * `utilityMsgRate`: ₹0.16 / conversation
  * `marketingMsgRate`: ₹0.95 / conversation
  * `serviceMsgRate`: ₹0.00 (Free 24hr window)
  * `authMsgRate`: ₹0.16 / conversation

---

### 3️⃣ Upload Media API (Base64 Upload)
* **HTTP Method:** `POST`
* **Endpoint URL:** `https://messagingapi.charteredinfo.com/v19.0/1272160742648640/Media/UploadB64`
* **Headers:**
  * `Authorization: Bearer <txnOutcome>`
  * `Content-Type: application/json`
* **Request Body:**
```json
{
  "fileName": "sample_image.png",
  "mimeType": "image/png",
  "b64OfMedia": "<BASE64_ENCODED_STRING>"
}
```
* **Response:**
```json
{
  "id": "1554699316127023"
}
```
* **File Limits:** Documents (100MB), Images (5MB), Audio (16MB), Video (16MB), Stickers (100KB).

---

### 4️⃣ Send Media Message API (Image with Caption)
* **HTTP Method:** `POST`
* **Endpoint URL:** `https://messagingapi.charteredinfo.com/v19.0/1272160742648640/messages`
* **Headers:** `Authorization: Bearer <txnOutcome>`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "918767137790",
  "type": "image",
  "image": {
    "id": "1554699316127023",
    "caption": "Hello! Testing Image Message from Postman"
  }
}
```

---

### 5️⃣ Send Plain Text Message API (24-Hr Service Window)
* **HTTP Method:** `POST`
* **Endpoint URL:** `https://messagingapi.charteredinfo.com/v19.0/1272160742648640/messages`
* **Headers:** `Authorization: Bearer <txnOutcome>`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "918767137790",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Hello! Testing WhatsApp Business API from Postman."
  }
}
```

---

### 6️⃣ Send Dynamic Approved Template API (`client_call`)
* **Template Status:** `APPROVED` (Category: `Utility`, Language: `en`)
* **Variables Mapping:**
  * `{{1}}`: Customer name
  * `{{2}}`: Location
  * `{{3}}`: Person
  * `{{4}}`: Number
  * `{{5}}`: Details
* **HTTP Method:** `POST`
* **Endpoint URL:** `https://messagingapi.charteredinfo.com/v19.0/1272160742648640/messages`
* **Request Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "918767137790",
  "type": "template",
  "template": {
    "name": "client_call",
    "language": {
      "code": "en"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Malhar Kulkarni" },
          { "type": "text", "text": "Pune" },
          { "type": "text", "text": "Malhar" },
          { "type": "text", "text": "8767137790" },
          { "type": "text", "text": "Issue in EMS Software" }
        ]
      }
    ]
  }
}
```

---

### 7️⃣ Send Interactive List Menu Message API
* **HTTP Method:** `POST`
* **Endpoint URL:** `https://messagingapi.charteredinfo.com/v19.0/1272160742648640/messages`
* **Request Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "918767137790",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "header": { "type": "text", "text": "Planex Software" },
    "body": {
      "text": "Welcome to Planex Software! 🌐\nVisit our website: https://planexsoftware.in/\n\nPlease select a service from our menu below:"
    },
    "footer": { "text": "Pentasoft Consultancy" },
    "action": {
      "button": "View Services",
      "sections": [
        {
          "title": "Software Solutions",
          "rows": [
            { "id": "SRV_WEB", "title": "Web Development", "description": "Explore on planexsoftware.in" },
            { "id": "SRV_APP", "title": "Mobile App Development", "description": "Android & iOS Apps" }
          ]
        },
        {
          "title": "Integration",
          "rows": [
            { "id": "SRV_WABA", "title": "WhatsApp API Solution", "description": "Official WABA Automation" }
          ]
        }
      ]
    }
  }
}
```

---

### 8️⃣ Send Interactive CTA Website Button API
* **HTTP Method:** `POST`
* **Endpoint URL:** `https://messagingapi.charteredinfo.com/v19.0/1272160742648640/messages`
* **Request Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "918767137790",
  "type": "interactive",
  "interactive": {
    "type": "cta_url",
    "header": { "type": "text", "text": "Planex Software" },
    "body": {
      "text": "Explore our enterprise software solutions and services directly on our official website."
    },
    "footer": { "text": "Pentasoft Consultancy" },
    "action": {
      "name": "cta_url",
      "parameters": {
        "display_text": "🌐 Visit Website",
        "url": "https://planexsoftware.in/"
      }
    }
  }
}
```

---

## ⚡ 3. Webhooks & Real-Time Incoming Events

### Portal Configuration:
* **Location:** `waba.planexsoftware.in` ➡️ WABA Actions ➡️ Settings
* **Webhook Url:** Backend API Endpoint (e.g. `https://api.planexsoftware.in/api/whatsapp/webhook`)
* **Webhook Secret:** Optional SHA256 verification string
* **Post Status Notifications:** Checked (for delivery/read receipts)

### Incoming Customer Message Payload (`?notificationtype=inmsg`):
```json
{
  "type": "text",
  "phone_no_id": 1272160742648640,
  "from": "918767137790",
  "wamid": "wamid.HBgMOTE4Nzy3MTM3NzkwFQIAEhgg...",
  "msg_date_time": "2026-09-03T11:50:16+05:30",
  "text": {
    "body": "Hello webhook testing",
    "payload": null
  },
  "media_id": null,
  "media_url": null,
  "media_size": null,
  "reaction_to_wamid": null
}
```

### Incoming Interactive Button/List Reply Payload:
```json
{
  "type": "interactive",
  "phone_no_id": 1272160742648640,
  "from": "918767137790",
  "wamid": "wamid.HBgMOTE4Nzy3MTM3NzkwFQIA...",
  "msg_date_time": "2026-09-02T13:57:00+05:30",
  "text": {
    "body": "{\"type\":\"list_reply\",\"list_reply\":{\"id\":\"SRV_APP\",\"title\":\"Mobile App Development\",\"description\":\"Android & iOS Apps\"}}"
  }
}
```

---

## 🛠️ 4. Ready Backend Controller Code (Node.js & C#)

### Node.js (Express.js)
```javascript
const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/whatsapp/webhook', (req, res) => {
    const { notificationtype } = req.query;
    const payload = req.body;

    if (notificationtype === 'inmsg') {
        const from = payload.from;
        const msgType = payload.type;
        const text = payload.text?.body;
        console.log(`[WhatsApp Inbound] From: ${from} | Type: ${msgType} | Text: ${text}`);

        // Custom Auto-responder / Chatbot Logic here
    } else if (notificationtype === 'status') {
        console.log(`[WhatsApp Status] Message ${payload.wamid} is ${payload.status}`);
    }

    res.status(200).send("OK");
});

app.listen(3000, () => console.log("Webhook Server Live on Port 3000"));
```

### C# (.NET Core Web API)
```csharp
[ApiController]
[Route("api/whatsapp")]
public class WhatsAppWebhookController : ControllerBase
{
    [HttpPost("webhook")]
    public IActionResult ReceiveWebhook([FromQuery] string notificationtype, [FromBody] JsonElement body)
    {
        if (notificationtype == "inmsg")
        {
            string from = body.GetProperty("from").GetString();
            string type = body.GetProperty("type").GetString();
            // Process customer reply
        }
        else if (notificationtype == "status")
        {
            string status = body.GetProperty("status").GetString();
            // Process delivery / read receipt
        }

        return Ok();
    }
}
```
