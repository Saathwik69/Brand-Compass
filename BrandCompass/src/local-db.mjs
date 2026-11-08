import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function openDB(filename=resolve(root,'data/brandcompass.sqlite')){
  if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
  const sql=new DatabaseSync(filename);sql.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  sql.exec('CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY)');
  for(const name of readdirSync(resolve(root,'drizzle')).filter(n=>n.endsWith('.sql')).sort()){
    if(!sql.prepare('SELECT name FROM _migrations WHERE name=?').get(name)){
      sql.exec('BEGIN');try{sql.exec(readFileSync(resolve(root,'drizzle',name),'utf8'));sql.prepare('INSERT INTO _migrations(name) VALUES (?)').run(name);sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}
    }
  }
  const wrap=(query,values=[])=>({
    bind(...v){return wrap(query,v);},
    async first(){return sql.prepare(query).get(...values)||null;},
    async all(){return {results:sql.prepare(query).all(...values)};},
    async run(){const r=sql.prepare(query).run(...values);return {success:true,meta:{changes:Number(r.changes)}};}
  });
  return {prepare:wrap,async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}},close(){sql.close();}};
}
