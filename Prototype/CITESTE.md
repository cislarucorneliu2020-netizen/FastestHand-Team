# Fastest Hand — HTML

## Test imediat, fără instalări

Deschide `index.html` cu dublu clic în Chrome sau Edge. Tot jocul demo, inclusiv
CSS, JavaScript, personaje, reguli și controller, este în acest singur HTML.

În VS Code: File → Open File → index.html. Modifică, salvează cu Ctrl+S și
reîncarcă browserul pentru a vedea schimbarea. Poți folosi și Live Server pentru
demo, dar Live Server nu oferă sincronizarea telefoanelor.

1. PLAY → apare lobby-ul cu codul de șase cifre.
2. Apasă **Intră cu codul**. În controllerul afișat, introdu codul și numele.
3. Adaugă încă un jucător cu **Adaugă jucător** (sunt necesari 2–4).
4. START GAME → masa cu personaje și controllerul jucătorului activ; pistolul nu mai apare pe telefon.
5. Din lista **Jucătorul afișat**, poți vedea controllerul fiecărui participant.
   Numai participantul activ poate acționa.
6. Pe telefon apare cartonașul deasupra roții. Încarcă gloanțele și apasă GATA.
7. Alege TRAGE sau SKIP. Dacă tragi, selectează adversarul și confirmă.

Acesta este un joc demo complet cu rezultate aleatorii, nu o înregistrare.
În acest mod toți jucătorii și controllerele sunt simulate pe același PC;
nu există sincronizare între dispozitive sau file independente.

## Telefoane reale, pe aceeași rețea Wi-Fi

Pachetul opțional adaugă `server.js`, `rules.js` și `package.json` lângă HTML.
În acest mod, același `index.html` afișează gazda pe PC și controllerul pe telefon.

1. Instalează Node.js LTS (minimum 22): https://nodejs.org/en/download.
2. Deschide folderul `fastest-hand-html` în VS Code.
3. Terminal → New Terminal → `npm start`.
4. Deschide linkul **GAZDĂ** afișat în terminal, pe PC. Apasă PLAY.
5. Pe telefoane, deschide linkul **TELEFON** afișat și introdu codul și numele.
6. Gazda apasă START GAME. Terminalul rămâne deschis.

Nu este necesar `npm install`. Pentru a opri serverul: Ctrl+C în terminal.
Pentru a testa fără telefoane în modul LAN, adaugă doi jucători PC; comenzile
lor vor apărea sub masa de joc.

Pe telefon nu folosi `localhost`. Folosește IP-ul PC-ului afișat în terminal.
Dacă apare numai localhost, găsește IPv4 cu `ipconfig` în Windows și folosește
`http://ADRESA_IPV4:PORT/controller`. Dacă Windows întreabă, permite Node.js
pe rețeaua privată. Codul camerei nu oferă conectare de pe altă rețea / internet.

## Modificări

- `index.html`: tot aspectul, meniurile, personaje și controllerul.
- În HTML, secțiunea **REGULILE JOCULUI** este motorul demo local.
- `rules.js`: motorul autoritar pentru telefoane reale, în modul LAN.
- Dacă schimbi regulile, actualizează și motorul din HTML, și `rules.js` pentru
  ca cele două moduri să rămână consistente.
- După modificări HTML, reîncarcă browserul. În modul LAN, după modificări
  de server / reguli, repornește `npm start` și folosește noul link GAZDĂ.
- Personajele sunt forme Canvas generate din cod. Poți înlocui desenarea
  cu propriile imagini sau sprite-uri.

Versiunea HTML poate fi folosită pentru stabilirea gameplay-ului și designului.
Pentru Unity va fi necesară adaptarea logicii în C# și a interfeței în Unity.
