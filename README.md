# HFJ Ballard direct digital bookstore

For hosting options and current costs, see `HOSTING.md`. The store and library colors now match your supplied charcoal-and-gold stylesheet.

Plain HTML/CSS/JavaScript pages with Netlify server functions, Stripe Checkout, Supabase purchase records/private files, email-code access, and an automatically updated Google Sheet. Keep the code in GitHub; host the store on Netlify connected to that repository.

**This is source code requiring configuration, not an already-running shop.** Accounts, secrets, real prices and paid files are not included. Sample prices and formats are illustrative and disabled. Review descriptions, pricing, actual formats, and distribution rights before enabling any product.

## Copy into your existing repository

Copy `store.html`, `distribution.html`, `assets/`, `server/`, `netlify/`, `database/`, `tests/`, `package.json`, `package-lock.json` if supplied, `netlify.toml`, and the entries from `.gitignore`. Keep your existing `index.html`, `style.css`, images and other pages. If your repository already has package/Netlify configuration files, merge them rather than replacing them.

Add these links to the home-page navigation:

```html
<li><a href="store.html">Store</a></li>
<li><a href="distribution.html">My Library</a></li>
```

The store uses your Playfair Display/Lato fonts, wordmark and existing cover paths. The charcoal backgrounds, gold accents, light text and button styling now match your supplied homepage stylesheet. Adjust the variables at the top of `assets/store.css`. The new styles don't change the homepage.

The build copies an explicit list of website pages/asset folders into `dist`. Add any other existing public pages/folders to `server/build.mjs`. Netlify must publish `dist`, never the repository root. No paid ebooks/audio belong in your public repository or public assets.

## 1. Supabase purchase records and private files

1. Create a Supabase project. In SQL Editor, run `database/setup.sql` **once**. This creates protected tables, transaction-safe purchase recording, persistent request throttling, and a private `digital-assets` bucket.
2. Upload the paid files to that bucket using the dashboard, matching paths in `server/files.json`, or edit that mapping to your real filenames. Keep the bucket private. Check your project's upload-size limits before uploading large audio ZIPs; storage and download bandwidth costs depend on your account.
3. Don't add anonymous/authenticated read policies to purchase tables or this bucket. The backend alone uses the service-role key. The spreadsheet is a reporting copy; the database controls access.
4. Record your project URL, public anon key, and secret service-role key for Netlify settings. Never put the service-role key in public JavaScript or GitHub.

## 2. Email verification

Enable email sign-in and new-user signup in Supabase Auth. Configure **custom SMTP** with an email provider and verified sending domain. Supabase's default SMTP is restricted and unsuitable for a public customer store.

In both the **Magic Link** and **Confirm Signup** email templates, replace the authentication link with a code (so first-time customers also receive a code):

```html
<h2>Your HFJ Ballard library code</h2>
<p>Enter this code on the My Library page:</p>
<p style="font-size:28px;letter-spacing:5px">{{ .Token }}</p>
<p>If you didn't request this code, you can ignore this email.</p>
```

Choose a short OTP expiry, such as 10 minutes, and a code length from six through ten digits. Test delivery to an address outside the project team.

Customers enter their checkout email, receive a code, then see all completed purchases linked to that verified email. Case and surrounding whitespace are normalized; aliases and plus-addresses aren't merged. Nonpurchasers can verify an email but see an empty library. No email lookup discloses purchases before verification.

Tokens are held in the current tab's session storage. After access-token expiry, customers verify again; refresh tokens aren't retained. Sign-out clears this tab, but doesn't revoke other tabs or previously issued download links.

## 3. Stripe: test mode first

1. Activate your Stripe account and use test mode first. Create a product and **one-time USD price** for each real format.
2. On each **Price object's metadata**, set `sku` to the catalog format ID, such as `monster-ebook`. Set it on the Price, not only its Product. Example using Stripe CLI:

```sh
stripe prices update price_REPLACE_ME -d 'metadata[sku]=monster-ebook'
```

3. Put the price IDs in matching Netlify settings from `.env.example`. Actual displayed prices and charges come from Stripe; `previewPrice` values are illustrative only. This implementation assumes two-decimal USD accounting; don't change currencies without adapting the export/accounting logic.
4. Set a format's `saleEnabled` to true in `assets/catalog.json` only after its Stripe price and files are configured. Checkout checks real file existence before accepting a sale. Don't enable an audiobook unless it exists and you have its distribution rights.
5. Enable Stripe successful-payment receipts and include your My Library URL in customer-facing receipt/support messaging. Verify actual receipt delivery and purchase details.
6. Configure support details, privacy/refund/terms pages, and business details before launch. If using Stripe Tax, configure the appropriate product tax codes and registrations first, then set `ENABLE_STRIPE_TAX=true`. It defaults to false. This package doesn't decide your tax obligations or refund policy.

Card details are entered on Stripe's hosted page, not collected by your code. Card payments are enabled; eligible wallets are determined by Stripe. Don't create unrelated Payment Links expecting this backend to fulfill them: it accepts only Checkout sessions marked as created by this store.

## 4. Google Sheets

1. Create a Google Cloud project, enable the Google Sheets API, create a service account, and generate its JSON key. Treat the key as secret; never commit it.
2. Create a **private** spreadsheet with a tab named exactly `Purchases`. Expand it to at least 10,000 rows, or more for your volume. Share it with the service-account email as Editor.
3. In Netlify, set `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `GOOGLE_SHEET_ID`. The spreadsheet ID is the URL portion between `/d/` and `/edit`. Copy the PEM private key from the JSON; literal `\n` escapes also work.
4. Keep Purchases row positions intact. Don't physically sort, insert or delete rows. Use filter views or a separate reporting tab. Database-assigned row numbers make retries idempotent. Sequence gaps are normal; expand the sheet grid as needed.

Netlify runs `sync-sheet` every five minutes on the published site, up to 20 pending orders per run. Higher volume requires increased throughput/a dedicated queue. Each checkout gets one row containing email, all formats bought, amount, currency, status, payment ID and refunded amount. RAW input prevents formula-like customer text from becoming a spreadsheet formula. Fixed rows prevent duplicate rows after retries. Full-refund/dispute status changes update that order's row.

Watch Netlify function logs for failed syncs. Orders with `sheet_synced_revision < revision` are pending. An outage leaves purchases usable and synchronization retries after recovery. Editing the Sheet cannot grant or remove library access.

## 5. Deploy from GitHub to Netlify

1. Commit the code to GitHub without secrets or paid files. Import that repository in Netlify.
2. Use the included configuration: `npm run build`, publish directory `dist`, functions directory `netlify/functions`, Node 22 or newer.
3. Set the required values from `.env.example` in Netlify environment settings for Functions. `SITE_URL` is your exact published HTTPS URL without a trailing slash or path. Generate a long random `RATE_LIMIT_SECRET`. Do not commit a real `.env`.
4. Deploy. Create a Stripe webhook at `https://YOUR-SITE/.netlify/functions/webhook` subscribing to:

   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
   - `charge.dispute.created`

5. Set that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`, then redeploy. The server pins Stripe API version `2025-03-31.basil`; use the matching webhook event version when available. Match test-mode keys, price IDs and webhook signing secrets; later replace them with the corresponding live-mode values.
6. For a custom domain, update `SITE_URL` and the webhook URL, then redeploy. Requests are same-origin; no wildcard CORS is enabled. Deploy previews need their own matching SITE_URL/test settings or checkout is rejected.

GitHub remains your source repository. GitHub Pages explicitly restricts ecommerce hosting. If you keep your informational homepage there, link to a separately hosted Netlify store; change store Home/About/Portfolio links to your absolute homepage URLs and copy public covers to Netlify.

## Purchase/access behavior

- The browser submits SKU IDs, not prices or file paths. The server validates edition availability, actual Stripe prices, SKU metadata and uploaded files before opening Checkout. Repeated checkout attempts with an unchanged bag reuse an idempotency key.
- A signature-verified webhook retrieves the Checkout Session and saves an order **only after payment is confirmed**. The success-page redirect doesn't grant access. Failed recording returns an error for Stripe to retry, even if the customer never returns to your site.
- Transactional order creation prevents duplicate records. Payment-state locks also retain revocations when a refund/dispute arrives before initial fulfillment.
- Verified users receive only their own paid purchases. Download URLs are signed and expire after five minutes. URLs can be shared during that short lifetime; downloaded files are not DRM-protected.
- Full refunds and disputes revoke future downloads for that order. Partial refunds retain all formats in that order. If you need per-format partial refunds, implement item-level refund accounting first. A separate paid, unrefunded purchase of the same format keeps its access. Already downloaded files cannot be recalled.
- Disputed orders stay revoked after dispute closure. After reviewing the outcome, an administrator may restore a specific nonrefunded order by changing its status to paid and incrementing `revision`, and changing the matching `store_payment_states` status. Don't restore refunded orders automatically. Email corrections and exceptional refunds need manual support.

## Update products/news

Edit `assets/catalog.json` for copy, cover paths, format details, featured product ID and news. Add an HTTPS URL/link label to a news entry for a real event. The sample news uses your homepage information without inventing event dates. The sample product blurbs/formats/prices need editorial review.

Edit `server/files.json` for private paths and download labels. Multi-chapter audio can be a ZIP or separate MP3 entries. A new SKU like `new-book-audio` needs matching Stripe Price `sku` metadata, a catalog/file entry, and Netlify setting `PRICE_NEW_BOOK_AUDIO`.

Keep retired SKUs and mappings present with `saleEnabled=false` for webhook retries; don't reuse IDs for unrelated products. Each order stores the file paths promised at purchase. Replace files at the same paths to update downloads; renaming/removing paths requires migrating stored entitlements first. Back up the database and assets.

Customers aren't automatically subscribed to your newsletter; marketing opt-in needs separate explicit consent.

## Account-backed tests before accepting real money

1. Buy an enabled ebook and audiobook in test mode. Check displayed/charged prices, a delivered receipt, one database order and eventual one spreadsheet row.
2. Leave Checkout without returning to the site; confirm fulfillment still happens. Replay the webhook; confirm no duplicate record or sheet row.
3. Verify a customer email, wrong/expired code rejection, every purchased format, and real files that open/play. Verify another email sees none of those purchases.
4. Try arbitrary SKU IDs, altered prices and file paths; confirm rejection. Unsigned private storage access must fail. Check session expiry/sign-out.
5. Remove Sheet permission, buy again, restore permission, and confirm retry recovery without duplicate rows.
6. Fully refund an order; confirm library removal and sheet status. Check partial-refund behavior and the dispute flow.
7. Check desktop/mobile layouts, real covers, file compatibility, support links, privacy/refund copy and accessibility.
8. Switch to live Stripe settings and run a small real purchase/refund check. Use separate Supabase projects/Sheets for test and live orders.

Local commands: `npm install`, `npm test`, `npm run build`. For local account-backed functions, use Netlify CLI's `netlify dev`, matching local SITE_URL, and Stripe CLI webhook forwarding. Keep credentials ignored. A static-only preview has no checkout and shows coming-soon editions.

## References

- [Stripe fulfillment and webhooks](https://docs.stripe.com/checkout/fulfillment)
- [Supabase email authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Production email SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Private storage and signed downloads](https://supabase.com/docs/guides/storage/serving/downloads)
- [Google service-account authentication](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Netlify Functions](https://docs.netlify.com/build/functions/overview/)
- [GitHub Pages hosting limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

