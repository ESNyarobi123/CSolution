# CSolution Shop Management

Mfumo wa duka moja la Connect Solutions kwa vifaa vya networking na huduma za installation. Dashboard inaonyesha mauzo, gross profit, thamani ya stock, ankara zenye salio na installation zinazoendelea. UI inatumia logo uliyoleta na palette yake ya navy, blue, cyan, teal na green. Bei ni TZS na tarehe za ripoti zinatumia saa za Dar es Salaam.

## Fungua demo

Inahitaji Node.js 22 au zaidi, npm na PostgreSQL 16. Script ya demo inatumia PostgreSQL ya kwenye kompyuta hii kupitia socket ya `/tmp`.

```sh
npm ci
npm run db:local
npm run dev
```

Fungua [CSolution](http://127.0.0.1:3085) na chagua **Open demo workspace**. Data ya majaribio inahifadhiwa kwenye database ya `csolution_shop`. Script inaweka nywila ya msimamizi inayozalishwa kwa nasibu kwenye `.env` ya ndani.

Kwa database tupu, nakili `.env.example` kwenda `.env` kwenye mazingira mapya, weka `DATABASE_URL` na taarifa za msimamizi, kisha endesha `npm run db:setup`. Weka `CSOLUTION_DEMO=0` kwa data ya duka. `npm run build` na `npm start` zinaendesha build ya production kwenye loopback.

## Moduli

| Moduli | Kazi |
| --- | --- |
| Overview | Mauzo na faida kwa kipindi, ankara zenye salio, stock inayohitaji kuongezwa na installation zinazoendelea |
| Catalog | Categories, brands, bidhaa, huduma, SKU, kipimo, picha kwa upload au URL, bei ya agent na muda wa warranty |
| Inventory | Kusajili bidhaa iliyopo dukani, kupokea stock kutoka kwa suppliers, stock adjustments, historia ya stock, serial zilizorekodiwa na warranty za mauzo |
| Sales & POS | Catalog yenye search na filters za category/brand, cart yenye stock na jumla, mauzo ya kifaa pekee, kifaa na waya, au kifaa na installation. Malipo kamili, partial payment, mkopo na returns |
| Customers & agents | Wasifu, bei ya agent, salio, historia ya manunuzi na installation |
| Documents | Quotations, invoices na receipts zenye logo. Pakua PDF, chapisha au geuza quotation kuwa sale |
| Installations | Job inayounganishwa na sale au job ya kujitegemea, fundi, eneo, hali ya kazi, vifaa na gharama |
| Reports | Mauzo, gross profit, net profit, agents, bidhaa, brands, categories, gharama za installation na CSV |
| Settings | Company profile, roles za staff, audit log na PostgreSQL backup kwa msimamizi |

## Kusajili bidhaa iliyopo dukani

Tumia **Products → Register existing stock** (au **Inventory → Register existing stock**) kwa bidhaa ambazo tayari zipo dukani. Fomu inakusanya picha, SKU, category, brand, kipimo (`pcs`, `m`, `box`), idadi uliyohesabu, gharama ya kununua na bei ya kuuza.

Wakati wa kuandika, fomu inaonyesha **thamani ya stock** (`idadi × gharama`) na **faida au hasara kwa kila unit** (`bei − gharama`) kabla ya kuhifadhi. Usajili huunda stock movement ya `Opening stock`, hivyo historia ya stock inaanza kwa usahihi.

Ukifungua jina la bidhaa, unaona stock iliyobaki, bei na gharama kwa unit, thamani ya stock, pamoja na units zilizouzwa, mauzo halisi na faida/hasara ya kipindi kilichochaguliwa.

## Vitendo vya msimamizi

Admin anaweza kuongeza, kuhariri na kufuta rekodi kupitia kitufe cha **Create** juu ya ukurasa na menu ya **⋯** kwenye kila mstari. Kila kufuta kuna hatua ya kuthibitisha na kinaandikwa kwenye **Activity log**.

Sheria za ulinzi wa historia:

- Bidhaa yenye stock haiwezi kufutwa; bidhaa yenye mauzo inawekwa kwenye **archive** badala ya kufutwa.
- Installation yenye sale au kazi iliyokamilika haifutwi.
- Quotation iliyokwisha kuwa sale haifutwi.
- Staff anaweza kuzimwa na kuwashwa tena; mtu hawezi kujizima mwenyewe.
- Rekodi zinazoshirikiwa na mauzo au stock zinapewa ujumbe unaoeleza hatua sahihi badala ya kosa la kiufundi.

## Muundo wa project

- `src/app` ina Next.js App Router na API. `src/components` ina dashboard, fomu na nyaraka.
- `db` ina PostgreSQL migrations na data ya demo. `src/lib` ina ruhusa, queries, validation na transactions.
- Mauzo huhifadhi bei na gharama za bidhaa kwa wakati wa checkout. Manunuzi husasisha weighted-average cost ya stock. Mauzo, malipo ya kwanza na stock hutunzwa ndani ya transaction moja.
- Job inaonyesha vifaa vya sale iliyounganishwa. Vifaa vya ziada vina stock movement yao. Operating expenses na installation expenses zinaingia kwenye ripoti kwa njia tofauti.
- SKU tofauti zinaweza kuundwa kwa kila toleo la bidhaa. Serial huandikwa wakati wa kuuza kifaa au kukitumia kama material ya ziada. Picha za upload zinahifadhiwa kwenye PostgreSQL, pamoja na rekodi zinazozitumia.

Ankara na receipts ni nyaraka za ndani za duka. Mfumo hauna TRA/EFD integration wala payment gateway.

## Deployment kwa Docker

Project ina `Dockerfile` yenye hatua nne (`deps`, `builder`, `migrate`, `runner`) na `docker-compose.yml` yenye `app` + `db` (PostgreSQL 16). App inajenga kwa `output: "standalone"` na inasikiliza `3085` ndani ya container; imefungwa kwenye `127.0.0.1` pekee kwa sababu Caddy ndio inashughulikia TLS.

Weka `.env` kwenye server (haipaswi kuwa git):

```sh
POSTGRES_DB=csolution_shop
POSTGRES_USER=csolution
POSTGRES_PASSWORD=<nywila-ndefu>
CSOLUTION_ADMIN_EMAIL=you@example.com
CSOLUTION_ADMIN_PASSWORD=<nywila-ndefu-isiyopungua-12>
CSOLUTION_DEMO=0
APP_PORT=3085
```

Kisha:

```sh
docker compose build
docker compose --profile tools run --rm migrate   # schema + admin account
docker compose up -d app
docker compose ps
docker compose logs -f app
```

- `migrate` ni one-shot; haiendeshwi na `up`. Endesha tena kila unapoongeza migration mpya kwenye `db/`.
- Kuweka data ya demo kwenye database tupu: endesha `migrate` ukiwa na `CSOLUTION_DEMO=1`, kisha rudi kwenye `0` kwa app.
- Backup: `docker compose exec -T db pg_dump -U csolution -d csolution_shop -Fc > csolution.dump`.
- Kuanza upya na duka tupu: `docker compose down -v` kisha `migrate` na `up -d app`.

Caddy block inayotumika kwenye server hii:

```caddyfile
CSolution.yunigo.online {
	encode gzip
	reverse_proxy 127.0.0.1:3085

	header {
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
	}
}
```

Caddy inatoa certificate ya HTTPS kiotomatiki mara DNS inapoelekeza kwenye server.
