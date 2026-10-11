import { createClient } from "npm:@supabase/supabase-js@2.117.2";
const headers={"Cache-Control":"private, no-store","Content-Type":"application/json","Referrer-Policy":"no-referrer"};
export async function handler(request:Request) {
  if(request.method!=="POST") return Response.json({error:"Method not allowed"},{status:405,headers});
  try {
    const token=request.headers.get("authorization")?.replace(/^Bearer /,"")||"";
    if(!/^[A-Za-z0-9_-]{64}$/.test(token)||!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid request");
    const raw=await request.text(); if(raw.length>200000) throw new Error("Too large");
    const body=JSON.parse(raw);
    if(!["acquire","rotate","store","release"].includes(body.action)||typeof body.owner!=="string"||! /^[0-9a-f-]{36}$/.test(body.owner)) throw new Error("Invalid request");
    const keys=Deno.env.get("SUPABASE_SECRET_KEYS");
    const key=(keys?JSON.parse(keys).default:null)||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const url=Deno.env.get("SUPABASE_URL");
    if(!key||url!=="https://acpwmxehprpcdyrsbfqe.supabase.co") throw new Error("Invalid config");
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,"0")).join("");
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.rpc("ir_executive_gateway",{p_token_hash:hash,p_action:body.action,p_owner:body.owner,p_payload:body.payload||{}});
    if(error) throw new Error("Access denied");
    return Response.json(data,{headers});
  }catch{return Response.json({error:"Gateway access denied"},{status:401,headers});}
}
Deno.serve(handler);
