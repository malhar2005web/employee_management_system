# 📡 Teramind REST Grid APIs & BI Cubes Reference (EMS Integrated Modules)

This document contains the complete specification of all **Teramind Grid Endpoints & GET/POST Counterparts** integrated into the Enterprise EMS application.

---

## 🔑 Authentication & Live Server Credentials

- **Live Instance Base URL**: `https://planexsoftwa.teramind.co`
- **Live Access Token**: `02182bf72232fb8749b499a78140356ddb1d5c4e`
- **Request Headers**:
  - `x-access-token`: `02182bf72232fb8749b499a78140356ddb1d5c4e`
  - `Content-Type`: `application/json`
  - `Accept`: `application/json`

---

## 🎯 Teramind Grid Report REST Endpoints (`/tm-api/report/*/grid`)

Teramind provides dedicated `/grid` endpoints for structured data extraction. These require **`viewMode: 1`** in the POST body payload.

| # | HTTP Method | Endpoint URL | Required Payload | Purpose / Output Data |
|---|---|---|---|---|
| 1 | `POST` | `https://planexsoftwa.teramind.co/tm-api/report/computers/grid` | `{"viewMode": 1}` | Live computer grid rows: online agent names, IP address, OS, last seen Unix timestamp |
| 2 | `POST` | `https://planexsoftwa.teramind.co/tm-api/report/web-pages-applications/grid` | `{"viewMode": 1}` | Web pages & application usage analytics grid |
| 3 | `POST` | `https://planexsoftwa.teramind.co/tm-api/report/sessions/grid` | `{"viewMode": 1}` | Active & historical user session grid |
| 4 | `POST` | `https://planexsoftwa.teramind.co/tm-api/report/net-connections/grid` | `{"viewMode": 1}` | Network connections & IP telemetry grid |

---

## 💻 Working cURL Command Examples

### 1. Computers Grid (`POST /tm-api/report/computers/grid`)
```bash
curl.exe -X POST "https://planexsoftwa.teramind.co/tm-api/report/computers/grid" \
  -H "x-access-token: 02182bf72232fb8749b499a78140356ddb1d5c4e" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"viewMode\": 1}"
```
**Sample Verified Response:**
```json
{
  "rows": [
    {
      "id": 30,
      "computer": { "name": "biswas-pcs", "computer_id": 30 },
      "online_agents": "Salim Biswas",
      "online_agents_count": "1",
      "os": "Microsoft Windows 11 Pro 10.0.26200 64-bit x64-based PC",
      "ip_address": "160.22.131.22",
      "client_version": "26.28.4222",
      "last_seen": 1785309311.663869
    }
  ]
}
```

### 2. Web Pages & Applications Grid (`POST /tm-api/report/web-pages-applications/grid`)
```bash
curl.exe -X POST "https://planexsoftwa.teramind.co/tm-api/report/web-pages-applications/grid" \
  -H "x-access-token: 02182bf72232fb8749b499a78140356ddb1d5c4e" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"viewMode\": 1}"
```

### 3. Sessions Grid (`POST /tm-api/report/sessions/grid`)
```bash
curl.exe -X POST "https://planexsoftwa.teramind.co/tm-api/report/sessions/grid" \
  -H "x-access-token: 02182bf72232fb8749b499a78140356ddb1d5c4e" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"viewMode\": 1}"
```

### 4. Network Connections Grid (`POST /tm-api/report/net-connections/grid`)
```bash
curl.exe -X POST "https://planexsoftwa.teramind.co/tm-api/report/net-connections/grid" \
  -H "x-access-token: 02182bf72232fb8749b499a78140356ddb1d5c4e" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"viewMode\": 1}"
```

---

## 🛠️ Codebase Functions Added (`backend/services/teramind.service.js`)

1. `getComputersGrid(viewMode = 1)`
2. `getWebPagesApplicationsGrid(params)`
3. `getSessionsGrid(params)`
4. `getNetConnectionsGrid(params)`
