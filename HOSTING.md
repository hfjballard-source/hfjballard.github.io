# Hosting choices and costs

Checked October 10, 2026. All listed prices are USD; provider plans and usage charges can change.

## Simplest choice: host the whole website on Netlify

Keep all your website code in your existing GitHub repository. Connect that repository to Netlify, which publishes the website and its server functions. Your homepage, portfolio, bookstore and library can then share one domain and the existing relative navigation links.

GitHub holds your source files; Netlify serves the live website. You still edit/commit through GitHub, and Netlify can automatically publish changes from the connected branch. Connecting the repository doesn't itself move your existing domain: after testing, point the domain's DNS to Netlify using the instructions shown in its domain settings. The included build must also list any additional existing public pages/folders you have.

## Alternative: host only the sales section on Netlify

Leave the informational author pages on GitHub Pages. Host the bookstore, distribution/library page, their public assets, and all server functions together on Netlify. Keep purchase records/private ebook and audiobook files in Supabase. Stripe hosts the secure payment screen.

If you own a domain, a layout could be:

- `www.example.com`: existing informational author site on GitHub Pages.
- `shop.example.com`: bookstore and library on Netlify.

You can also start with Netlify's supplied `name.netlify.app` address. Update your original site's Store/My Library links to that address, and change the Netlify store's Home/About/Portfolio links back to the original site's absolute addresses. Copy its public cover images to the Netlify site. A subdomain can be pointed to Netlify without moving the main domain.

It is more than just uploading store.html: the library page and backend functions must be deployed too. The provided code expects the store, library and API to share the same Netlify origin. GitHub Pages restricts ecommerce hosting, so the live sales section belongs on a host that supports it.

## Current Netlify plans

| Plan | Monthly base price | Included monthly credits |
| --- | ---: | ---: |
| Free | $0 | 300 |
| Personal | $9 | 1,000 |
| Pro, entry tier | $20 | 3,000 |

Credits cover traffic, server-function work and publishing updates. Publishing a production update consumes 15 credits; bandwidth consumes 20 credits per GB. Free includes custom domains/SSL and functions, but reaches a hard usage limit: sites pause when the allowance is exhausted rather than generating an overage bill. Paid plans also pause when credits run out unless you enable auto recharge or add credits. Existing legacy accounts may have different plans.

Free is a reasonable starting point for setup and low-volume testing, but available credits and actual traffic determine whether it can support your live shop. Hosting all your pages together doesn't create a fee per page; it changes the total usage counted against the plan. Monitor usage during launch.

## Other costs in this implementation

- **Supabase:** holds purchase history, verified identities and private files. Free currently includes 1 GB file storage, 5 GB uncached egress and 5 GB cached egress; free projects have inactivity-pause rules and no automatic database backups. Pro starts at $25/month. Audiobook file size and download volume can make this the larger cost. Paid-file downloads go directly from Supabase, so their bandwidth falls under Supabase's allowance rather than Netlify's website bandwidth.
- **Stripe:** charges payment processing fees, separate from hosting. Rates depend on your account/country/payment details; consult its applicable pricing. Stripe Tax and other optional services may add costs.
- **Email delivery:** a separate SMTP provider sends the library verification codes; its free allowance or paid plan depends on the provider you choose.
- **Domain registration:** if you use a custom domain, its annual renewal is separate. You can keep the registrar you already use.

No provider accounts have been created or connected for you. Hosting prices don't include configuring them, your taxes, or operational/support work.

Sources: [Netlify pricing](https://www.netlify.com/pricing/), [Netlify Git workflows](https://docs.netlify.com/build/git-workflows/overview/), [Netlify external DNS/subdomains](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/), [Supabase pricing](https://supabase.com/pricing), [Stripe pricing](https://stripe.com/pricing), [GitHub Pages hosting limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
