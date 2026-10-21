# Add the Afterhours Bookshop to hfjballard.com

This is an additive update for your existing Netlify/GitHub website. Your regular homepage remains the landing page. No payment keys, database changes or new hosting service are needed.

## Install in one GitHub commit

1. Extract this ZIP.
2. In your existing repository, choose Add file → Upload files from the repository's TOP LEVEL (where index.html is).
3. Drag in these three folders together: **bookshop**, **assets**, and **server**. Upload the folders themselves, not the outer bookshop-integration folder. Merge with your existing assets/server folders; keep their other files.
4. Commit the changes. The only existing file replaced is **server/build.mjs**. Your HTML, catalog, styles, private file mappings, Netlify settings, payment functions and newsletter functions are retained.
5. When Netlify credits are available, let it publish that commit. No Netlify settings need changing. Do not use the prototype's old netlify.toml; it is intentionally omitted here.
6. Visit https://hfjballard.com/ and click the dresser in the bottom-left corner. The bookshop lives at https://hfjballard.com/bookshop/. The lamppost returns to the regular page you came from, including its section where possible.

Upload all three folders together: the updated build prepares the shared library files and adds the portal to the published primary pages. It does not redirect visitors into the game or replace index.html.

## What is connected

- Bookshelf: reads your public store catalog and current availability/prices from the existing catalog function. Other works and their original external links are read from the homepage. Covers reuse existing image files.
- Counter: uses the existing checkout function and its SKU validation, Stripe session, purchase recording and newsletter opt-in. The server remains authoritative about availability and price. Checkout follows whichever sandbox/live keys your existing store uses. The payment return page remains your existing regular library; its dresser returns to the game.
- Library: reuses your current library HTML and JavaScript at build time, with absolute API/image paths and bookshop styling. Email-code login, downloads, session storage and newsletter preferences use the same backend. No demo book ownership is created.
- Portfolio: reads every distinct image from the current portfolio gallery, removing the repeated carousel copies. All 16 current images appear in frames. Changes to the existing gallery appear in the game as well.
- Author: uses your real homepage photo and author text, plus the existing catalog news. Fictional interview answers and fake signed downloads are removed.
- Bathroom: links to the published short stories Rat and Facing Winter. Invented prototype stories are removed. You can add a magazine issue when you have content ready.
- Portals: dresser on regular pages, lamppost in the bookshop, fixed at bottom left. Primary content is not rewritten; the build inserts the small portal script in the published HTML.

The prototype's test reader-chat service and signing demonstration are not enabled. No test Supabase credentials or prototype database setup are included. Mouse-follow movement, arrow keys, touch arrow pad, collision detection, room interactions and gallery controls are retained.

## Add your own magazine issue later

Edit bookshop/reading-room.json. Replace the empty stories array with your own writing:

```json
{
  "title": "The Reading Room",
  "issue": "Issue 1 · Autumn",
  "stories": [
    {
      "title": "YOUR STORY TITLE",
      "length": "3 MIN READ",
      "text": "Your first paragraph.\n\nYour next paragraph."
    }
  ]
}
```

This JSON is public reading material, not a place for paid ebook files or secrets. Rat/Facing Winter links are discovered from the main site. Until you add stories, the magazine says that no issue is published.

## Verify after deployment (keep Stripe sandbox for this)

1. The regular homepage opens at the root; dresser enters the game; lamppost returns. Test a round trip from the portfolio page too.
2. Shelf shows eight current works. Monster PDF is purchasable; unavailable digital editions cannot be added. External publisher/comic/story links still work.
3. Complete a Stripe sandbox purchase. Check the same confirmation, library and purchase sheet as before. Test both newsletter choices.
4. In-game My Library: request your real code, sign in, download Monster, save a newsletter preference, close the panel and reopen it.
5. Gallery shows 16 unique artworks; pan, Overview, frame detail, keyboard and touch controls work.
6. Try mouse following, arrow keys, touch arrow pad and Escape. Test on a phone too.

Local browser checks used simulated payment/auth endpoints so no purchases or emails were sent. Production credentials and callbacks must be checked after Netlify publishes. If the catalog API is unavailable, the shelf still shows catalog entries but disables direct purchase instead of trusting an illustrative price.

## Undo

Revert the installation commit in GitHub. This restores the earlier build and removes the new files. The purchase database, file storage and payment settings are untouched.
