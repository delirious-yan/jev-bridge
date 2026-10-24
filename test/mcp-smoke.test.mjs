import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpHttpHandler, MCP_VERSION } from '../src/mcp-http.mjs';

const definition = { name: 'jev_evaluate_choice', inputSchema: { type:'object', properties: { state: {type:'object'} } } };
const args = { state:{test:true}, instructions:'Choose safely', criteria:{ hold:'Wait', proceed:'Proceed'} };
const rpc = (method,id=1,params={}) => ({jsonrpc:'2.0',method,id,params});
const request = (msg,extra={}) => new Request('https://mcp.example/mcp', { method:'POST', headers:{'content-type':'application/json','accept':'application/json, text/event-stream','mcp-protocol-version':MCP_VERSION,...extra},body:JSON.stringify(msg)});
const advisory = { status:'advisory', choice:'hold', confidence:.9, probabilities:{hold:.9,proceed:.1}, model:'jev-1.14.0', executionEffect:'none' };
const host = (more={})=>createMcpHttpHandler({ toolDefinition:definition, makeToolHandler:()=>async()=>({structuredContent:advisory,content:[]}),...more });
const invoke = rpc('tools/call',3,{name:definition.name,arguments:args});

test('MCP initialization and tool discovery are read-only',async()=>{
 const h=host();
 assert.equal((await (await h(request(rpc('initialize')))).json()).result.protocolVersion,MCP_VERSION);
 const tools=(await (await h(request(rpc('tools/list')))).json()).result.tools;
 assert.equal(tools.length,1);assert.equal(tools[0].annotations.readOnlyHint,true);
 assert.deepEqual(tools[0].securitySchemes,[{type:'oauth2',scopes:['jev:evaluate']}]);
});
test('no bearer token means no grant and no external calls',async()=>{
 let count=0;
 const h=host({consumeApprovedCall:async()=>{count++;return true;}});
 assert.equal((await h(request(invoke))).status,401);assert.equal(count,0);
});
test('authenticated user without owner approval cannot spend',async()=>{
 let count=0;
 const h=host({verifyAccessToken:async()=>({subject:'owner',scopes:['jev:evaluate']}),makeToolHandler:()=>async()=>{count++;throw Error('never');}});
 const r=await h(request(invoke,{authorization:'Bearer example'}));
 assert.equal((await r.json()).result.structuredContent.status,'not_run');assert.equal(count,0);
});
test('single-use grant is consumed once, and private fields are stripped',async()=>{
 let grants=1,calls=0;
 const h=host({verifyAccessToken:async()=>({subject:'owner',scopes:['jev:evaluate']}),consumeApprovedCall:async()=>grants-->0,makeToolHandler:()=>async()=>{calls++;return {structuredContent:{...advisory,private:'TOP_SECRET'},content:[{type:'text',text:'TOP_SECRET'}]};}});
 const first=await (await h(request(invoke,{authorization:'Bearer example'}))).text();
 assert.equal(JSON.parse(first).result.structuredContent.status,'advisory');assert.ok(!first.includes('TOP_SECRET'));
 const second=await (await h(request(invoke,{authorization:'Bearer example'}))).json();
 assert.equal(second.result.structuredContent.status,'not_run');assert.equal(calls,1);
});
test('bad origin, bad protocol, oversized or invalid JSON fail closed',async()=>{
 const h=host();
 assert.equal((await h(request(invoke,{origin:'https://evil.example'}))).status,403);
 assert.equal((await h(request(invoke,{'mcp-protocol-version':'2026-07-28'}))).status,400);
 assert.equal((await h(new Request('https://mcp.example/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:'{oops'}))).status,400);
 assert.equal((await h(request({...invoke,params:{...invoke.params,arguments:{state:'x'.repeat(20_000)}}}))).status,400);
});
test('OAuth metadata requires configured URLs and an external issuer',async()=>{
 assert.throws(()=>host({resourceUrl:'https://mcp.example/mcp'}),TypeError);
 const h=host({resourceUrl:'https://mcp.example/mcp',authorizationServer:'https://issuer.example'});
 const metadata=await h(new Request('https://mcp.example/.well-known/oauth-protected-resource'));
 assert.deepEqual((await metadata.json()).authorization_servers,['https://issuer.example']);
});
