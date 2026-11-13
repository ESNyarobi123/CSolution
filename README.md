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
| Installations | Admin/Manager: aina za installation na bei zake. Front Office: maombi ya installation na hali yake. Fundi anaona kazi zake |
| Reports | Mauzo, gross profit, net profit, agents, bidhaa, brands, categories, gharama za installation na CSV |
| Settings | Company profile, roles za staff, audit log na PostgreSQL backup kwa msimamizi |

## Aina za installation na bei zake

Nenda **Installations → Types & prices** kuongeza aina za installation zenye bei, mfano `Network installation` kwa TZS 80,000 au `Router configuration` kwa TZS 45,000. Kila aina inaweza kuwa na bei ya agent na gharama ya kazi (`labour cost`) inayotumika kupima faida ya huduma hiyo.

Aina ambayo haijatumika kwenye sale wala job inaweza kufutwa kabisa kupitia menyu ya vitendo (`Delete installation type`). Aina iliyokwisha tumika kwenye sale au job haifutwi, kwa sababu bei yake inahitajika kwenye kumbukumbu; tumia `Archive installation type` kuificha kwenye mauzo mapya bila kuvunja nyaraka za zamani.

Kwenye **New sale**, chagua kifaa, kisha weka tiki kwenye installation na uchague aina moja au zaidi. Kila aina uliyochagua inaingia kwenye cart kama line yenye bei yake, hivyo invoice, receipt na ripoti zinahesabu mapato ya installation sawa na bidhaa. Ukiiondoa kwenye orodha, line hiyo inatolewa kwenye cart. Jina la job linajazwa kutoka aina ulizochagua na unaweza kulibadilisha.

Ombi la installation (Front Office) linatumia orodha hiyo hiyo, na job inahifadhi aina zilizokubaliwa pamoja na bei yake. Ukurasa wa **Installations** kwa Admin/Manager unaonyesha aina na bei tu; kazi yenyewe inafuatiliwa kwenye sale iliyounganishwa, wasifu wa mteja na dashboard.

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

## Roles na ruhusa

Mfumo una role mbili kuu. Admin anasimamia biashara yote; Front Office anahudumia duka. Ruhusa zote zipo kwenye `src/lib/access.ts` na zinatekelezwa **kwenye API**, si kwa kuficha vitufe pekee.

| Uwezo | Admin | Front Office |
| --- | --- | --- |
| Kuona bidhaa, bei ya kuuza na stock | ✅ | ✅ |
| Kuona gharama ya kununua, thamani ya stock na faida | ✅ | ❌ |
| Kuongeza/kuhariri bidhaa, categories na brands | ✅ | ❌ |
| Kupokea stock, suppliers na purchases | ✅ | ❌ |
| Kuuza, kutoa invoice na receipt | ✅ | ✅ (mauzo yake) |
| Quotations | ✅ | ✅ (bila kuhariri au kufuta) |
| Kuongeza wateja na agents | ✅ | ✅ |
| Kurekodi malipo | ✅ | ✅ |
| Kutoa discount au kuuza kwa mkopo | ✅ moja kwa moja | Kwa idhini ya Admin |
| Returns na refunds | ✅ moja kwa moja | Kwa idhini ya Admin |
| Installation requests | ✅ | ✅ |
| Kupanga technician na kusimamia job | ✅ | ❌ |
| Analytics, faida, expenses na reports | ✅ | ❌ |
| Staff, settings, audit log na backup | ✅ | ❌ |

Mchanganyiko kamili unaonekana kwenye **Settings → Staff & roles → Permission matrix**.

### Mfumo wa idhini (approvals)

Front Office hawezi kutoa discount, kuuza kwa mkopo au kufanya return moja kwa moja. Anawasilisha ombi lenye sababu; Admin anaidhinisha au anakataa kwenye **Approvals**. Sale au return haitekelezwi mpaka idhini itolewe, na bei au kiasi kikibadilika ombi la awali linakataliwa.

Kila ombi na uamuzi vinaingia kwenye **Activity log**. Muundo wa ruhusa kwa kila role upo kwenye `access.ts`; mwongozo wa `Front Office` unaonekana kwenye **Settings**.



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

### Akaunti za mwanzo

`migrate` inaunda **Admin** mmoja kutoka `CSOLUTION_ADMIN_EMAIL` na `CSOLUTION_ADMIN_PASSWORD`. Kwa watumiaji wengine wa mwanzo (cashier, storekeeper, technician), weka kwenye `.env`:

```sh
CSOLUTION_TEAM=front@shop.com:Front Office,store@shop.com:Storekeeper
CSOLUTION_TEAM_PASSWORD=<nywila-ndefu>
```

Kisha:

```sh
docker compose --profile tools run --rm migrate node scripts/create-staff.mjs
```

Muundo ni `email:Role[:Jina]`. Jina likikosekana, linatengenezwa kutoka sehemu ya mbele ya email. Role lazima iwe moja ya `Admin`, `Front Office`, `Manager`, `Cashier`, `Storekeeper`, `Technician`. Script ni idempotent: ikiendeshwa tena inabadilisha nywila ya akaunti hizo na kuzifanya active tena.

- Role ya `Front Office` inatumia interface fupi ya duka. Baada ya kubadilisha role ya mtu, akaunti yake inatolewa kwenye sessions zote na lazima aingie tena.

- `migrate` ni one-shot; haiendeshwi na `up`. Endesha tena kila unapoongeza migration mpya kwenye `db/`.
- Database tupu haina data ya demo. `CSOLUTION_DEMO=0` inahakikisha data ya majaribio haipandishwi; `1` inaweka demo mara moja tu kwenye database tupu.
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

Kwa update baadaye, endesha kwenye server:

```sh
cd /opt/csolution && ./scripts/deploy.sh
```

Script hiyo inafanya `git pull`, inajenga images upya, inatumia migrations mpya na kurestart app. Database container haiathiriki.

## Tovuti iliyopandishwa

`https://csolution.yunigo.online` inaendesha kwenye server ya `139.84.245.9` kupitia Caddy. App na database zinaendesha kama containers za Docker zenye `restart: unless-stopped`, na Docker/Caddy zinaanza wenyewe server ikirestart.
