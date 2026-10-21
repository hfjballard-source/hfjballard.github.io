# Validation

Source: public repository hfjballard-source/hfjballard.github.io at e4a6e2733deae1eeda1e5ea7515059e1067ab2ba; prototype v7 from the user-specified folder.

Passed:
- Production static build using the current repository and replacement build script.
- JavaScript syntax checks: app, public content loader, shared library/session modules, portal.
- Original home/store/library/portfolio HTML content preserved byte for byte except for one added portal script in each published page.
- Generated library keeps newsletter code, uses root-relative function endpoints, resolves covers from the root.
- Backend source, SQL and Netlify functions are not copied into the public build.
- Browser: eight real works on shelves; Monster PDF available, audiobook unavailable; counter creates the expected SKU/request ID/newsletter API payload. The preview endpoint deliberately rejected checkout without creating a Stripe session.
- Browser: sixteen distinct gallery frames, actual images loaded; gallery pan/overview controls present.
- Browser: simulated email-code sign-in, Monster download button and newsletter preference controls; library persists across switching to About and back, then refreshes.
- Browser: original homepage remains at /; lamppost returns there and dresser opens /bookshop/.
- Browser at 390x844: corrected shelf wraps to two columns without panel horizontal overflow; touch movement controls present.
- Browser console: no JavaScript errors during tested interactions.
- Bathroom: invented stories removed; current Rat and Facing Winter links shown, no unpublished magazine misrepresented as a real issue.

Not performed: live Stripe payment, live Supabase OTP/download, real MailerLite subscription change, Netlify deployment. Local auth/payment tests used stub responses and did not send customer emails or create purchases. Recheck the installed version in Stripe sandbox after Netlify credits become available.
