import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL purchase deduplication, refund ordering, access restrictions and sheet leases', async () => {
  const database = new PGlite();
  await database.exec(`create role anon; create role authenticated; create role service_role;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);`);
  await database.exec(await readFile(new URL('../database/setup.sql', import.meta.url), 'utf8'));
  const buy = (session, payment, email = 'Reader@Example.com') => database.query(
    'select record_store_order($1,$2,$3,599,\'usd\',\'paid\',0,$4::jsonb,now())',
    [session,payment,email,JSON.stringify([{sku:'monster-ebook',title:'Monster',format:'Ebook',files:[{label:'EPUB',path:'monster/monster.epub'}]}])]
  );
  const order = async session => (await database.query('select * from store_orders where session_id=$1',[session])).rows[0];
  await buy('cs_first','pi_first'); await buy('cs_first','pi_first');
  assert.equal((await database.query('select count(*)::integer n from store_orders')).rows[0].n, 1);
  assert.equal((await order('cs_first')).email, 'reader@example.com');
  await database.query("select update_store_payment('pi_first','refunded',599)");
  await buy('cs_first','pi_first'); assert.equal((await order('cs_first')).status,'refunded');
  // A refund notification before fulfillment must also prevent granting access.
  await database.query("select update_store_payment('pi_early','refunded',599)");
  await buy('cs_early','pi_early'); assert.equal((await order('cs_early')).status,'refunded');
  await database.query("select update_store_payment('pi_dispute','disputed',0)");
  await buy('cs_dispute','pi_dispute'); assert.equal((await order('cs_dispute')).status,'disputed');
  await database.query("select update_store_payment('pi_dispute','paid',100)");
  assert.equal((await order('cs_dispute')).status,'disputed');
  await buy('cs_partial','pi_partial');
  await database.query("select update_store_payment('pi_partial','paid',100)");
  assert.equal((await order('cs_partial')).status,'paid');
  assert.equal(Number((await order('cs_partial')).refunded_amount),100);
  const claimed = await database.query("select * from claim_store_sheet_rows('00000000-0000-4000-8000-000000000001')");
  assert.equal(claimed.rows.length,4);
  assert.equal((await database.query("select * from claim_store_sheet_rows('00000000-0000-4000-8000-000000000002')")).rows.length,0);
  assert.equal(new Set(claimed.rows.map(row => row.sheet_row)).size,4);
  assert.equal((await database.query('select public from storage.buckets')).rows[0].public,false);
  assert.equal((await database.query("select store_rate_limit('test',60,2) allowed")).rows[0].allowed,true);
  assert.equal((await database.query("select store_rate_limit('test',60,2) allowed")).rows[0].allowed,true);
  assert.equal((await database.query("select store_rate_limit('test',60,2) allowed")).rows[0].allowed,false);
  await database.exec('set role anon');
  await assert.rejects(database.query('select * from store_orders'), /permission denied/);
  await assert.rejects(database.query("select update_store_payment('pi_first','paid',0)"), /permission denied/);
  await database.exec('reset role');
  await database.close();
});
