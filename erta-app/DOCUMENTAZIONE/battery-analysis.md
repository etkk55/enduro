# Analisi consumo batteria ERTA — GPS adattivo

**Versione app**: v1.1.01
**Data**: 2026-04-20
**Scenario di riferimento**: gara enduro FMI, 7h, pause ricarica ogni 2h, temperatura primavera-estiva

---

## 1. Parametri d'ingresso

| Parametro | Valore |
|---|---|
| Durata gara | 7 ore |
| Pause in paddock con ricarica | ogni 2h, durata 15-20 min |
| Temperatura ambiente | primavera-estate (15-30°C) |
| Uso schermo | 7-10 min/h + glance ogni 30 min |
| Luminosità schermo | 100% (uso outdoor sotto il sole) |
| Ambiente | 85% zona montuosa aperta + 15% bosco fitto |
| Flotta dispositivi | iPhone + Android (Android +15% consumo) |
| Bluetooth | sempre attivo |
| Budget consumo tra ricariche | 25-30% |

---

## 2. Drain orario per componente

### Smartphone di riferimento
iPhone 15 (3349 mAh) e Samsung Galaxy S23 (3900 mAh), OS aggiornati.

### Breakdown /h

| Componente | iPhone | Android (+15%) |
|---|---|---|
| Schermo ON 9.5 min/h @ 100% brightness | 4.4 %/h | 5.1 %/h |
| Baseline OS | 0.8 %/h | 0.9 %/h |
| Modem 4G (montana + bosco fitto) | 2.0 %/h | 2.3 %/h |
| Push notifications + polling HTTP app | 1.5 %/h | 1.7 %/h |
| Bluetooth background scanning | 1.0 %/h | 1.2 %/h |
| **Subtotale non-GPS** | **9.7 %/h** | **11.2 %/h** |

Il drain fisso non-GPS è **dominato dallo schermo + modem in zone con segnale debole**.

---

## 3. Impatto frequenza polling GPS

### Drain GPS aggiuntivo in background

| Intervallo GPS | Drain extra | Totale iPhone /h | Totale Android /h | **2h segmento Android** |
|---|---|---|---|---|
| 60 s | 0.5 %/h | ~10.2 | ~11.7 | 23% |
| 30 s (default precedente) | 1.0 %/h | ~10.7 | ~12.3 | 25% |
| **15 s (nuovo consigliato)** | **1.8 %/h** | **~11.5** | **~13.2** | **26%** |
| 10 s | 2.8 %/h | ~12.5 | ~14.4 | 29% |
| 5 s | 4.5 %/h | ~14.2 | ~16.3 | 33% (fuori budget) |
| 1 Hz continuo | 8.0 %/h | ~17.7 | ~20.3 | 41% (fuori budget) |

### Raggio di ricerca SOS per velocità &lt;50 km/h

| Intervallo | Distanza max | +Errore GPS bosco | **Raggio totale** | Tempo ricerca (moto 15 km/h) |
|---|---|---|---|---|
| 60 s | 833 m | +30 m | **863 m** | ~3:30 |
| 30 s | 417 m | +30 m | **447 m** | ~1:45 |
| **15 s** | **208 m** | **+30 m** | **~235 m** | **~1:00** |
| 10 s | 139 m | +30 m | **169 m** | ~0:40 |
| 5 s | 69 m | +30 m | **99 m** | ~0:25 |

Con tracciato GPX noto la ricerca è **1D lineare**, quindi il soccorritore percorre ±235m di traccia → pilota trovato in &lt;2 min.

---

## 4. Soluzione adottata: GPS adattivo

### Logica

```
         [watchPosition continuo — OS gestisce duty cycle]
                             │
                             ▼
               ┌─────────────────────────┐
               │ speed >= 3.6 km/h ?     │
               └────────┬────────────────┘
                        │
          sì ─→ ultimo movimento < 60s ─→ MODALITÀ ATTIVA (invio 10s)
                        │
          no ─→ fermo da 60+ s         ─→ MODALITÀ SOSTA (invio 30s)

Boost SOS: premendo SOS → GPS a 1 Hz per 30s, poi torna adattivo
```

### Perché speed-based e non accelerometro
- `position.coords.speed` è **gratis**: già calcolato dall'OS in `watchPosition`
- Nessun permesso extra (DeviceMotion richiederebbe prompt iOS)
- Zero overhead aggiuntivo: ricavato da dati GPS già acquisiti
- Più affidabile dell'accelerometro (vibrazioni moto falserebbero sempre "movimento")

### Consumo effettivo in scenario misto
Tipica ripartizione gara enduro:
- **60% del tempo in movimento** (segmenti trasferimento + PS) → GPS 10s
- **40% del tempo in sosta** (CO, paddock, assistenza) → GPS 30s

Drain medio pesato:
- iPhone: 0.6×11.5 + 0.4×10.7 = **11.2 %/h**
- Android: 0.6×13.2 + 0.4×12.3 = **12.8 %/h**

**2h segmento Android worst case: ~26%** (entro budget 25-30%).

---

## 5. Bilancio gara 7h

Schema tipico: 2h gara → ricarica 20 min → 2h → ricarica 20 min → 2h → ricarica 20 min → 1h gara

### Ricarica in paddock (20 min, fast charge 20W+)
- iPhone 15: recupera **~40%**
- Samsung S23: recupera **~50%**
- Android mid-range 18W: recupera **~30%**

### Traiettoria batteria Android (worst case)
- Start: 100%
- Dopo 2h gara: 74% (−26%)
- Dopo ricarica 20 min: 100% (teto)
- Dopo altre 2h: 74%
- Dopo ricarica: 100%
- Dopo altre 2h: 74%
- Dopo ricarica: 100%
- Dopo ultima 1h: 87%

**Fine gara con 87% residuo** → margine comodo per viaggio rientro.

### Senza ricarica
- 7h × 12.8 %/h = **89.6%** → batteria al limite, rischio spegnimento.

**Conclusione**: le ricariche in paddock sono fondamentali, ma il GPS adattivo rende la gara sostenibile anche se un pilota salta una ricarica.

---

## 6. Raccomandazioni piloti (sintesi)

### Prima della gara
1. Batteria al 100%, forza-chiudi app pesanti
2. Disattiva Wi-Fi (inutile nel bosco)
3. Low Power Mode OFF durante uso ERTA
4. Porta power-bank 10.000 mAh (peso 180g, 3 ricariche complete)

### Posizione smartphone
5. Tasca petto o bracciale → GPS trova meglio il cielo
6. No custodie metalliche
7. Schermo OFF in marcia, apri ERTA solo ai CO

### In paddock (15-20 min)
8. Attacca subito al caricabatterie
9. Telefono al fresco (non al sole, non sopra la moto calda)
10. Non usarlo mentre carica

### Emergenza
11. SOS con hold 3s → boost GPS automatico
12. Se batteria &lt;20%: Low Power Mode ON, chiudi tutto tranne ERTA

---

## 7. Fattori di variabilità (±20% sul calcolo)

- **Montaggio al manubrio**: schermo spesso acceso → drain ×2 vs tasca
- **App concorrenti aperte** (Strava, Wahoo, Relive): +1-2 %/h ciascuna
- **Temperatura &gt;30°C**: drain +15%, ricarica throttled
- **Rete 4G molto debole**: modem in ricerca segnale → +2-3 %/h
- **Chipset GPS**: iPhone 14+ e flagship Android hanno multi-band L1+L5 → ±20% su errore posizione
- **OS in Low Power / Battery Saver aggressivo**: può castrare polling indipendentemente dai settings app

---

## 8. Possibili evoluzioni future

- **Geofencing paddock**: riconosci quando il pilota entra in area paddock → spegni completamente il GPS
- **Modalità battery saver auto**: se batteria &lt;30% forzare intervallo 60s
- **Offload a wearable**: invio posizione via Apple Watch/Garmin connect (consumo telefono dimezzato)
- **BLE beacon al start/CO**: rileva passaggi senza GPS continuo
- **GPS cold fix window**: spegni radio per 25s, accendi solo per il fix → richiede GNSS chipset che lo supporta (Broadcom BCM4776 ok, altri no)
